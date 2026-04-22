import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function useCheckin() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submitCheckin({ duelId, userId, habitId, completed, snapshotUrl = null }) {
    setSubmitting(true);
    setError(null);

    const { error: err } = await supabase.from('check_ins').insert({
      duel_id: duelId,
      user_id: userId,
      habit_id: habitId,
      checked_date: new Date().toISOString().split('T')[0],
      completed,
      snapshot_url: snapshotUrl,
    });

    setSubmitting(false);
    if (err) setError(err.message);
    return !err;
  }

  return { submitCheckin, submitting, error };
}
