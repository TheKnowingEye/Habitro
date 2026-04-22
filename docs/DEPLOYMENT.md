# Deployment Guide — Competitive Habit Tracker

Follow every step in order. Each section lists what it does and what breaks if you skip it.

---

## Prerequisites

Install these before starting. Nothing below will work without them.

```bash
node --version   # 18+ required
npm --version    # 9+ required
npx web-push generate-vapid-keys --version  # confirms web-push is available
```

Install the Supabase CLI:

```bash
npm install -g supabase
supabase --version   # confirm install
```

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose an organisation, name the project (e.g. `habitduel`), set a strong database password, pick a region close to your users
3. Wait for provisioning (~2 minutes)
4. Open **Project Settings → API** and keep this tab open — you'll need values from it in the next step

---

## 2. Collect Credentials

From **Project Settings → API**, copy:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Project URL (e.g. `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key — treat this as a secret |

Also note your **Project Reference ID** (the `xxxx` part of your project URL). You'll need it for cron jobs.

---

## 3. Generate VAPID Keys

Web Push requires a VAPID key pair. Generate one now — you can only set these once on a live app without breaking existing push subscriptions.

```bash
npx web-push generate-vapid-keys
```

Output:

```
Public Key:
Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Private Key:
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Save both values. The public key goes in two places (browser + server). The private key goes server-side only and must never be committed or exposed to the browser.

---

## 4. Configure Local Environment

Copy the template and fill in real values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_VAPID_PUBLIC_KEY=<VAPID public key>

VAPID_PUBLIC_KEY=<VAPID public key>        # same value as above — server alias
VAPID_PRIVATE_KEY=<VAPID private key>
VAPID_CONTACT_EMAIL=you@yourdomain.com     # shown to push services if something goes wrong
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

> **Never commit `.env.local`**. It is in `.gitignore`. The committed `.env.example` has no real values.

---

## 5. Enable Database Extensions

Two extensions are required for cron jobs. Without them, migration `004` will fail.

1. Supabase dashboard → **Database → Extensions**
2. Search for and enable **`pg_cron`** → click **Enable**
3. Search for and enable **`pg_net`** → click **Enable**

Both extensions are pre-installed on Supabase managed instances; you're only toggling them on.

---

## 6. Run Database Migrations

Run migrations **in order**. Each one depends on the previous.

### Option A — Supabase CLI (recommended)

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

This applies all files in `supabase/migrations/` in filename order.

### Option B — SQL Editor (manual)

Open **Database → SQL Editor** in the dashboard and run each file in order:

| File | What it creates |
|---|---|
| `001_initial_schema.sql` | All tables, enums, RLS policies, sign-up trigger |
| `002_habit_cap_trigger.sql` | DB-level enforcement of max 5 habits per duel |
| `003_scoring_trigger.sql` | Score recalculation after every check-in insert |

> **Do not run `004_cron_and_webhooks.sql` here.** Cron jobs are set up manually in Step 11. The file contains placeholder values that would cause SQL errors if run as-is.

Verify migrations applied cleanly:

```sql
-- Run in SQL Editor to confirm all tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Expected tables: `check_ins`, `duel_habits`, `duels`, `habits`, `profiles`, `push_subscriptions`, `scores`

---

## 7. Create the Storage Bucket

The check-in snapshot upload feature writes to a bucket called `snapshots`. The schema migrations do not create storage buckets — this must be done manually.

1. Dashboard → **Storage → New bucket**
2. Name: `snapshots`
3. **Public bucket**: ✅ enabled (opponents need to view snapshot URLs without authentication)
4. Click **Save**

Then add an upload policy so authenticated users can only write to their own folder:

1. Dashboard → **Storage → snapshots → Policies → New policy → For full customization**
2. Run this SQL (or paste it into **Database → SQL Editor**):

```sql
create policy "Authenticated users can upload their own snapshots"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'snapshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

Without this policy, snapshot uploads from the check-in screen will return a 403.

---

## 8. Seed Development Data (dev only — skip for production)

The seed file creates two test users already in an active duel, check-ins for the current week, and one disputed check-in for the admin dashboard.

In the **SQL Editor**, paste and run the contents of `supabase/seed.sql`.

Test user credentials after seeding:
- `alice@dev.test` / `password`
- `bob@dev.test` / `password`

---

## 9. Set Edge Function Secrets

Edge functions read secrets from the Supabase runtime, not from `.env.local`. Set them before deploying.

Dashboard → **Edge Functions → Manage secrets** → add each of the following:

| Secret name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | Your VAPID public key |
| `VAPID_PRIVATE_KEY` | Your VAPID private key |
| `VAPID_CONTACT_EMAIL` | The contact email you generated VAPID keys with |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase into every edge function — you do not need to add them manually.

---

## 10. Deploy Edge Functions

```bash
supabase functions deploy push-notification
supabase functions deploy mid-week-notification
supabase functions deploy weekly-matchmaking
supabase functions deploy weekly-battle-close
```

Or deploy all at once:

```bash
supabase functions deploy
```

Verify deployment:

```bash
supabase functions list
```

All four functions should show status `active`.

---

## 11. Wire the DB Webhook (opponent check-in notification)

This webhook fires the real-time "your rival just checked in" push notification. It cannot be set up via pg_cron because cron is schedule-only — row-insert reactions require a webhook.

Dashboard → **Database → Webhooks → Create a new hook**:

| Field | Value |
|---|---|
| Name | `opponent-checkin-push` |
| Table | `public.check_ins` |
| Events | ✅ `INSERT` only |
| Type | HTTP Request |
| Method | `POST` |
| URL | `https://<PROJECT_REF>.supabase.co/functions/v1/push-notification` |

Under **HTTP Headers**, add:

```
Authorization   Bearer <SERVICE_ROLE_KEY>
Content-Type    application/json
```

Leave the request body empty — the webhook body is automatically populated by Supabase with the inserted row.

The `push-notification` function detects the webhook by the presence of `type` and `record` fields in the request body and routes to the opponent check-in handler automatically.

---

## 12. Set Up Cron Jobs

Dashboard → **Database → Cron Jobs → Create job** for each of the following.

Create one job at a time. The **Schedule** field uses standard cron syntax (UTC).

### Job 1 — Daily check-in reminder

| Field | Value |
|---|---|
| Name | `daily-checkin-reminder` |
| Schedule | `0 20 * * *` |
| Command | See below |

```sql
select net.http_post(
  url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-notification',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
  ),
  body    := '{"mode":"daily-reminder"}'::jsonb
);
```

### Job 2 — Wednesday mid-week gap

| Field | Value |
|---|---|
| Name | `mid-week-gap-notification` |
| Schedule | `0 9 * * 3` |
| Command | See below |

```sql
select net.http_post(
  url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/mid-week-notification',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
  ),
  body    := '{}'::jsonb
);
```

### Job 3 — Sunday 24-hour warning

| Field | Value |
|---|---|
| Name | `sunday-final-warning` |
| Schedule | `0 9 * * 0` |
| Command | See below |

```sql
select net.http_post(
  url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-notification',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
  ),
  body    := '{"mode":"sunday-warning"}'::jsonb
);
```

### Job 4 — Monday matchmaking

| Field | Value |
|---|---|
| Name | `weekly-matchmaking` |
| Schedule | `0 0 * * 1` |
| Command | See below |

```sql
select net.http_post(
  url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/weekly-matchmaking',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
  ),
  body    := '{}'::jsonb
);
```

### Job 5 — Sunday battle close

| Field | Value |
|---|---|
| Name | `weekly-battle-close` |
| Schedule | `59 23 * * 0` |
| Command | See below |

```sql
select net.http_post(
  url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/weekly-battle-close',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
  ),
  body    := '{}'::jsonb
);
```

> **Order matters on Sunday:** `weekly-battle-close` runs at 23:59 and `sunday-final-warning` runs at 09:00. This is intentional — the warning fires first, the close fires last.

---

## 13. Install and Run the Frontend

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. If the app loads and Supabase auth responds, the local setup is complete.

Test the critical path before deploying:
1. Sign up as a new user
2. Navigate to `/habits` and select 1–3 habits
3. Navigate to `/checkin` and mark a habit as done
4. Check Dashboard — score should update (DB trigger fires on check-in insert)

---

## 14. Deploy to Production (Vercel)

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo
3. Framework: **Vite** (auto-detected)
4. Add environment variables under **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your anon key |
| `VITE_VAPID_PUBLIC_KEY` | Your VAPID public key |

5. Deploy. Vercel builds with `npm run build` and serves `dist/`.
6. In your Supabase project, go to **Authentication → URL Configuration** and add your Vercel domain to **Redirect URLs** (required for OAuth and magic link flows):

```
https://your-app.vercel.app
https://your-app.vercel.app/**
```

---

## 15. Smoke Test Checklist

Run through these after each deployment to confirm the core loop is intact.

### Authentication
- [ ] Sign up with a new email → profile row created in `profiles` table
- [ ] Sign in → redirected to Dashboard

### Habit selection
- [ ] `/habits` loads all 7 habit categories
- [ ] Selecting 6 habits is blocked (5 max)
- [ ] Submitting saves rows to `duel_habits`
- [ ] Revisiting `/habits` redirects to `/` (already selected)

### Daily check-in
- [ ] `/checkin` shows today's pending habits
- [ ] Marking a habit as done and submitting inserts a `check_ins` row
- [ ] Snapshot prompt appears ~50% of the time for habits with target ≥ 4×/week
- [ ] Score on Dashboard updates after submission (DB trigger fired)
- [ ] Revisiting `/checkin` shows "All done for today" state

### Real-time scoring
- [ ] Two browser sessions (alice + bob from seed data) — check in as alice → bob's Dashboard score updates without refresh

### Push notifications
- [ ] Browser prompts for notification permission on first login
- [ ] Invoke `push-notification` manually from the dashboard to confirm VAPID setup:

```bash
supabase functions invoke push-notification --body '{"mode":"send","userId":"<A_REAL_USER_UUID>","title":"Test","body":"Push works.","url":"/"}'
```

### Cron / edge function health
- [ ] Manually invoke `weekly-matchmaking`:

```bash
supabase functions invoke weekly-matchmaking
```

Expected response: `{ "week": "...", "matched": N, "skipped": 0 }`

- [ ] Check **Database → Cron Jobs** — all 5 jobs listed with correct schedules

### Storage
- [ ] Upload a snapshot through the check-in flow
- [ ] Confirm the file appears in **Storage → snapshots** bucket
- [ ] Confirm the public URL is accessible in a browser (no auth required)

---

## Known Gaps (resolve before public launch)

| Gap | Impact | Fix |
|---|---|---|
| Odd user from matchmaking stays unmatched all week | At most 1 user per week sees "No active duel" | Add a Supabase DB Webhook on `profiles INSERT` that invokes `weekly-matchmaking` |
| Dispute resolution doesn't recalculate scores | Resolved disputes leave stale scores | Add UPDATE trigger on `check_ins.completed` (see comment in `003_scoring_trigger.sql`) |
| Cron times are UTC, not user-local | 8 PM reminder fires at the same UTC time for all users | Track user timezone in `profiles` and run per-timezone batches |
| `snapshots` bucket is fully public | Anyone with a URL can view snapshots | Add signed URLs if user privacy becomes a concern |
