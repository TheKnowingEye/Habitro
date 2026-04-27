-- 014_last_seen.sql
-- Tracks when a user was last active in the app.
alter table profiles
  add column if not exists last_seen timestamptz;

-- Allow users to update their own last_seen (RLS already exists via
-- the "Users can update own profile" policy on profiles).
