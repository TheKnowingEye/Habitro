-- ============================================================
-- seed.sql — Dev seed data
-- Requires: 001_initial_schema.sql already applied
--
-- Creates:
--   • 2 test users already in an active duel
--   • Habit selections for both users
--   • Check-ins for the current week (Mon–today)
--   • One disputed check-in for admin dashboard testing
--   • Running scores for both users
-- ============================================================

-- ── Fixed UUIDs so the seed is idempotent ────────────────────

do $$ begin

  -- Auth users (bypass trigger by inserting directly into auth.users)
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000001', 'alice@dev.test', crypt('password', gen_salt('bf')), now(), now(), now()),
    ('00000000-0000-0000-0000-000000000002', 'bob@dev.test',   crypt('password', gen_salt('bf')), now(), now(), now())
  on conflict (id) do nothing;

  -- Profiles (trigger may have already created them; upsert to ensure username)
  insert into profiles (id, username, rank_tier, rank_points, wins, losses)
  values
    ('00000000-0000-0000-0000-000000000001', 'alice', 'silver', 120, 4, 1),
    ('00000000-0000-0000-0000-000000000002', 'bob',   'bronze',  40, 1, 3)
  on conflict (id) do update
    set username    = excluded.username,
        rank_tier   = excluded.rank_tier,
        rank_points = excluded.rank_points,
        wins        = excluded.wins,
        losses      = excluded.losses;

  -- ── Habits (predefined list — matches src/constants/habits.js) ──

  insert into habits (id, name, category, min_frequency, max_frequency)
  values
    ('10000000-0000-0000-0000-000000000001', 'Fitness',           'fitness',    3, 5),
    ('10000000-0000-0000-0000-000000000002', 'Study',             'study',      5, 7),
    ('10000000-0000-0000-0000-000000000003', 'Deep Work',         'deep_work',  5, 5),
    ('10000000-0000-0000-0000-000000000004', 'Sleep Consistency', 'sleep',      7, 7),
    ('10000000-0000-0000-0000-000000000005', 'Meditation',        'meditation', 5, 7),
    ('10000000-0000-0000-0000-000000000006', 'Diet Goals',        'diet',       5, 7),
    ('10000000-0000-0000-0000-000000000007', 'Reading',           'reading',    3, 7)
  on conflict (id) do nothing;

  -- ── Active duel (current week Mon–Sun) ───────────────────────

  insert into duels (id, user_a_id, user_b_id, week_start, week_end, status)
  values (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',  -- alice
    '00000000-0000-0000-0000-000000000002',  -- bob
    date_trunc('week', current_date)::date,
    (date_trunc('week', current_date) + interval '6 days')::date,
    'active'
  )
  on conflict (id) do nothing;

  -- ── Habit selections ─────────────────────────────────────────
  -- Alice: Fitness (5x) + Meditation (6x)
  -- Bob:   Fitness (4x) + Reading (5x)

  insert into duel_habits (id, duel_id, user_id, habit_id, target_frequency)
  values
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 5),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 6),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 4),
    ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', 5)
  on conflict (id) do nothing;

  -- ── Check-ins (Mon through yesterday of the current week) ────
  --
  -- Alice completed both habits Mon + Tue + Wed (3 consecutive days → 1.10x multiplier kicks in)
  -- Bob  completed both habits Mon + Tue only, missed Wed
  -- Bob's Tuesday Fitness check-in is disputed (for admin dashboard)

  -- Monday
  insert into check_ins (id, duel_id, user_id, habit_id, checked_date, completed, snapshot_url)
  values
    ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', date_trunc('week', current_date)::date,       true,  'https://example.com/snapshots/alice-fitness-mon.jpg'),
    ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', date_trunc('week', current_date)::date,       true,  null),
    ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', date_trunc('week', current_date)::date,       true,  null),
    ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', date_trunc('week', current_date)::date,       true,  null)
  on conflict (id) do nothing;

  -- Tuesday — Bob's Fitness check-in is disputed
  insert into check_ins (id, duel_id, user_id, habit_id, checked_date, completed, snapshot_url, disputed)
  values
    ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', (date_trunc('week', current_date) + interval '1 day')::date, true,  null,                                                       false),
    ('40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', (date_trunc('week', current_date) + interval '1 day')::date, true,  null,                                                       false),
    ('40000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', (date_trunc('week', current_date) + interval '1 day')::date, true,  'https://example.com/snapshots/bob-fitness-tue.jpg',  true),
    ('40000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', (date_trunc('week', current_date) + interval '1 day')::date, true,  null,                                                       false)
  on conflict (id) do nothing;

  -- Wednesday — Alice only (Bob missed this day)
  insert into check_ins (id, duel_id, user_id, habit_id, checked_date, completed)
  values
    ('40000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', (date_trunc('week', current_date) + interval '2 days')::date, true),
    ('40000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', (date_trunc('week', current_date) + interval '2 days')::date, true)
  on conflict (id) do nothing;

  -- ── Scores (pre-computed to match check-ins above) ───────────
  --
  -- Alice: Mon(25×1.0) + Tue(25×1.0) + Wed(25×1.10) = 25+25+28 = 78 pts
  --   Day 1: 2 habits × 10 + 5 consistency = 25
  --   Day 2: 25
  --   Day 3: 25 × 1.10 = 27.5 → 28 (rounded)
  --
  -- Bob: Mon(25×1.0) + Tue(25×1.0) = 50 pts (disputed check-in still counted until resolved)
  --   consecutive_days resets to 0 after missing Wed

  insert into scores (id, duel_id, user_id, total_points, consecutive_days)
  values
    ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 78, 3),
    ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 50, 0)
  on conflict (id) do nothing;

end $$;
