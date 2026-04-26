-- ============================================================
-- 011_xp_and_hp_trigger.sql
-- Replaces the scoring trigger from 003 with a combined trigger
-- that also handles XP, stat increments, level updates, and
-- league weekly_xp on every completed check-in.
--
-- recalculate_score() from 003 is preserved and called internally
-- so the total_points / consecutive_days logic stays in one place.
-- ============================================================

-- ── Drop old trigger and its wrapper ─────────────────────────
-- recalculate_score() itself is NOT dropped — we call it below.
drop trigger  if exists recalculate_score_on_checkin        on check_ins;
drop trigger  if exists recalculate_score_on_checkin_update on check_ins;
drop function if exists trigger_recalculate_score();

-- ── New combined trigger function ─────────────────────────────
create or replace function handle_checkin_completion()
returns trigger language plpgsql security definer as $$
declare
  v_target_freq     integer;
  v_primary_stat    text;
  v_consecutive     integer;
  v_xp_earned       integer;
  v_total_habits    integer;
  v_completed_today integer;
  v_all_completed   boolean;
begin
  -- Guard: only proceed when completed flips false → true.
  -- On INSERT, OLD is null so the distinct check evaluates to false (safe).
  -- On UPDATE where completed was already true, skip to avoid double-counting.
  if new.completed is not distinct from old.completed then
    return new;
  end if;

  -- ── Habit metadata ─────────────────────────────────────────
  select dh.target_frequency, h.primary_stat
  into   v_target_freq, v_primary_stat
  from   duel_habits dh
  join   habits h on h.id = dh.habit_id
  where  dh.duel_id  = new.duel_id
    and  dh.user_id  = new.user_id
    and  dh.habit_id = new.habit_id;

  -- ── Current streak (pre-recalculation) ─────────────────────
  -- Read consecutive_days before recalculate_score() updates it.
  -- Null on the very first check-in of a duel → treat as 0.
  select coalesce(consecutive_days, 0)
  into   v_consecutive
  from   scores
  where  duel_id = new.duel_id and user_id = new.user_id;

  -- ── XP for this check-in (mirrors calculateCheckInXP in scoring.js) ──
  v_xp_earned := coalesce(v_target_freq, 1) * 3;
  if v_consecutive >= 5 then
    v_xp_earned := round(v_xp_earned * 1.25);
  elsif v_consecutive >= 3 then
    v_xp_earned := round(v_xp_earned * 1.10);
  end if;

  -- ── All-habits-today bonus ──────────────────────────────────
  -- AFTER trigger sees the committed row, so this count includes new.habit_id.
  select count(*) into v_total_habits
  from   duel_habits
  where  duel_id = new.duel_id and user_id = new.user_id;

  select count(*) into v_completed_today
  from   check_ins
  where  duel_id      = new.duel_id
    and  user_id      = new.user_id
    and  checked_date = new.checked_date
    and  completed    = true;

  v_all_completed := (v_total_habits > 0 and v_completed_today >= v_total_habits);

  -- ── Score recalculation (total_points + consecutive_days) ───
  -- Full recalculation from 003 — preserves streak logic exactly.
  perform recalculate_score(new.duel_id, new.user_id);

  -- ── Award XP ───────────────────────────────────────────────
  update profiles
  set total_xp = total_xp
               + v_xp_earned
               + case when v_all_completed then 50 else 0 end
  where id = new.user_id;

  -- ── Recalculate level from level_thresholds ─────────────────
  update profiles p
  set
    level       = lt.level,
    level_title = lt.title
  from level_thresholds lt
  where p.id = new.user_id
    and lt.level = (
      select max(level)
      from   level_thresholds
      where  xp_required <= (select total_xp from profiles where id = new.user_id)
    );

  -- ── Increment primary stat ──────────────────────────────────
  update profiles set
    stat_str = stat_str + case when v_primary_stat = 'str' then 1 else 0 end,
    stat_wis = stat_wis + case when v_primary_stat = 'wis' then 1 else 0 end,
    stat_int = stat_int + case when v_primary_stat = 'int' then 1 else 0 end,
    stat_vit = stat_vit + case when v_primary_stat = 'vit' then 1 else 0 end
  where id = new.user_id;

  -- ── Update league weekly_xp ─────────────────────────────────
  update league_members lm
  set    weekly_xp = weekly_xp
                   + v_xp_earned
                   + case when v_all_completed then 50 else 0 end
  from   leagues l
  where  lm.league_id = l.id
    and  lm.user_id   = new.user_id
    and  l.week_start <= current_date
    and  l.week_end   >= current_date;

  return new;
end;
$$;

-- ── Attach trigger ────────────────────────────────────────────
-- Fires after INSERT and after UPDATE of completed.
-- The WHEN clause ensures the body only runs when completed = true.
-- The guard inside catches the UPDATE-already-true case.
create trigger handle_checkin_completion
  after insert or update of completed on check_ins
  for each row
  when (new.completed = true)
  execute function handle_checkin_completion();
