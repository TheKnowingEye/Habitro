-- 013_notifications_read_at.sql
-- Add read_at timestamptz so the app can persist "mark all as read" across refreshes.
-- The legacy `read` boolean column is kept for backward compatibility.
alter table notifications
  add column if not exists read_at timestamptz;
