/**
 * push-notification (renamed: in-app notification dispatcher)
 *
 * Opponent check-in notifications are now handled by a DB trigger
 * (migration 007). This function handles cron-driven notifications
 * by inserting rows into the `notifications` table.
 *
 * Modes:
 *   { mode: "daily-reminder" }   — cron: 0 20 * * *
 *   { mode: "sunday-warning" }   — cron: 0 9 * * 0
 *   { mode: "send", userId, message, type? } — direct insert
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* cron may send empty body */ }

  try {
    if (body.mode === 'daily-reminder') {
      return json(await handleDailyReminder(supabase));
    }

    if (body.mode === 'sunday-warning') {
      return json(await handleSundayWarning(supabase));
    }

    if (body.mode === 'send') {
      const { userId, message, type = 'system' } = body as {
        userId: string; message: string; type?: string;
      };
      return json(await insertNotification(supabase, userId, type, message));
    }

    return json({ error: 'Unknown mode.' }, 400);

  } catch (err) {
    console.error('notification error:', err);
    return json({ error: String(err) }, 500);
  }
});

async function handleDailyReminder(supabase: ReturnType<typeof createClient>) {
  const today = new Date().toISOString().split('T')[0];

  const { data: duels } = await supabase
    .from('duels')
    .select('user_a_id, user_b_id')
    .eq('status', 'active');

  if (!duels?.length) return { inserted: 0 };

  const allUserIds = [...new Set(duels.flatMap((d) => [d.user_a_id, d.user_b_id]))];

  const { data: checkins } = await supabase
    .from('check_ins')
    .select('user_id')
    .in('user_id', allUserIds)
    .eq('checked_date', today)
    .eq('completed', true);

  const checkedToday = new Set((checkins ?? []).map((c) => c.user_id));
  const needsNudge   = allUserIds.filter((id) => !checkedToday.has(id));

  if (!needsNudge.length) return { inserted: 0 };

  const { error } = await supabase.from('notifications').insert(
    needsNudge.map((userId) => ({
      user_id: userId,
      type: 'daily_reminder',
      message: "You haven't checked in yet today. Don't let them win this day.",
    }))
  );

  if (error) throw error;
  return { inserted: needsNudge.length };
}

async function handleSundayWarning(supabase: ReturnType<typeof createClient>) {
  const { data: duels } = await supabase
    .from('duels')
    .select('user_a_id, user_b_id')
    .eq('status', 'active');

  if (!duels?.length) return { inserted: 0 };

  const allUserIds = [...new Set(duels.flatMap((d) => [d.user_a_id, d.user_b_id]))];

  const { error } = await supabase.from('notifications').insert(
    allUserIds.map((userId) => ({
      user_id: userId,
      type: 'sunday_warning',
      message: "Final battle tonight. Don't leave points on the board.",
    }))
  );

  if (error) throw error;
  return { inserted: allUserIds.length };
}

async function insertNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  type: string,
  message: string
) {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, type, message });
  if (error) throw error;
  return { inserted: 1 };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
