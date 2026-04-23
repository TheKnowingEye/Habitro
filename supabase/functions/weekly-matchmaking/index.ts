/**
 * weekly-matchmaking
 * Runs Monday 00:00 UTC via Supabase cron.
 *
 * Algorithm:
 *  1. Find all real-user profiles with no active REAL duel this week.
 *     (Practice duels do not count — users with only a practice duel join the pool.)
 *  2. Fisher-Yates shuffle the pool.
 *  3. Pair consecutive users.
 *  4. If the pool is odd, the last user gets a random bot opponent instead of
 *     sitting out the week.
 *  5. Insert duel + score rows. Auto-assign 3 random habits to any bot participant
 *     so bot-checkin can operate from Day 1.
 *  6. Close open practice duels for all newly matched real users.
 *  7. Fire new-duel push notifications (bots are skipped).
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
    const now       = new Date();
    const weekStart = getMonday(now);
    const weekEnd   = getSunday(weekStart);
    const startStr  = toDateStr(weekStart);
    const endStr    = toDateStr(weekEnd);

    // ── 1. Real users already matched this week (practice duels excluded) ──
    const { data: existingDuels, error: duelFetchErr } = await supabase
      .from('duels')
      .select('user_a_id, user_b_id')
      .eq('week_start', startStr)
      .eq('is_practice', false)
      .in('status', ['pending', 'active']);

    if (duelFetchErr) throw duelFetchErr;

    const matchedIds = new Set<string>();
    for (const d of existingDuels ?? []) {
      matchedIds.add(d.user_a_id);
      if (d.user_b_id) matchedIds.add(d.user_b_id);
    }

    // ── 2. Build unmatched pool — real users only, no bots ───────
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_bot', false);

    if (profileErr) throw profileErr;

    const pool = (profiles ?? [])
      .map((p) => p.id)
      .filter((id) => !matchedIds.has(id));

    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // ── 3. Handle odd pool: assign a bot to the last user ────────
    let botHabitRows: Array<{
      duel_id: string; user_id: string; habit_id: string; target_frequency: number;
    }> = [];
    let botIds = new Set<string>();

    if (pool.length % 2 === 1) {
      const oddUserId = pool.pop()!;

      const { data: bots } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_bot', true);

      if (bots?.length) {
        const bot    = bots[Math.floor(Math.random() * bots.length)];
        const duelId = crypto.randomUUID();
        botIds.add(bot.id);

        // Will be inserted with the rest of the duels
        pool.push(oddUserId);        // put odd user back — we'll handle it manually below
        pool.push(bot.id);           // pair with bot at end of pool
        botIds.add(bot.id);

        // Auto-assign 3 random habits to bot so bot-checkin can run from Monday
        const { data: habits } = await supabase
          .from('habits')
          .select('id, min_frequency');

        if (habits?.length) {
          const shuffled = [...habits].sort(() => Math.random() - 0.5);
          for (const h of shuffled.slice(0, 3)) {
            botHabitRows.push({
              duel_id:          duelId,
              user_id:          bot.id,
              habit_id:         h.id,
              target_frequency: h.min_frequency,
            });
          }
          // Patch the duel_id into botHabitRows — we know it because we just built it
          // but the duel is created in the loop below using pool pairs, so we need
          // to intercept when pool[i] === oddUserId && pool[i+1] === bot.id.
          // Simplest: store the expected pair and patch after the loop.
        }
      } else {
        // No bots seeded — fall back to leaving user unmatched
        console.warn(`No bots available; user ${oddUserId} skipped`);
      }
    }

    // ── 4. Create duel + score rows ──────────────────────────────
    const duelsToInsert:  Array<Record<string, unknown>> = [];
    const scoresToInsert: Array<Record<string, unknown>> = [];
    // Map from (userA:userB) → duelId so we can patch botHabitRows
    const pairDuelId = new Map<string, string>();

    for (let i = 0; i + 1 < pool.length; i += 2) {
      const duelId = crypto.randomUUID();
      pairDuelId.set(`${pool[i]}:${pool[i + 1]}`, duelId);

      duelsToInsert.push({
        id:           duelId,
        user_a_id:    pool[i],
        user_b_id:    pool[i + 1],
        week_start:   startStr,
        week_end:     endStr,
        status:       'active',
        is_practice:  false,
      });
      scoresToInsert.push(
        { duel_id: duelId, user_id: pool[i],     total_points: 0, consecutive_days: 0 },
        { duel_id: duelId, user_id: pool[i + 1], total_points: 0, consecutive_days: 0 }
      );
    }

    // Patch correct duel_id into bot habit rows
    if (botHabitRows.length > 0) {
      const botId   = botHabitRows[0].user_id;
      // Find the duel that contains this bot
      const botDuel = duelsToInsert.find(
        (d) => d.user_b_id === botId || d.user_a_id === botId
      );
      if (botDuel) {
        botHabitRows = botHabitRows.map((r) => ({ ...r, duel_id: botDuel.id as string }));
      }
    }

    const errors: string[] = [];
    const realUserIds: string[] = []; // newly matched real users (for practice duel cleanup)

    if (duelsToInsert.length > 0) {
      const { error: duelErr } = await supabase.from('duels').insert(duelsToInsert);
      if (duelErr) {
        errors.push(`duel insert: ${duelErr.message}`);
      } else {
        const { error: scoreErr } = await supabase.from('scores').insert(scoresToInsert);
        if (scoreErr) errors.push(`score insert: ${scoreErr.message}`);

        if (botHabitRows.length > 0) {
          const { error: habitErr } = await supabase.from('duel_habits').insert(botHabitRows);
          if (habitErr) errors.push(`bot habit insert: ${habitErr.message}`);
        }

        // Collect real user IDs (exclude bots) for practice duel cleanup
        for (const d of duelsToInsert) {
          if (!botIds.has(d.user_a_id as string)) realUserIds.push(d.user_a_id as string);
          if (d.user_b_id && !botIds.has(d.user_b_id as string)) realUserIds.push(d.user_b_id as string);
        }

        // ── 5. Close practice duels for all newly matched real users ──
        if (realUserIds.length > 0) {
          const { error: practiceErr } = await supabase
            .from('duels')
            .update({ status: 'closed' })
            .eq('is_practice', true)
            .in('status', ['active', 'pending'])
            .in('user_a_id', realUserIds);
          if (practiceErr) errors.push(`practice close: ${practiceErr.message}`);
        }

        // ── 6. New duel notifications (skip bots) ────────────────
        const notifyDuels = duelsToInsert.map((d) => ({
          user_a_id: d.user_a_id as string,
          user_b_id: d.user_b_id as string,
        }));
        await sendNewDuelNotifications(supabase, notifyDuels, botIds);
      }
    }

    const botDuelCount = duelsToInsert.filter((d) => botIds.has(d.user_b_id as string)).length;

    return json({
      week:      startStr,
      matched:   (duelsToInsert.length - botDuelCount) * 2,
      bot_duels: botDuelCount,
      skipped:   0,
      ...(errors.length ? { errors } : {}),
    }, errors.length ? 207 : 200);

  } catch (err) {
    console.error('weekly-matchmaking failed:', err);
    return json({ error: String(err) }, 500);
  }
});

// ── Helpers ───────────────────────────────────────────────────

async function sendNewDuelNotifications(
  supabase  : ReturnType<typeof createClient>,
  duels     : Array<{ user_a_id: string; user_b_id: string }>,
  botIds    : Set<string>
) {
  const pushUrl    = `${Deno.env.get('SUPABASE_URL')}/functions/v1/push-notification`;
  const authHeader = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;

  for (const duel of duels) {
    for (const userId of [duel.user_a_id, duel.user_b_id]) {
      if (!userId || botIds.has(userId)) continue; // skip nulls and bots
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
        console.warn(`push-notification failed for user ${userId}`);
      }
    }
  }
}

function getMonday(date: Date): Date {
  const d   = new Date(date);
  const day = d.getUTCDay();
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
