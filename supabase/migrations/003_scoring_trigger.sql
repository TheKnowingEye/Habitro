-- ============================================================
-- 003_scoring_trigger.sql
-- Recalculates the scores row for a user after every check-in.
--
-- Mirrors calculateDailyPoints() in src/lib/scoring.js exactly.
-- If the formula changes there, it must change here too.
--
-- Approach: full recalculation (not incremental) so that batch
-- inserts from a single check-in session don't double-count.
-- ============================================================

create or replace function recalculate_score(p_duel_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_total_habits   integer;
  v_total_points   integer := 0;
  v_consec         integer := 0;
  v_last_date      date    := null;
  v_rec            record;
  v_daily_pts      numeric;
begin
  -- How many habits did this user commit to in this duel?
  select count(*) into v_total_habits
  from duel_habits
  where duel_id = p_duel_id and user_id = p_user_id;

  -- Process every day that has check-in rows, oldest-first so the
  -- consecutive-day counter builds up correctly.
  for v_rec in (
    select
      checked_date,
      count(*) filter (where completed = true) as completed_count
    from check_ins
    where duel_id = p_duel_id and user_id = p_user_id
    group by checked_date
    order by checked_date asc
  ) loop

    -- ── Consecutive-day tracking ──────────────────────────────
    if v_rec.completed_count > 0 then
      -- Extend the streak if this day is the day after the last active day
      if v_last_date is null or v_rec.checked_date = v_last_date + 1 then
        v_consec := v_consec + 1;
      else
        v_consec := 1; -- gap in completions: streak resets
      end if;
    else
      v_consec := 0;   -- day logged but nothing completed: streak resets
    end if;

    v_last_date := v_rec.checked_date;

    -- ── Daily points (mirrors scoring.js) ────────────────────
    -- Base: 10 pts per completed habit
    v_daily_pts := v_rec.completed_count * 10.0;

    -- Consistency bonus: +5 if ALL habits completed
    if v_total_habits > 0 and v_rec.completed_count = v_total_habits then
      v_daily_pts := v_daily_pts + 5.0;
    end if;

    -- Streak multiplier
    if v_consec >= 5 then
      v_daily_pts := v_daily_pts * 1.25;
    elsif v_consec >= 3 then
      v_daily_pts := v_daily_pts * 1.10;
    end if;

    v_total_points := v_total_points + round(v_daily_pts);
  end loop;

  -- Upsert scores — consecutive_days reflects the current (most recent) streak
  insert into scores (duel_id, user_id, total_points, consecutive_days, last_updated)
  values (p_duel_id, p_user_id, v_total_points, greatest(v_consec, 0), now())
  on conflict (duel_id, user_id)
  do update set
    total_points     = excluded.total_points,
    consecutive_days = excluded.consecutive_days,
    last_updated     = excluded.last_updated;
end;
$$;

-- Thin trigger wrapper so the function stays testable independently
create or replace function trigger_recalculate_score()
returns trigger language plpgsql security definer as $$
begin
  perform recalculate_score(new.duel_id, new.user_id);
  return new;
end;
$$;

-- Fire after INSERT only — check-ins are never updated in MVP.
-- The `disputed` flag is set by admins but does NOT change `completed`
-- in MVP; disputed check-ins still count toward scores until resolved.
--
-- POST-MVP TODO: when dispute resolution is built, admin will flip
-- `completed = false` on a confirmed cheating check-in. At that point,
-- add an UPDATE trigger here so resolved disputes recalculate the score:
--
--   create trigger recalculate_score_on_checkin_update
--     after update of completed on check_ins
--     for each row
--     when (old.completed is distinct from new.completed)
--     execute function trigger_recalculate_score();
--
-- Without this, a resolved dispute will update the check_ins row but the
-- scores table will stay stale — the live gap display will show wrong numbers.
create trigger recalculate_score_on_checkin
  after insert on check_ins
  for each row execute function trigger_recalculate_score();
