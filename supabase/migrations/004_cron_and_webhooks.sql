-- ============================================================
-- 004_cron_and_webhooks.sql
-- Wires edge functions to Supabase cron (pg_cron + pg_net)
-- and documents the DB webhook that must be set up manually.
--
-- PREREQUISITE: enable both extensions in the Supabase dashboard
-- (Database → Extensions → pg_cron and pg_net) before running.
--
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> with real values,
-- or store the service role key in Vault and read it via:
--   (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
-- ============================================================

-- ── Cron jobs ────────────────────────────────────────────────

-- Notification 2: daily 8 PM reminder (users who haven't checked in)
select cron.schedule(
  'daily-checkin-reminder',
  '0 20 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{"mode":"daily-reminder"}'::jsonb
  )
  $$
);

-- Notification 3: Wednesday mid-week gap (09:00 UTC)
select cron.schedule(
  'mid-week-gap-notification',
  '0 9 * * 3',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/mid-week-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  )
  $$
);

-- Notification 4: Sunday 24-hour final warning (09:00 UTC)
select cron.schedule(
  'sunday-final-warning',
  '0 9 * * 0',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{"mode":"sunday-warning"}'::jsonb
  )
  $$
);

-- Weekly matchmaking: Monday 00:00 UTC
select cron.schedule(
  'weekly-matchmaking',
  '0 0 * * 1',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/weekly-matchmaking',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  )
  $$
);

-- Weekly battle close: Sunday 23:59 UTC
select cron.schedule(
  'weekly-battle-close',
  '59 23 * * 0',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/weekly-battle-close',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  )
  $$
);

-- ── DB Webhook (manual setup required) ───────────────────────
--
-- Notification 1: real-time opponent check-in push.
-- pg_cron cannot react to row inserts — this MUST be configured
-- as a Supabase Database Webhook in the dashboard:
--
--   Dashboard → Database → Webhooks → Create webhook
--     Name:    opponent-checkin-push
--     Table:   public.check_ins
--     Events:  INSERT
--     Method:  POST
--     URL:     https://<PROJECT_REF>.supabase.co/functions/v1/push-notification
--     Headers: Authorization: Bearer <SERVICE_ROLE_KEY>
--              Content-Type: application/json
--
-- The push-notification function detects this via the Supabase
-- webhook body shape { type, table, record } and routes to
-- handleOpponentCheckin(). No additional payload configuration needed.
--
-- End-of-day HP drain: midnight UTC daily
select cron.schedule(
  'end-of-day',
  '0 0 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/end-of-day',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  )
  $$
);

-- ── To remove a cron job ─────────────────────────────────────
-- select cron.unschedule('job-name');
