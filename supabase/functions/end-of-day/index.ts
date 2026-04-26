/**
 * end-of-day
 * Runs at midnight UTC daily via Supabase cron (0 0 * * *).
 *
 * For every active duel, for each participant:
 *  1. Count total habits committed for this duel.
 *  2. Count completed check-ins for yesterday.
 *  3. missed = total − completed  →  hp_drain = missed × 10
 *  4. Update scores.hp = max(0, hp − hp_drain).
 *  5. Insert an hp_drain notification if any HP was lost.
 *
 * HP floor is 0 — never goes negative.
 * Bots (is_bot = true) receive HP drain but no notifications.
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
    const yesterday = toDateStr(daysAgo(1));

    // ── 1. All active duels ───────────────────────────────────
    const { data: duels, error: duelErr } = await supabase
      .from('duels')
      .select('id, user_a_id, user_b_id')
      .eq('status', 'active');

    if (duelErr) throw duelErr;
    if (!duels?.length) return json({ processed: 0, message: 'No active duels.' });

    const duelIds = duels.map((d) => d.id);

    // Flatten to (duelId, userId) pairs — user_b_id may be null for practice duels
    const pairs: Array<{ duelId: string; userId: string }> = [];
    for (const duel of duels) {
      pairs.push({ duelId: duel.id, userId: duel.user_a_id });
      if (duel.user_b_id) pairs.push({ duelId: duel.id, userId: duel.user_b_id });
    }

    const userIds = [...new Set(pairs.map((p) => p.userId))];

    // ── 2. Batch-load data ────────────────────────────────────

    const [
      { data: duelHabits },
      { data: checkins },
      { data: scores },
      { data: botProfiles },
    ] = await Promise.all([
      supabase
        .from('duel_habits')
        .select('duel_id, user_id')
        .in('duel_id', duelIds),
      supabase
        .from('check_ins')
        .select('duel_id, user_id')
        .in('duel_id', duelIds)
        .in('user_id', userIds)
        .eq('checked_date', yesterday)
        .eq('completed', true),
      supabase
        .from('scores')
        .select('duel_id, user_id, hp')
        .in('duel_id', duelIds),
      supabase
        .from('profiles')
        .select('id')
        .eq('is_bot', true)
        .in('id', userIds),
    ]);

    // ── 3. Build lookup maps ──────────────────────────────────

    // Total habits per (duelId, userId)
    const totalMap: Record<string, number> = {};
    for (const h of duelHabits ?? []) {
      const key = `${h.duel_id}:${h.user_id}`;
      totalMap[key] = (totalMap[key] ?? 0) + 1;
    }

    // Completed yesterday per (duelId, userId)
    const completedMap: Record<string, number> = {};
    for (const c of checkins ?? []) {
      const key = `${c.duel_id}:${c.user_id}`;
      completedMap[key] = (completedMap[key] ?? 0) + 1;
    }

    // Current HP per (duelId, userId)
    const hpMap: Record<string, number> = {};
    for (const s of scores ?? []) {
      hpMap[`${s.duel_id}:${s.user_id}`] = s.hp ?? 100;
    }

    // Bot user IDs (no notifications for bots)
    const botIds = new Set((botProfiles ?? []).map((b) => b.id));

    // ── 4. Compute drains and apply ───────────────────────────

    const notifications: Array<{ user_id: string; type: string; message: string }> = [];
    const errors: string[] = [];
    let processed = 0;

    for (const { duelId, userId } of pairs) {
      const key      = `${duelId}:${userId}`;
      const total    = totalMap[key]     ?? 0;
      const done     = completedMap[key] ?? 0;
      const missed   = Math.max(0, total - done);
      const drain    = missed * 10;

      if (drain === 0) { processed++; continue; }

      const currentHp = hpMap[key] ?? 100;
      const newHp     = Math.max(0, currentHp - drain);

      const { error: updateErr } = await supabase
        .from('scores')
        .update({ hp: newHp })
        .eq('duel_id', duelId)
        .eq('user_id', userId);

      if (updateErr) {
        errors.push(`hp update ${key}: ${updateErr.message}`);
        continue;
      }

      processed++;

      if (!botIds.has(userId)) {
        notifications.push({
          user_id: userId,
          type:    'hp_drain',
          message: `You lost ${drain} HP yesterday. ${missed} habit${missed === 1 ? '' : 's'} missed.`,
        });
      }
    }

    // ── 5. Batch-insert notifications ─────────────────────────
    if (notifications.length > 0) {
      const { error: notifErr } = await supabase
        .from('notifications')
        .insert(notifications);
      if (notifErr) errors.push(`notifications: ${notifErr.message}`);
    }

    return json(
      { date: yesterday, processed, drained: notifications.length, ...(errors.length ? { errors } : {}) },
      errors.length ? 207 : 200
    );

  } catch (err) {
    console.error('end-of-day failed:', err);
    return json({ error: String(err) }, 500);
  }
});

// ── Utilities ─────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
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
