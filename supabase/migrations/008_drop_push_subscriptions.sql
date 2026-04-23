-- ============================================================
-- 008_drop_push_subscriptions.sql
-- Remove Web Push infrastructure now replaced by in-app notifications.
-- ============================================================

drop table if exists push_subscriptions cascade;
