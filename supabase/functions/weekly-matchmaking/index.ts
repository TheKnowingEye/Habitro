/**
 * weekly-matchmaking
 * Runs Monday 00:00 UTC via Supabase cron.
 *
 * Algorithm:
 *  0. Process last week's league promotions / demotions.
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
 *  8. Assign each newly matched real user to a league for this week.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RANK_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'elite'] as const;
type TierId = typeof RANK_TIERS[number];

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

    const errors: string[] = [];

    // ── 0. Process last week's league promotions / demotions ──
    await processLastWeekLeagues(supabase, startStr, errors);

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

        pool.push(oddUserId);
        pool.push(bot.id);
        botIds.add(bot.id);

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
        }
      } else {
        console.warn(`No bots available; user ${oddUserId} skipped`);
      }
    }

    // ── 4. Create duel + score rows ──────────────────────────────
    const duelsToInsert:  Array<Record<string, unknown>> = [];
    const scoresToInsert: Array<Record<string, unknown>> = [];
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

    if (botHabitRows.length > 0) {
      const botId   = botHabitRows[0].user_id;
      const botDuel = duelsToInsert.find(
        (d) => d.user_b_id === botId || d.user_a_id === botId
      );
      if (botDuel) {
        botHabitRows = botHabitRows.map((r) => ({ ...r, duel_id: botDuel.id as string }));
      }
    }

    const realUserIds: string[] = [];

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

        // ── 7. League assignment for newly matched real users ─────
        if (realUserIds.length > 0) {
          await assignLeagues(supabase, realUserIds, startStr, endStr, errors);
        }
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

// ── League helpers ────────────────────────────────────────────

/**
 * Ranks last week's league members by weekly_xp, promotes top 5 real users
 * to next tier, demotes bottom 5 to previous tier, records positions.
 */
async function processLastWeekLeagues(
  supabase      : ReturnType<typeof createClient>,
  thisWeekStart : string,
  errors        : string[]
) {
  const { data: lastLeagues, error } = await supabase
    .from('leagues')
    .select('id, tier')
    .lt('week_end', thisWeekStart);

  if (error) { errors.push(`last-week leagues fetch: ${error.message}`); return; }
  if (!lastLeagues?.length) return;

  const leagueIds = lastLeagues.map((l) => l.id);

  const { data: members } = await supabase
    .from('league_members')
    .select('id, league_id, user_id, weekly_xp, is_bot')
    .in('league_id', leagueIds);

  const byLeague: Record<string, NonNullable<typeof members>> = {};
  for (const m of members ?? []) {
    if (!byLeague[m.league_id]) byLeague[m.league_id] = [];
    byLeague[m.league_id].push(m);
  }

  for (const league of lastLeagues) {
    const real = (byLeague[league.id] ?? [])
      .filter((m) => !m.is_bot)
      .sort((a, b) => b.weekly_xp - a.weekly_xp);

    if (!real.length) continue;

    const tierIdx  = RANK_TIERS.indexOf(league.tier as TierId);
    const nextTier = tierIdx < RANK_TIERS.length - 1 ? RANK_TIERS[tierIdx + 1] : null;
    const prevTier = tierIdx > 0 ? RANK_TIERS[tierIdx - 1] : null;

    for (let i = 0; i < real.length; i++) {
      const member   = real[i];
      const position = i + 1;
      const promoted = nextTier !== null && i < 5;
      const demoted  = prevTier !== null && i >= Math.max(5, real.length - 5) && !promoted;

      await supabase
        .from('league_members')
        .update({ position, promoted, demoted })
        .eq('id', member.id);

      if (promoted) {
        const { error: e } = await supabase
          .from('profiles').update({ rank_tier: nextTier }).eq('id', member.user_id);
        if (e) errors.push(`promote ${member.user_id}: ${e.message}`);
      } else if (demoted) {
        const { error: e } = await supabase
          .from('profiles').update({ rank_tier: prevTier }).eq('id', member.user_id);
        if (e) errors.push(`demote ${member.user_id}: ${e.message}`);
      }
    }
  }
}

/**
 * Assigns newly matched real users to leagues for this week.
 * Fills open slots in existing leagues first; creates new ones as needed,
 * padding empty slots with random bots at 50–300 weekly_xp.
 */
