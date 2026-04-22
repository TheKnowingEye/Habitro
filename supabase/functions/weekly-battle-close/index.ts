/**
 * weekly-battle-close
 * Runs Sunday 23:59 UTC via Supabase cron.
 *
 * For every active duel whose week_end < today:
 *  1. Compares final scores → determines winner (tie = draw).
 *  2. Closes the duel row.
 *  3. Updates winner profile: wins++, rank_points up, promote tier if threshold crossed.
 *  4. Updates loser profile: losses++, rank_points down, demote tier if at buffer floor.
 *
 * Rank model
 * ──────────
 * rank_points is position within the current tier (not a lifetime total).
 * - On promotion: rank_points resets to (demotionBuffer × LOSS_PTS) so the user
 *   has exactly demotionBuffer losses of runway before dropping back.
 * - On demotion: rank_points resets to the same entry value in the lower tier.
 * - Bronze tier can never demote further.
 *
 * Tier thresholds (must mirror src/constants/ranks.js):
 *   Bronze  → 0 wins   Silver  → 3 wins
 *   Gold    → 7 wins   Platinum→ 15 wins   Elite → 30 wins
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Constants (mirror src/constants/ranks.js) ─────────────────
const RANK_TIERS = [
  { id: 'bronze',   winsRequired: 0,  demotionBuffer: 2 },
  { id: 'silver',   winsRequired: 3,  demotionBuffer: 2 },
  { id: 'gold',     winsRequired: 7,  demotionBuffer: 2 },
  { id: 'platinum', winsRequired: 15, demotionBuffer: 2 },
  { id: 'elite',    winsRequired: 30, demotionBuffer: 2 },
] as const;

type TierId = typeof RANK_TIERS[number]['id'];

const WIN_PTS  = 20; // rank_points awarded to winner
const LOSS_PTS = 20; // rank_points deducted from loser

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  try {
    const today = toDateStr(new Date());

    // ── 1. Find all active duels whose week has ended ─────────
    const { data: duels, error: duelErr } = await supabase
      .from('duels')
      .select('id, user_a_id, user_b_id, week_end')
      .eq('status', 'active')
      .lt('week_end', today);

    if (duelErr) throw duelErr;
    if (!duels?.length) return json({ closed: 0, message: 'No duels to close.' });

    // Batch-load profiles and scores for all affected users
    const userIds = duels.flatMap((d) => [d.user_a_id, d.user_b_id]);

    const [{ data: profiles }, { data: scores }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', userIds),
      supabase.from('scores').select('*').in('duel_id', duels.map((d) => d.id)),
    ]);

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
    const scoreMap   = Object.fromEntries(
      (scores ?? []).map((s) => [`${s.duel_id}:${s.user_id}`, s])
    );

    // ── 2. Close each duel ────────────────────────────────────
    let closed = 0;
    const errors: string[] = [];

    for (const duel of duels) {
      try {
        const scoreA = scoreMap[`${duel.id}:${duel.user_a_id}`];
        const scoreB = scoreMap[`${duel.id}:${duel.user_b_id}`];
        const ptsA   = scoreA?.total_points ?? 0;
        const ptsB   = scoreB?.total_points ?? 0;

        const isDraw   = ptsA === ptsB;
        const winnerId = isDraw ? null : ptsA > ptsB ? duel.user_a_id : duel.user_b_id;
        const loserId  = isDraw ? null : ptsA > ptsB ? duel.user_b_id : duel.user_a_id;

        // Close the duel
        const { error: closeErr } = await supabase
          .from('duels')
          .update({ status: 'closed', winner_id: winnerId })
          .eq('id', duel.id);
        if (closeErr) throw closeErr;

        if (!isDraw && winnerId && loserId) {
          const winner = profileMap[winnerId];
          const loser  = profileMap[loserId];

          await applyWin(supabase,  winner, winnerId);
          await applyLoss(supabase, loser,  loserId);

          // Refresh local profile copies so subsequent duels in this batch
          // see the updated values (same user could theoretically appear again,
          // though the unique-active-duel constraint makes this impossible in MVP).
          profileMap[winnerId] = { ...winner, ...buildWinUpdate(winner) };
          profileMap[loserId]  = { ...loser,  ...buildLossUpdate(loser) };
        }
        // Draw: no rank changes, no wins/losses incremented.

        closed++;
      } catch (err) {
        errors.push(`duel ${duel.id}: ${String(err)}`);
      }
    }

    return json({ closed, ...(errors.length ? { errors } : {}) }, errors.length ? 207 : 200);

  } catch (err) {
    console.error('weekly-battle-close failed:', err);
    return json({ error: String(err) }, 500);
  }
});

// ── Rank helpers ──────────────────────────────────────────────

/** Highest tier the user qualifies for given their lifetime wins. */
function targetTier(wins: number): TierId {
  let tier = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (wins >= t.winsRequired) tier = t;
  }
  return tier.id;
}

/** One tier below the current one, or null if already Bronze. */
function demotedTier(currentId: TierId): TierId | null {
  const idx = RANK_TIERS.findIndex((t) => t.id === currentId);
  return idx > 0 ? RANK_TIERS[idx - 1].id : null;
}

/** rank_points a user starts with on entering a tier — exactly demotionBuffer losses of runway. */
function entryPoints(tierId: TierId): number {
  const tier = RANK_TIERS.find((t) => t.id === tierId)!;
  return tier.demotionBuffer * LOSS_PTS;
}

function buildWinUpdate(profile: Record<string, unknown>) {
  const newWins    = ((profile.wins as number) ?? 0) + 1;
  const promoted   = targetTier(newWins) !== profile.rank_tier;
  const newTier    = targetTier(newWins);
  const newRankPts = promoted
    ? entryPoints(newTier)
    : Math.min(100, ((profile.rank_points as number) ?? 0) + WIN_PTS);

  return { wins: newWins, rank_tier: newTier, rank_points: newRankPts };
}

function buildLossUpdate(profile: Record<string, unknown>) {
  const newLosses       = ((profile.losses as number) ?? 0) + 1;
  const currentRankPts  = (profile.rank_points as number) ?? 0;
  const currentTier     = profile.rank_tier as TierId;
  const below           = demotedTier(currentTier);

  // Demote when rank_points are already at 0 AND there's a tier to fall into.
  // This means: first loss drops points toward 0; second loss at 0 → demote.
  const shouldDemote = currentRankPts <= 0 && below !== null;

  const newTier    = shouldDemote ? below! : currentTier;
  const newRankPts = shouldDemote
    ? entryPoints(below!)
    : Math.max(0, currentRankPts - LOSS_PTS);

  return { losses: newLosses, rank_tier: newTier, rank_points: newRankPts };
}

async function applyWin(supabase: ReturnType<typeof createClient>, profile: Record<string, unknown>, userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update(buildWinUpdate(profile))
    .eq('id', userId);
  if (error) throw error;
}

async function applyLoss(supabase: ReturnType<typeof createClient>, profile: Record<string, unknown>, userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update(buildLossUpdate(profile))
    .eq('id', userId);
  if (error) throw error;
}

// ── Utilities ─────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
