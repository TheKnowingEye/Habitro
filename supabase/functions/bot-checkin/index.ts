/**
 * bot-checkin
 * Cron: 0 21 * * *  (21:00 UTC daily)
 *
 * For every active, non-practice duel that has a bot participant:
 *   1. Skip if bot already checked in today (idempotent).
 *   2. Compare real user score vs bot score to pick a completion rate:
 *        real ahead > 15 pts  →  bot completes 80 % of its habits
 *        gap within ±15 pts   →  bot completes 60 %
 *        bot ahead  > 15 pts  →  bot completes 40 %
 *   3. Shuffle the bot's duel_habits and take the top N at that rate
 *      (minimum 1 habit completed so the bot is never completely absent).
 *   4. Insert check_ins rows — snapshot_url always null, solo = false.
 *
 * Bot check-ins fire the scoring trigger normally so rank progression
 * at week-end reflects real competition.
 *
 * Notifications are skipped: bots have no push_subscriptions rows.
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GAP_THRESHOLD = 15;
// rate when real user is ahead by > GAP_THRESHOLD (bot pushes harder)
const RATE_CLOSING  = 0.80;
// rate when scores are within GAP_THRESHOLD either way
const RATE_EVEN     = 0.60;
// rate when bot is ahead by > GAP_THRESHOLD (bot coasts)
const RATE_COASTING = 0.40;

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const today = new Date().toISOString().split('T')[0];

  try {
    // ── 1. Fetch active non-practice duels with participant profiles ──
    const { data: duels, error: duelErr } = await supabase
      .from('duels')
      .select(`
        id, user_a_id, user_b_id,
        profile_a:profiles!duels_user_a_id_fkey(id, is_bot),
        profile_b:profiles!duels_user_b_id_fkey(id, is_bot)
      `)
      .eq('status', 'active')
      .eq('is_practice', false);

    if (duelErr) throw duelErr;

    const botDuels = (duels ?? []).filter(
      (d) => d.profile_a?.is_bot || d.profile_b?.is_bot
    );

    if (!botDuels.length) return json({ date: today, inserted: 0, message: 'No bot duels.' });

    // ── 2. Batch-load scores for all bot duels ───────────────────
    const { data: scores } = await supabase
      .from('scores')
      .select('duel_id, user_id, total_points')
      .in('duel_id', botDuels.map((d) => d.id));

    const scoreMap: Record<string, number> = {};
    for (const s of scores ?? []) {
      scoreMap[`${s.duel_id}:${s.user_id}`] = s.total_points;
    }

    let inserted = 0;
    const errors: string[] = [];

    for (const duel of botDuels) {
      const botId  = duel.profile_a?.is_bot ? duel.user_a_id : duel.user_b_id;
      const realId = duel.profile_a?.is_bot ? duel.user_b_id : duel.user_a_id;

      // ── 3. Idempotency: skip if bot already checked in today ─────
      const { data: existing } = await supabase
        .from('check_ins')
        .select('id')
        .eq('duel_id', duel.id)
        .eq('user_id', botId)
        .eq('checked_date', today)
        .limit(1);

      if (existing?.length) continue;

      // ── 4. Fetch bot's habits for this duel ──────────────────────
      const { data: botHabits } = await supabase
        .from('duel_habits')
        .select('habit_id')
        .eq('duel_id', duel.id)
        .eq('user_id', botId);

      if (!botHabits?.length) continue; // bot not yet assigned habits — skip

      // ── 5. Determine completion rate from score gap ──────────────
      const botScore  = scoreMap[`${duel.id}:${botId}`]  ?? 0;
      const realScore = scoreMap[`${duel.id}:${realId}`] ?? 0;
      const gap       = realScore - botScore; // positive = real user ahead

      const rate =
        gap >  GAP_THRESHOLD ? RATE_CLOSING  :
        gap < -GAP_THRESHOLD ? RATE_COASTING :
        RATE_EVEN;

      // ── 6. Pick habits to complete ───────────────────────────────
      // Fisher-Yates shuffle then take top N (min 1)
      const shuffled = [...botHabits].sort(() => Math.random() - 0.5);
      const count    = Math.max(1, Math.round(shuffled.length * rate));
      const toComplete = shuffled.slice(0, count);

      // ── 7. Insert check_ins ──────────────────────────────────────
      const rows = toComplete.map((h) => ({
        duel_id:      duel.id,
        user_id:      botId,
        habit_id:     h.habit_id,
        checked_date: today,
        completed:    true,
        snapshot_url: null,
        solo:         false,
      }));

      const { error: insertErr } = await supabase.from('check_ins').insert(rows);
      if (insertErr) {
        errors.push(`duel ${duel.id}: ${insertErr.message}`);
      } else {
        inserted += rows.length;
      }
    }

    return json({
      date: today,
      bot_duels: botDuels.length,
      inserted,
      ...(errors.length ? { errors } : {}),
    }, errors.length ? 207 : 200);

  } catch (err) {
    console.error('bot-checkin failed:', err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
