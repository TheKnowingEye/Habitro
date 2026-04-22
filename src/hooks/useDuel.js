import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getActiveDuel } from '../lib/matchmaking';

export function useDuel(userId) {
  const [duel, setDuel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    getActiveDuel(userId).then((data) => {
      setDuel(data);
      setLoading(false);
    });

    // Real-time subscription for score updates
    const channel = supabase
      .channel(`duel-updates-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        getActiveDuel(userId).then(setDuel);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  return { duel, loading };
}
