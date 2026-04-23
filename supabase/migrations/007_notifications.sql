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

-- ── DB trigger: notify opponent when a check-in is completed ─
create or replace function notify_opponent_on_checkin()
returns trigger language plpgsql security definer as $$
declare
  v_opponent_id uuid;
begin
  -- For updates, only fire when completed flips from false → true
  if TG_OP = 'UPDATE' and old.completed = true then
    return new;
  end if;

  if new.completed is not true then
    return new;
  end if;

  select case
    when user_a_id = new.user_id then user_b_id
    else user_a_id
  end into v_opponent_id
  from duels
  where id = new.duel_id;

  if v_opponent_id is null then
    return new;
  end if;

  insert into notifications (user_id, type, message)
  values (
    v_opponent_id,
    'opponent_checkin',
    'Your opponent just checked in. Check the score.'
  );

  return new;
end;
$$;

create trigger notify_opponent_checkin
  after insert or update of completed on check_ins
  for each row
  when (new.completed = true)
  execute function notify_opponent_on_checkin();
