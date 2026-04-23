-- ============================================================
-- 006_checkin_upsert.sql
--
-- Enables the live-toggle check-in model where each habit can be
-- checked or unchecked at any point during the day.
--
-- Everything the upsert needs already exists in 001:
--   • completed boolean NOT NULL DEFAULT false
--   • unique (duel_id, user_id, habit_id, checked_date) — the ON CONFLICT target
--   • RLS UPDATE policy for non-disputed rows
--
-- The one missing piece: the scoring trigger only fires on INSERT.
-- Toggling completed on an existing row (UPDATE) would leave the
-- scores table stale. This migration adds the UPDATE trigger.
-- ============================================================

-- Fire score recalculation when `completed` is toggled on an existing row.
-- WHEN guard ensures it only fires when the value actually changes,
-- not on every UPDATE (e.g. snapshot_url writes won't re-score).
create trigger recalculate_score_on_checkin_update
  after update of completed on check_ins
  for each row
  when (old.completed is distinct from new.completed)
  execute function trigger_recalculate_score();
