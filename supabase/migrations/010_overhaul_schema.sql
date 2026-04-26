-- ============================================================
-- 010_overhaul_schema.sql
-- RPG stat system, levels, leagues, new habit categories
-- ============================================================

-- ── 1. profiles: RPG columns ─────────────────────────────────
alter table profiles
  add column if not exists total_xp    integer default 0,
  add column if not exists level       integer default 1,
  add column if not exists level_title text    default 'Novice',
  add column if not exists stat_str    integer default 0,
  add column if not exists stat_wis    integer default 0,
  add column if not exists stat_int    integer default 0,
  add column if not exists stat_vit    integer default 0;

-- ── 2. scores: HP column ─────────────────────────────────────
alter table scores
  add column if not exists hp integer default 100;

-- ── 3. habits: primary_stat column ───────────────────────────
alter table habits
  add column if not exists primary_stat text
    check (primary_stat in ('str', 'wis', 'int', 'vit'));

-- ── 4. Backfill primary_stat on existing habits ───────────────
update habits set primary_stat = 'str' where category = 'fitness';
update habits set primary_stat = 'int' where category = 'study';
update habits set primary_stat = 'int' where category = 'deep_work';
update habits set primary_stat = 'vit' where category = 'sleep';
update habits set primary_stat = 'wis' where category = 'meditation';
update habits set primary_stat = 'vit' where category = 'diet';
update habits set primary_stat = 'wis' where category = 'reading';

-- ── 5. New habit categories ───────────────────────────────────
insert into habits (name, category, min_frequency, max_frequency, primary_stat) values
  ('Cold Shower', 'cold_shower', 1, 7, 'str'),
  ('Walking',     'walking',    1, 7, 'vit'),
  ('Hydration',   'hydration',  4, 7, 'vit')
on conflict (name) do nothing;

-- ── 6. check_ins: proof_submitted column ─────────────────────
alter table check_ins
  add column if not exists proof_submitted boolean default false;

-- ── 7. level_thresholds table ────────────────────────────────
create table if not exists level_thresholds (
  level       integer primary key,
  xp_required integer not null,
  title       text    not null
);

insert into level_thresholds (level, xp_required, title) values
  (1,     0,     'Novice'),
  (2,     500,   'Apprentice'),
  (3,     1200,  'Habit Keeper'),
  (4,     2500,  'Dedicated'),
  (5,     4500,  'Seasoned'),
  (6,     7500,  'Veteran'),
  (7,     12000, 'Elite'),
  (8,     20000, 'Legend')
on conflict (level) do nothing;

alter table level_thresholds enable row level security;

create policy "Level thresholds readable by authenticated"
  on level_thresholds for select
  using (auth.role() = 'authenticated');

-- ── 8. leagues table ─────────────────────────────────────────
create table if not exists leagues (
  id            uuid        primary key default gen_random_uuid(),
  tier          text        not null check (tier in ('bronze','silver','gold','platinum','elite')),
  bucket_number integer     default 1,
  week_start    date        not null,
  week_end      date        not null,
  created_at    timestamptz default now()
);

alter table leagues enable row level security;

create policy "Leagues readable by authenticated"
  on leagues for select
  using (auth.role() = 'authenticated');

-- ── 9. league_members table ───────────────────────────────────
create table if not exists league_members (
  id         uuid        primary key default gen_random_uuid(),
  league_id  uuid        references leagues(id)  on delete cascade,
  user_id    uuid        references profiles(id) on delete cascade,
  weekly_xp  integer     default 0,
  position   integer,
  promoted   boolean     default false,
  demoted    boolean     default false,
  is_bot     boolean     default false,
  created_at timestamptz default now(),
  unique (league_id, user_id)
);

alter table league_members enable row level security;

create policy "League members readable by authenticated"
  on league_members for select
  using (auth.role() = 'authenticated');

create policy "Service role manages league members"
  on league_members for all
  using (auth.role() = 'service_role');