async function assignLeagues(
  supabase    : ReturnType<typeof createClient>,
  realUserIds : string[],
  startStr    : string,
  endStr      : string,
  errors      : string[]
) {
  const { data: userProfiles } = await supabase
    .from('profiles')
    .select('id, rank_tier')
    .in('id', realUserIds);

  const byTier: Record<string, string[]> = {};
  for (const p of userProfiles ?? []) {
    if (!byTier[p.rank_tier]) byTier[p.rank_tier] = [];
    byTier[p.rank_tier].push(p.id);
  }

  const { data: bots } = await supabase
    .from('profiles').select('id').eq('is_bot', true);
  const allBotIds = (bots ?? []).map((b) => b.id);

  for (const [tier, usersInTier] of Object.entries(byTier)) {
    const remaining = [...usersInTier];

    // Fill open slots in existing leagues for this tier + week
    const { data: existingLeagues } = await supabase
      .from('leagues').select('id').eq('tier', tier).eq('week_start', startStr);

    if (existingLeagues?.length) {
      const { data: memberRows } = await supabase
        .from('league_members').select('league_id')
        .in('league_id', existingLeagues.map((l) => l.id));

      const countByLeague: Record<string, number> = {};
      for (const m of memberRows ?? []) {
        countByLeague[m.league_id] = (countByLeague[m.league_id] ?? 0) + 1;
      }

      for (const { id: leagueId } of existingLeagues) {
        if (!remaining.length) break;
        const available = 20 - (countByLeague[leagueId] ?? 0);
        if (available <= 0) continue;

        const batch = remaining.splice(0, available);
        const { error } = await supabase
          .from('league_members')
          .upsert(
            batch.map((uid) => ({ league_id: leagueId, user_id: uid, weekly_xp: 0 })),
            { onConflict: 'league_id,user_id', ignoreDuplicates: true }
          );
        if (error) errors.push(`fill league ${leagueId}: ${error.message}`);
      }
    }

    // Create new leagues for any still-unassigned users
    while (remaining.length > 0) {
      const batch = remaining.splice(0, 20);

      const { count } = await supabase
        .from('leagues')
        .select('id', { count: 'exact', head: true })
        .eq('tier', tier)
        .eq('week_start', startStr);

      const { data: newLeague, error: leagueErr } = await supabase
        .from('leagues')
        .insert({ tier, week_start: startStr, week_end: endStr, bucket_number: (count ?? 0) + 1 })
        .select('id')
        .single();

      if (leagueErr || !newLeague) {
        errors.push(`create league ${tier}: ${leagueErr?.message ?? 'no id'}`);
        continue;
      }

      const rows: Array<Record<string, unknown>> = batch.map((uid) => ({
        league_id: newLeague.id, user_id: uid, weekly_xp: 0, is_bot: false,
      }));

      const shuffledBots = [...allBotIds]
        .sort(() => Math.random() - 0.5)
        .slice(0, 20 - batch.length);

      for (const botId of shuffledBots) {
        rows.push({
          league_id: newLeague.id,
          user_id:   botId,
          weekly_xp: Math.floor(Math.random() * 251) + 50,
          is_bot:    true,
        });
      }

      const { error: memberErr } = await supabase
        .from('league_members')
        .upsert(rows, { onConflict: 'league_id,user_id', ignoreDuplicates: true });
      if (memberErr) errors.push(`populate league ${newLeague.id}: ${memberErr.message}`);
    }
  }
}

// ── Existing notification helper ──────────────────────────────

async function sendNewDuelNotifications(
  supabase  : ReturnType<typeof createClient>,
  duels     : Array<{ user_a_id: string; user_b_id: string }>,
  botIds    : Set<string>
) {
  const userIds = duels
    .flatMap((d) => [d.user_a_id, d.user_b_id])
    .filter((id) => id && !botIds.has(id));

  if (!userIds.length) return;

  const rows = [...new Set(userIds)].map((userId) => ({
    user_id: userId,
    type:    'new_duel',
    message: 'Your new opponent is ready. Week starts now.',
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) console.warn('Failed to insert new-duel notifications:', error.message);
}

// ── Date utilities ────────────────────────────────────────────

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
