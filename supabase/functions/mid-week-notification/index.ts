/**
 * mid-week-notification
 * Cron: 0 9 * * 3  (Wednesday 09:00 UTC)
 *
 * Inserts a personalised score-gap notification for every participant
 * in an active duel. Message adapts based on lead/trail/tie and days left.
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: duels, error: duelErr } = await supabase
      .from('duels')
      .select('id, user_a_id, user_b_id, week_end')
      .eq('status', 'active');

    if (duelErr) throw duelErr;
    if (!duels?.length) return json({ inserted: 0, message: 'No active duels.' });

    const { data: scores } = await supabase
      .from('scores')
      .select('duel_id, user_id, total_points')
      .in('duel_id', duels.map((d) => d.id));

    const scoreMap = Object.fromEntries(
      (scores ?? []).map((s) => [`${s.duel_id}:${s.user_id}`, s.total_points])
    );

    const rows: { user_id: string; type: string; message: string }[] = [];

    for (const duel of duels) {
      const daysLeft = Math.max(
        0,
        Math.ceil((new Date(duel.week_end).getTime() - new Date(today).getTime()) / 86_400_000)
      );
      const dayWord = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;

      const ptsA = scoreMap[`${duel.id}:${duel.user_a_id}`] ?? 0;
      const ptsB = scoreMap[`${duel.id}:${duel.user_b_id}`] ?? 0;

      for (const [userId, myPts, oppPts] of [
        [duel.user_a_id, ptsA, ptsB],
        [duel.user_b_id, ptsB, ptsA],
      ] as [string, number, number][]) {
        const gap = myPts - oppPts;
        const message = gap > 0
          ? `You're up ${gap} pt${gap === 1 ? '' : 's'}. ${dayWord} — hold on.`
          : gap < 0
          ? `You're trailing by ${Math.abs(gap)} pt${Math.abs(gap) === 1 ? '' : 's'}. ${dayWord}.`
          : `It's tied up. ${dayWord}. Make them count.`;

        rows.push({ user_id: userId, type: 'mid_week', message });
      }
    }

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) throw error;

    return json({ inserted: rows.length });

  } catch (err) {
    console.error('mid-week-notification error:', err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
