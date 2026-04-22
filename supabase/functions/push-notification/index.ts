/**
 * push-notification
 * Handles four notification modes in a single function.
 *
 * ── Mode detection ────────────────────────────────────────────
 *
 * 1. Supabase DB webhook  (opponent check-in, real-time)
 *    Detected by: request body has `type` + `record` fields (Supabase webhook shape).
 *    Payload example:
 *      { type: "INSERT", table: "check_ins", schema: "public",
 *        record: { duel_id, user_id, completed, ... }, old_record: null }
 *    Action: notifies the opponent in the same duel with current score gap.
 *    Only fires when record.completed === true (no noise for NO check-ins).
 *
 * 2. Daily 8 PM reminder  (cron: 0 20 * * *)
 *    Payload: { mode: "daily-reminder" }
 *    Action: finds every active-duel user with no check-in today → nudge.
 *
 * 3. Sunday 24-hour warning  (cron: 0 9 * * 0)
 *    Payload: { mode: "sunday-warning" }
 *    Action: notifies every active-duel participant.
 *
 * 4. Direct send  (called from weekly-matchmaking and other edge functions)
 *    Payload: { mode: "send", userId, title, body, url? }
 *    Action: sends one notification to the specified user.
 *
 * ── Web Push setup ────────────────────────────────────────────
 * Requires three env vars (set in Supabase dashboard → Edge Functions → Secrets):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import webpush          from 'https://esm.sh/web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  initVapid();

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* cron calls may send empty body */ }

  try {
    // ── Mode 1: Supabase DB webhook ──────────────────────────
    if (body.type && body.record) {
      const result = await handleOpponentCheckin(supabase, body.record as Record<string, unknown>);
      return json(result);
    }

    // ── Mode 2: Daily reminder ───────────────────────────────
    if (body.mode === 'daily-reminder') {
      const result = await handleDailyReminder(supabase);
      return json(result);
    }

    // ── Mode 3: Sunday warning ───────────────────────────────
    if (body.mode === 'sunday-warning') {
      const result = await handleSundayWarning(supabase);
      return json(result);
    }

    // ── Mode 4: Direct send ──────────────────────────────────
    if (body.mode === 'send') {
      const { userId, title, body: msgBody, url = '/' } = body as {
        userId: string; title: string; body: string; url?: string;
      };
      const result = await sendToUser(supabase, userId, title, msgBody, url);
      return json(result);
    }

    return json({ error: 'Unknown mode or payload shape.' }, 400);

  } catch (err) {
    console.error('push-notification error:', err);
    return json({ error: String(err) }, 500);
  }
});

// ── Notification handlers ─────────────────────────────────────

/**
 * Notification 1 — Real-time opponent check-in.
 * Triggered by a Supabase DB webhook on check_ins INSERT.
 */
async function handleOpponentCheckin(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>
) {
  if (!record.completed) return { sent: 0, skipped: 'incomplete check-in' };

  const duelId  = record.duel_id as string;
  const userId  = record.user_id as string;

  const { data: duel } = await supabase
    .from('duels')
    .select('user_a_id, user_b_id')
    .eq('id', duelId)
    .single();

  if (!duel) return { sent: 0, skipped: 'duel not found' };

  const opponentId = duel.user_a_id === userId ? duel.user_b_id : duel.user_a_id;

  // Include live score gap in the message
  const { data: scores } = await supabase
    .from('scores')
    .select('user_id, total_points')
    .eq('duel_id', duelId);

  const myPts  = scores?.find((s) => s.user_id === userId)?.total_points     ?? 0;
  const oppPts = scores?.find((s) => s.user_id === opponentId)?.total_points ?? 0;
  const gap    = myPts - oppPts; // positive = opponent is ahead of the recipient

  const msgBody = gap > 0
    ? `Your rival just checked in. You're down ${gap} pt${gap === 1 ? '' : 's'}. Time to move.`
    : gap < 0
    ? `Your rival just checked in. You're up ${Math.abs(gap)} pt${Math.abs(gap) === 1 ? '' : 's'} — don't get comfortable.`
    : `Your rival just checked in. It's all tied up.`;

  return sendToUser(supabase, opponentId, 'HabitDuel', msgBody, '/');
}

/**
 * Notification 2 — Daily 8 PM reminder.
 * Cron: 0 20 * * *
 */
async function handleDailyReminder(supabase: ReturnType<typeof createClient>) {
  const today = toDateStr(new Date());

  const { data: duels } = await supabase
    .from('duels')
    .select('user_a_id, user_b_id')
    .eq('status', 'active');

  if (!duels?.length) return { sent: 0, reminded: 0 };

  const allUserIds = [...new Set(duels.flatMap((d) => [d.user_a_id, d.user_b_id]))];

  const { data: checkins } = await supabase
    .from('check_ins')
    .select('user_id')
    .in('user_id', allUserIds)
    .eq('checked_date', today);

  const checkedToday = new Set((checkins ?? []).map((c) => c.user_id));
  const needsNudge   = allUserIds.filter((id) => !checkedToday.has(id));

  let sent = 0;
  for (const userId of needsNudge) {
    const r = await sendToUser(
      supabase, userId,
      'HabitDuel',
      "You haven't checked in yet today. Don't let them win this day.",
      '/checkin'
    );
    sent += r.sent;
  }

  return { sent, reminded: needsNudge.length };
}

/**
 * Notification 4 — Sunday 24-hour warning.
 * Cron: 0 9 * * 0
 */
async function handleSundayWarning(supabase: ReturnType<typeof createClient>) {
  const { data: duels } = await supabase
    .from('duels')
    .select('user_a_id, user_b_id')
    .eq('status', 'active');

  if (!duels?.length) return { sent: 0 };

  const allUserIds = [...new Set(duels.flatMap((d) => [d.user_a_id, d.user_b_id]))];

  let sent = 0;
  for (const userId of allUserIds) {
    const r = await sendToUser(
      supabase, userId,
      'HabitDuel',
      "Final battle tonight. Don't leave points on the board.",
      '/checkin'
    );
    sent += r.sent;
  }

  return { sent };
}

// ── Core Web Push sender ──────────────────────────────────────

async function sendToUser(
  supabase : ReturnType<typeof createClient>,
  userId   : string,
  title    : string,
  body     : string,
  url      : string = '/'
): Promise<{ sent: number; errors?: string[] }> {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId);

  if (!subs?.length) return { sent: 0 };

  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  const errors: string[] = [];

  for (const sub of subs) {
    try {
      const endpoint = typeof sub.subscription === 'string'
        ? JSON.parse(sub.subscription)
        : sub.subscription;

      await webpush.sendNotification(endpoint, payload);
      sent++;
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 410 || e.statusCode === 404) {
        // Subscription expired — clean up so we stop retrying
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        errors.push(e.message ?? String(err));
      }
    }
  }

  return { sent, ...(errors.length ? { errors } : {}) };
}

// ── Helpers ───────────────────────────────────────────────────

function initVapid() {
  webpush.setVapidDetails(
    `mailto:${Deno.env.get('VAPID_CONTACT_EMAIL') ?? 'admin@habitduel.app'}`,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
