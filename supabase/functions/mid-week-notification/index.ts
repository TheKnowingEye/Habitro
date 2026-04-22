/**
 * mid-week-notification
 * Cron: 0 9 * * 3  (Wednesday 09:00 UTC)
 *
 * Sends a personalised score-gap notification to every participant in an
 * active duel. The message adapts based on whether the user is ahead,
 * behind, or tied, and includes the number of days remaining.
 *
 * Payload: none (invoked by pg_cron with no body).
 *
 * Notification payload sent to push-notification:
 *   { mode: "send", userId, title: "HabitDuel", body: "<gap message>", url: "/" }
 *
 * Message examples:
 *   Ahead  → "You're up 28 pts. 4 days left — hold on."
 *   Behind → "You're trailing by 28 pts. 4 days left."
 *   Tied   → "It's tied up. 4 days left. Make them count."
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import webpush          from 'https://esm.sh/web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  webpush.setVapidDetails(
    `mailto:${Deno.env.get('VAPID_CONTACT_EMAIL') ?? 'admin@habitduel.app'}`,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: duels, error: duelErr } = await supabase
      .from('duels')
      .select('id, user_a_id, user_b_id, week_end')
      .eq('status', 'active');

    if (duelErr) throw duelErr;
    if (!duels?.length) return json({ sent: 0, message: 'No active duels.' });

    const { data: scores } = await supabase
      .from('scores')
      .select('duel_id, user_id, total_points')
      .in('duel_id', duels.map((d) => d.id));

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id, id, subscription')
      .in('user_id', duels.flatMap((d) => [d.user_a_id, d.user_b_id]));

    const subsByUser = groupBy(subs ?? [], (s) => s.user_id);
    const scoreMap   = Object.fromEntries(
      (scores ?? []).map((s) => [`${s.duel_id}:${s.user_id}`, s.total_points])
    );

    let sent = 0;

    for (const duel of duels) {
      const daysLeft = Math.max(
        0,
        Math.ceil((new Date(duel.week_end).getTime() - new Date(today).getTime()) / 86_400_000)
      );

      const ptsA = scoreMap[`${duel.id}:${duel.user_a_id}`] ?? 0;
      const ptsB = scoreMap[`${duel.id}:${duel.user_b_id}`] ?? 0;

      for (const [userId, myPts, oppPts] of [
        [duel.user_a_id, ptsA, ptsB],
        [duel.user_b_id, ptsB, ptsA],
      ] as [string, number, number][]) {
        const gap     = myPts - oppPts;
        const dayWord = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;

        const msgBody = gap > 0
          ? `You're up ${gap} pt${gap === 1 ? '' : 's'}. ${dayWord} — hold on.`
          : gap < 0
          ? `You're trailing by ${Math.abs(gap)} pt${Math.abs(gap) === 1 ? '' : 's'}. ${dayWord}.`
          : `It's tied up. ${dayWord}. Make them count.`;

        sent += await sendToSubscriptions(
          supabase,
          subsByUser[userId] ?? [],
          'HabitDuel',
          msgBody,
          '/'
        );
      }
    }

    return json({ sent });

  } catch (err) {
    console.error('mid-week-notification error:', err);
    return json({ error: String(err) }, 500);
  }
});

// ── Helpers ───────────────────────────────────────────────────

async function sendToSubscriptions(
  supabase : ReturnType<typeof createClient>,
  subs     : Array<{ id: string; subscription: unknown }>,
  title    : string,
  body     : string,
  url      : string
): Promise<number> {
  const payload = JSON.stringify({ title, body, url });
  let sent = 0;

  for (const sub of subs) {
    try {
      const endpoint = typeof sub.subscription === 'string'
        ? JSON.parse(sub.subscription)
        : sub.subscription;
      await webpush.sendNotification(endpoint, payload);
      sent++;
    } catch (err: unknown) {
      const e = err as { statusCode?: number };
      if (e.statusCode === 410 || e.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }
  return sent;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
