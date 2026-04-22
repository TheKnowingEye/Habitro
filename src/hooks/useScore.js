import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Returns the current user's score and their opponent's score for a given duel,
// kept live via a Supabase Realtime subscription on the scores table.
export function useScore(duelId, userId) {
  const [myScore, setMyScore] = useState(null);
  const [opponentScore, setOpponentScore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!duelId || !userId) return;

    async function load() {
      const { data } = await supabase
        .from('scores')
        .select('*')
        .eq('duel_id', duelId);

      if (data) {
        setMyScore(data.find((s) => s.user_id === userId) ?? null);
        setOpponentScore(data.find((s) => s.user_id !== userId) ?? null);
      }
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`scores-${duelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter: `duel_id=eq.${duelId}` },
        ({ new: row }) => {
          if (row.user_id === userId) {
            setMyScore(row);
          } else {
            setOpponentScore(row);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [duelId, userId]);

  return { myScore, opponentScore, loading };
}
