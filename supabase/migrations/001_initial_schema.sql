-- ============================================================
-- 001_initial_schema.sql
-- Competitive Habit Tracker — initial schema
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

create type rank_tier as enum (
  'bronze', 'silver', 'gold', 'platinum', 'elite'
);

create type duel_status as enum (
  'pending',   -- waiting for habit selection
  'active',    -- week in progress
  'closed'     -- week ended, result determined
);

-- ── 1. profiles ──────────────────────────────────────────────
-- Extends auth.users. One row per authenticated user.

create table profiles (
  id                uuid        primary key references auth.users (id) on delete cascade,
  username          text        not null unique,
  rank_tier         rank_tier   not null default 'bronze',
  rank_points       integer     not null default 0,
  wins              integer     not null default 0,
  losses            integer     not null default 0,
  credibility_score integer     not null default 100,
  created_at        timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 2. habits ────────────────────────────────────────────────
-- Predefined categories only — seeded, never user-created (MVP scope lock).

create table habits (
  id            uuid    primary key default gen_random_uuid(),
  name          text    not null unique,
  category      text    not null,
  min_frequency integer not null check (min_frequency >= 1 and min_frequency <= 7),
  max_frequency integer not null check (max_frequency >= min_frequency and max_frequency <= 7)
);

-- ── 3. duels ─────────────────────────────────────────────────
-- One active duel per user per week.
-- Enforced by a BEFORE INSERT/UPDATE trigger because a user can appear in
-- either user_a_id OR user_b_id — two partial unique indexes on separate
-- columns cannot catch the cross-column case.

create table duels (
  id          uuid        primary key default gen_random_uuid(),
  user_a_id   uuid        not null references profiles (id),
  user_b_id   uuid        not null references profiles (id),
  week_start  date        not null,
  week_end    date        not null,
  status      duel_status not null default 'pending',
  winner_id   uuid        references profiles (id),
  created_at  timestamptz not null default now(),

  check (user_a_id <> user_b_id),
  check (week_end > week_start)
);

create or replace function enforce_one_active_duel()
returns trigger language plpgsql as $$
begin
  -- Skip the check when a duel transitions out of active/pending
  if new.status not in ('pending', 'active') then
    return new;
  end if;

  if exists (
    select 1 from duels
    where status in ('pending', 'active')
      and id <> new.id
      and (
        user_a_id = new.user_a_id or user_b_id = new.user_a_id or
        user_a_id = new.user_b_id or user_b_id = new.user_b_id
      )
  ) then
    raise exception 'User already has an active or pending duel this week';
  end if;

  return new;
end;
$$;

create trigger one_active_duel_per_user
  before insert or update on duels
  for each row execute function enforce_one_active_duel();

-- ── 4. duel_habits ───────────────────────────────────────────
-- Records which habits each participant chose for a duel week.

create table duel_habits (
  id               uuid    primary key default gen_random_uuid(),
  duel_id          uuid    not null references duels (id) on delete cascade,
  user_id          uuid    not null references profiles (id),
  habit_id         uuid    not null references habits (id),
  target_frequency integer not null check (target_frequency >= 1 and target_frequency <= 7),

  unique (duel_id, user_id, habit_id)
);

-- ── 5. check_ins ─────────────────────────────────────────────
-- One row per habit per day per user within a duel.

create table check_ins (
  id            uuid    primary key default gen_random_uuid(),
  duel_id       uuid    not null references duels (id) on delete cascade,
  user_id       uuid    not null references profiles (id),
  habit_id      uuid    not null references habits (id),
  checked_date  date    not null,
  completed     boolean not null default false,
  snapshot_url  text,
  disputed      boolean not null default false,
  created_at    timestamptz not null default now(),

  unique (duel_id, user_id, habit_id, checked_date)
);

-- ── 6. scores ────────────────────────────────────────────────
-- Running totals per participant per duel. Updated after each check-in.

create table scores (
  id               uuid        primary key default gen_random_uuid(),
  duel_id          uuid        not null references duels (id) on delete cascade,
  user_id          uuid        not null references profiles (id),
  total_points     integer     not null default 0,
  consecutive_days integer     not null default 0,
  last_updated     timestamptz not null default now(),

  unique (duel_id, user_id)
);

-- ── 7. push_subscriptions ────────────────────────────────────
-- Web Push endpoint subscriptions. One row per user device.

create table push_subscriptions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references profiles (id) on delete cascade,
  subscription jsonb       not null,
  created_at   timestamptz not null default now(),

  unique (user_id, subscription)
);

-- ════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════

alter table profiles          enable row level security;
alter table habits             enable row level security;
alter table duels              enable row level security;
alter table duel_habits        enable row level security;
alter table check_ins          enable row level security;
alter table scores             enable row level security;
alter table push_subscriptions enable row level security;

-- ── profiles ─────────────────────────────────────────────────

create policy "Users can read their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Opponent can read your profile during an active duel
create policy "Duel participants can read each other's profile"
  on profiles for select
  using (
    exists (
      select 1 from duels
      where status in ('pending', 'active', 'closed')
        and (user_a_id = auth.uid() and user_b_id = profiles.id)
        or  (user_b_id = auth.uid() and user_a_id = profiles.id)
    )
  );

-- ── habits ───────────────────────────────────────────────────

create policy "Habits are readable by all authenticated users"
  on habits for select
  using (auth.uid() is not null);

-- ── duels ────────────────────────────────────────────────────

create policy "Participants can read their duels"
  on duels for select
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

-- Insert is performed by edge functions (service role) — no user insert policy needed

-- ── duel_habits ──────────────────────────────────────────────

create policy "Participants can read duel habits for their duel"
  on duel_habits for select
  using (
    exists (
      select 1 from duels
      where duels.id = duel_habits.duel_id
        and (duels.user_a_id = auth.uid() or duels.user_b_id = auth.uid())
    )
  );

create policy "Users can insert their own duel habits"
  on duel_habits for insert
  with check (user_id = auth.uid());

-- ── check_ins ────────────────────────────────────────────────

create policy "Users can read their own check-ins"
  on check_ins for select
  using (user_id = auth.uid());

create policy "Users can insert their own check-ins"
  on check_ins for insert
  with check (user_id = auth.uid());

create policy "Users can update their own non-disputed check-ins"
  on check_ins for update
  using (user_id = auth.uid() and disputed = false)
  with check (user_id = auth.uid());

-- Opponent can read check-ins (for evidence feed) within the same duel
create policy "Duel opponent can read check-ins"
  on check_ins for select
  using (
    exists (
      select 1 from duels
      where duels.id = check_ins.duel_id
        and (duels.user_a_id = auth.uid() or duels.user_b_id = auth.uid())
    )
  );

-- Only service role (admins) can flip the disputed flag — enforced by no user update policy on it

-- ── scores ───────────────────────────────────────────────────

create policy "Duel participants can read scores"
  on scores for select
  using (
    exists (
      select 1 from duels
      where duels.id = scores.duel_id
        and (duels.user_a_id = auth.uid() or duels.user_b_id = auth.uid())
    )
  );

-- Score writes are performed by edge functions (service role) only

-- ── push_subscriptions ───────────────────────────────────────

create policy "Users can manage their own push subscriptions"
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
