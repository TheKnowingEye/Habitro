-- ============================================================
-- 005_practice_and_bot.sql
--
-- Adds two features:
--   1. Practice Week  — solo duel auto-created on signup so new
--      users can track habits before their first real opponent.
--   2. Bot Rivals     — three bot profiles fill the odd slot in
--      weekly matchmaking so no user is ever left without a duel.
-- ============================================================

-- ── 1. Schema additions ───────────────────────────────────────

-- Practice duels have no second participant
ALTER TABLE duels ALTER COLUMN user_b_id DROP NOT NULL;

-- Drop the existing self-duel check (can't reference NEW.user_b_id when NULL)
-- and replace with a NULL-aware version.
DO $$
DECLARE v_name text;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'public.duels'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%user_a_id <> user_b_id%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE duels DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE duels
  ADD CONSTRAINT duels_no_self_duel
  CHECK (user_b_id IS NULL OR user_a_id <> user_b_id);

ALTER TABLE duels
  ADD COLUMN is_practice boolean NOT NULL DEFAULT false;

ALTER TABLE check_ins
  ADD COLUMN solo boolean NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN is_bot boolean NOT NULL DEFAULT false;

-- ── 2. Update one-active-duel constraint ─────────────────────
-- Practice duels are enforced separately and do NOT block real
-- duels from being created (matchmaking closes the practice duel
-- first when a real match is found).

CREATE OR REPLACE FUNCTION enforce_one_active_duel()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'active') THEN RETURN NEW; END IF;

  IF NEW.is_practice THEN
    -- At most one active practice duel per user
    IF EXISTS (
      SELECT 1 FROM duels
      WHERE is_practice = true
        AND status IN ('pending', 'active')
        AND id <> NEW.id
        AND user_a_id = NEW.user_a_id
    ) THEN
      RAISE EXCEPTION 'User already has an active practice duel';
    END IF;
  ELSE
    -- Real duels: one active real duel per user at a time
    IF EXISTS (
      SELECT 1 FROM duels
      WHERE is_practice = false
        AND status IN ('pending', 'active')
        AND id <> NEW.id
        AND (
          user_a_id = NEW.user_a_id
          OR user_b_id = NEW.user_a_id
          OR (NEW.user_b_id IS NOT NULL AND (
                user_a_id = NEW.user_b_id
             OR user_b_id = NEW.user_b_id
          ))
        )
    ) THEN
      RAISE EXCEPTION 'User already has an active or pending duel this week';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. Auto-create practice duel on signup ────────────────────
-- Updated handle_new_user creates a solo practice duel for every
-- real user. Bots are identified via raw_user_meta_data and skip
-- the practice duel step.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_week_start date;
  v_week_end   date;
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );

  -- Bots never get a practice duel
  IF coalesce((new.raw_user_meta_data->>'is_bot')::boolean, false) THEN
    RETURN new;
  END IF;

  v_week_start := date_trunc('week', current_date)::date;
  v_week_end   := (date_trunc('week', current_date) + interval '6 days')::date;

  INSERT INTO duels (user_a_id, user_b_id, week_start, week_end, status, is_practice)
  VALUES (new.id, null, v_week_start, v_week_end, 'active', true);

  RETURN new;
END;
$$;

-- ── 4. Seed bot profiles ──────────────────────────────────────
-- Bots need auth.users rows for the profiles FK.
-- Disable the sign-up trigger so bots don't get practice duels
-- (the updated trigger above already skips bots via is_bot flag,
-- but disabling avoids the redundant INSERT attempt entirely).

ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'bot+ghostmode7@habitduel.internal',
   crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
   '{"is_bot":true,"username":"GhostMode_7"}'::jsonb, now(), now()),
  ('b0000000-0000-0000-0000-000000000002', 'bot+thephantom@habitduel.internal',
   crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
   '{"is_bot":true,"username":"The Phantom"}'::jsonb, now(), now()),
  ('b0000000-0000-0000-0000-000000000003', 'bot+shadowrep@habitduel.internal',
   crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
   '{"is_bot":true,"username":"ShadowRep"}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

INSERT INTO profiles (id, username, rank_tier, rank_points, wins, losses, is_bot)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'GhostMode_7', 'silver', 80, 5, 2, true),
  ('b0000000-0000-0000-0000-000000000002', 'The Phantom',  'silver', 60, 4, 3, true),
  ('b0000000-0000-0000-0000-000000000003', 'ShadowRep',    'silver', 70, 5, 2, true)
ON CONFLICT (id) DO UPDATE SET
  username    = EXCLUDED.username,
  rank_tier   = EXCLUDED.rank_tier,
  rank_points = EXCLUDED.rank_points,
  wins        = EXCLUDED.wins,
  losses      = EXCLUDED.losses,
  is_bot      = EXCLUDED.is_bot;

-- ── 5. Cron job for bot check-ins ─────────────────────────────
-- Runs at 21:00 UTC daily — after the daily reminder window so
-- the real user's score for the day is settled before the bot reacts.
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> before running.
--
-- select cron.schedule(
--   'bot-daily-checkin',
--   '0 21 * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/bot-checkin',
--     headers := jsonb_build_object(
--       'Content-Type',  'application/json',
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--     ),
--     body    := '{}'::jsonb
--   )
--   $$
-- );
