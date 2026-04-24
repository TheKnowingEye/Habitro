-- ============================================================
-- 007_notifications.sql
-- In-app notification inbox replacing Web Push.
-- ============================================================

create table notifications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references profiles(id) on delete cascade,
  type       text        not null,
  message    text        not null,
  read       boolean     not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "Users read own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "Service role inserts notifications"
  on notifications for insert
  with check (true);

create policy "Users update own notifications"
  on notifications for update
  using (auth.uid() = user_id);

-- ── DB trigger: notify opponent when ALL habits are completed ─
-- Fires only once per day per duel; survives un-check/re-check.
create or replace function notify_opponent_on_checkin()
returns trigger language plpgsql security definer as $$
declare
  v_opponent_id      uuid;
  v_total_habits     int;
  v_completed_habits int;
  v_already_notified boolean;
begin
  -- Skip if this is an update where completed was already true
  if TG_OP = 'UPDATE' and old.completed = true then
    return new;
  end if;

  if new.completed is not true then
    return new;
  end if;

  -- Only notify when every habit for the day is done
  select count(*) into v_total_habits
  from duel_habits
  where duel_id = new.duel_id and user_id = new.user_id;

  select count(*) into v_completed_habits
  from check_ins
  where duel_id = new.duel_id
    and user_id = new.user_id
    and checked_date = new.checked_date
    and completed = true;

  if v_completed_habits < v_total_habits then
    return new;
  end if;

  -- Find opponent
  select case
    when user_a_id = new.user_id then user_b_id
    else user_a_id
  end into v_opponent_id
  from duels where id = new.duel_id;

  if v_opponent_id is null then return new; end if;

  -- Already notified today? Skip even if user un-checks and re-checks
  select exists(
    select 1 from notifications
    where user_id = v_opponent_id
      and type = 'opponent_checkin'
      and created_at::date = new.checked_date
  ) into v_already_notified;

  if v_already_notified then return new; end if;

  insert into notifications (user_id, type, message)
  values (
    v_opponent_id,
    'opponent_checkin',
    'Your opponent completed all their habits today. Check the score.'
  );

  return new;
end;
$$;

create trigger notify_opponent_checkin
  after insert or update of completed on check_ins
  for each row
  when (new.completed = true)
  execute function notify_opponent_on_checkin();
