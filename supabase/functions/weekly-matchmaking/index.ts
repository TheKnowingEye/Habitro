/**
 * weekly-matchmaking
 * Runs Monday 00:00 UTC via Supabase cron.
 *
 * Algorithm:
 *  1. Find all profiles with no active/pending duel this week.
 *  2. Fisher-Yates shuffle the pool.
 *  3. Pair consecutive users; odd user left in pool (no duel this week).
 *  4. Insert duel + initial score rows for each pair.
 *
 * KNOWN GAP (PRD §3.1): the PRD requires matching the odd user "as soon as
 * the next user registers." That is NOT implemented. The skipped user sees
 * "No active duel" all week and waits until next Monday's cron.
 *
 * To close this gap, add a Supabase Database Webhook on profiles INSERT
 * that calls this function. On invocation, re-run the same pool-building
 * logic — the newly registered user will be in the pool, as will any
 * previously skipped user who still has no active/pending duel.
 * The function is already idempotent with respect to already-matched users,
 * so calling it mid-week is safe.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  try {
    const now        = new Date();
    const weekStart  = getMonday(now);
    const weekEnd    = getSunday(weekStart);
    const startStr   = toDateStr(weekStart);
    const endStr     = toDateStr(weekEnd);

    // ── 1. Find users already matched this week ──────────────
    const { data: existingDuels, error: duelFetchErr } = await supabase
      .from('duels')
      .select('user_a_id, user_b_id')
      .eq('week_start', startStr)
      .in('status', ['pending', 'active']);

    if (duelFetchErr) throw duelFetchErr;

    const matchedIds = new Set<string>();
    for (const d of existingDuels ?? []) {
      matchedIds.add(d.user_a_id);
      matchedIds.add(d.user_b_id);
    }

    // ── 2. Build the unmatched pool ──────────────────────────
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id');

    if (profileErr) throw profileErr;

    const pool = (profiles ?? [])
      .map((p) => p.id)
      .filter((id) => !matchedIds.has(id));

    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // ── 3. Create duels + initial score rows ─────────────────
    const duelsToInsert  = [];
    const scoresToInsert = [];

    for (let i = 0; i + 1 < pool.length; i += 2) {
      const duelId = crypto.randomUUID();
      duelsToInsert.push({
        id:         duelId,
        user_a_id:  pool[i],
        user_b_id:  pool[i + 1],
        week_start: startStr,
        week_end:   endStr,
        status:     'active',
      });
      scoresToInsert.push(
        { duel_id: duelId, user_id: pool[i],     total_points: 0, consecutive_days: 0 },
        { duel_id: duelId, user_id: pool[i + 1], total_points: 0, consecutive_days: 0 }
      );
    }

    const errors: string[] = [];

    if (duelsToInsert.length > 0) {
      const { error: duelErr } = await supabase.from('duels').insert(duelsToInsert);
      if (duelErr) errors.push(`duel insert: ${duelErr.message}`);
      else {
        const { error: scoreErr } = await supabase.from('scores').insert(scoresToInsert);
        if (scoreErr) errors.push(`score insert: ${scoreErr.message}`);
        else {
          // ── Notification 5: new duel alert (Monday AM) ──────
          // Fire-and-forget — a failed notification must not roll back the duel.
          // Payload: { mode: "send", userId, title, body, url }
          await sendNewDuelNotifications(supabase, duelsToInsert);
        }
      }
    }

    const oddUserId = pool.length % 2 === 1 ? pool[pool.length - 1] : null;

    return json({
      week:    startStr,
      matched: duelsToInsert.length * 2,
      skipped: oddUserId ? 1 : 0,
      ...(errors.length ? { errors } : {}),
    }, errors.length ? 207 : 200);

  } catch (err) {
    console.error('weekly-matchmaking failed:', err);
    return json({ error: String(err) }, 500);
  }
});

// ── Notification helper ───────────────────────────────────────

async function sendNewDuelNotifications(
  supabase     : ReturnType<typeof createClient>,
  duels        : Array<{ user_a_id: string; user_b_id: string }>
) {
  const pushUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/push-notification`;
  const authHeader = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;

  for (const duel of duels) {
    for (const userId of [duel.user_a_id, duel.user_b_id]) {
      try {
        await fetch(pushUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body:    JSON.stringify({
            mode:  'send',
            userId,
            title: 'HabitDuel',
            body:  'Your new opponent is ready. Week starts now.',
            url:   '/',
          }),
        });
      } catch {
        // Non-fatal — log only; matchmaking already succeeded
        console.warn(`push-notification failed for user ${userId}`);
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d   = new Date(date);
  const day = d.getUTCDay(); // 0 = Sun … 6 = Sat
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getSunday(monday: Date): Date {
  const d = new Date(monday);
  d.setUTCDate(d.getUTCDate() + 6);
  d.setUTCHours(23, 59, 59, 999);
  return d;
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
