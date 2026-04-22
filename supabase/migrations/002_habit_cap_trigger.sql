-- ============================================================
-- 002_habit_cap_trigger.sql
-- Enforces max 5 habits per user per duel at the DB level.
-- State-only guards are bypassable via concurrent tabs / API calls.
-- ============================================================

create or replace function enforce_max_habits_per_duel()
returns trigger language plpgsql as $$
begin
  if (
    select count(*) from duel_habits
    where duel_id = new.duel_id
      and user_id  = new.user_id
  ) >= 5 then
    raise exception 'A user may not select more than 5 habits per duel';
  end if;
  return new;
end;
$$;

create trigger max_habits_per_duel
  before insert on duel_habits
  for each row execute function enforce_max_habits_per_duel();
