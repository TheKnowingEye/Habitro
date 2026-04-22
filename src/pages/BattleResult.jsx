import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import RankBadge from '../components/rank/RankBadge';
import Button from '../components/ui/Button';

export default function BattleResult() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState({
    phase:      'loading', // loading | reveal | breakdown
    outcome:    null,      // 'win' | 'loss' | 'draw'
    myScore:    null,
    oppScore:   null,
    myProfile:  null,
    oppProfile: null,
    myCheckins: [],
    oppCheckins:[],
    duel:       null,
    consolation: 0,
  });

  useEffect(() => {
    if (!user) return;

    async function load() {
      // Most-recently closed duel for this user
      const { data: duel } = await supabase
        .from('duels')
        .select(`
          id, winner_id, week_start, week_end,
          user_a_id, user_b_id,
          user_a:profiles!duels_user_a_id_fkey(id, username, rank_tier, wins, losses),
          user_b:profiles!duels_user_b_id_fkey(id, username, rank_tier, wins, losses)
        `)
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .eq('status', 'closed')
        .order('week_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!duel) { setState((s) => ({ ...s, phase: 'no-result' })); return; }

      const myProfile  = duel.user_a_id === user.id ? duel.user_a : duel.user_b;
      const oppProfile = duel.user_a_id === user.id ? duel.user_b : duel.user_a;

      const [{ data: scores }, { data: checkins }] = await Promise.all([
        supabase.from('scores').select('*').eq('duel_id', duel.id),
        supabase
          .from('check_ins')
          .select('user_id, habit_id, checked_date, completed, habits(name)')
          .eq('duel_id', duel.id)
          .order('checked_date', { ascending: true }),
      ]);

      const myScore  = scores?.find((s) => s.user_id === user.id)    ?? { total_points: 0 };
      const oppScore = scores?.find((s) => s.user_id !== user.id)    ?? { total_points: 0 };
      const outcome  = duel.winner_id === user.id ? 'win'
                     : duel.winner_id === null     ? 'draw'
                     : 'loss';

      // Consolation: loser earns 1 rank_point display per 10 points scored
      const consolation = outcome === 'loss'
        ? Math.max(1, Math.floor(myScore.total_points / 10))
        : 0;

      setState({
        phase:      'reveal',
        outcome,
        myScore,
        oppScore,
        myProfile,
        oppProfile,
        myCheckins:  (checkins ?? []).filter((c) => c.user_id === user.id),
        oppCheckins: (checkins ?? []).filter((c) => c.user_id !== user.id),
        duel,
        consolation,
      });
    }

    load();
  }, [user]);

  const { phase, outcome, myScore, oppScore, myProfile, oppProfile,
          myCheckins, oppCheckins, duel, consolation } = state;

  if (phase === 'loading') return <div className="page-loading"><div className="spinner" /></div>;

  if (phase === 'no-result') {
    return (
      <div className="page-empty">
        <p className="page-empty__text">No battle result yet.</p>
        <p className="page-empty__sub">Results appear after Sunday 23:59.</p>
      </div>
    );
  }

  const myPts   = myScore?.total_points  ?? 0;
  const oppPts  = oppScore?.total_points ?? 0;
  const gap     = Math.abs(myPts - oppPts);

  // Gap analysis for the loser: how many more completed habits were needed
  const myCompleted  = myCheckins.filter((c) => c.completed).length;
  const oppCompleted = oppCheckins.filter((c) => c.completed).length;
  const extraNeeded  = outcome === 'loss' ? oppCompleted - myCompleted + 1 : 0;

  // Group check-ins by date for the breakdown table
  const allDates = [...new Set([...myCheckins, ...oppCheckins].map((c) => c.checked_date))].sort();

  return (
    <div className="battle-result">

      {/* ── Outcome reveal ────────────────────────────────── */}
      <div className={`battle-result__reveal battle-result__reveal--${outcome}`}>
        <div className="battle-result__outcome-icon" aria-hidden="true">
          {outcome === 'win' ? '🏆' : outcome === 'draw' ? '🤝' : '💀'}
        </div>
        <h1 className="battle-result__outcome-label">
          {outcome === 'win' ? 'Victory' : outcome === 'draw' ? 'Draw' : 'Defeat'}
        </h1>

        <div className="battle-result__scores">
          <div className="battle-result__score">
            <span className="battle-result__score-pts">{myPts}</span>
            <span className="battle-result__score-name">You</span>
          </div>
          <span className="battle-result__score-sep">vs</span>
          <div className="battle-result__score">
            <span className="battle-result__score-pts">{oppPts}</span>
            <span className="battle-result__score-name">{oppProfile?.username}</span>
          </div>
        </div>

        {outcome !== 'draw' && (
          <p className="battle-result__margin">
            {outcome === 'win'
              ? `Won by ${gap} point${gap !== 1 ? 's' : ''}`
              : `Lost by ${gap} point${gap !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* ── Gap analysis for loser ────────────────────────── */}
      {outcome === 'loss' && extraNeeded > 0 && (
        <div className="battle-result__gap-analysis">
          <p className="battle-result__gap-text">
            You needed <strong>{extraNeeded}</strong> more check-in{extraNeeded !== 1 ? 's' : ''} to win.
          </p>
        </div>
      )}

      {/* ── Consolation XP (loser only) ───────────────────── */}
      {outcome === 'loss' && (
        <div className="battle-result__consolation">
          <span className="battle-result__consolation-pts">+{consolation}</span>
          <span className="battle-result__consolation-label">effort points earned</span>
        </div>
      )}

      {/* ── Rank update ───────────────────────────────────── */}
      {myProfile && (
        <div className="battle-result__rank">
          <p className="battle-result__rank-label">Current rank</p>
          <RankBadge tier={myProfile.rank_tier} size="lg" />
          <p className="battle-result__rank-record">
            {myProfile.wins}W – {myProfile.losses}L
          </p>
        </div>
      )}

      {/* ── Week breakdown ────────────────────────────────── */}
      {phase !== 'loading' && (
        <section className="battle-result__breakdown">
          <h2 className="battle-result__breakdown-title">Week Breakdown</h2>
          <table className="breakdown-table" aria-label="Week breakdown">
            <thead>
              <tr>
                <th>Day</th>
                <th>You</th>
                <th>{oppProfile?.username}</th>
              </tr>
            </thead>
            <tbody>
              {allDates.map((date) => {
                const myDay  = myCheckins.filter((c) => c.checked_date === date);
                const oppDay = oppCheckins.filter((c) => c.checked_date === date);
                const myDone  = myDay.filter((c)  => c.completed).length;
                const oppDone = oppDay.filter((c) => c.completed).length;
                const label   = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                return (
                  <tr key={date}>
                    <td className="breakdown-table__date">{label}</td>
                    <td className={`breakdown-table__cell ${myDone > 0 ? 'breakdown-table__cell--done' : 'breakdown-table__cell--miss'}`}>
                      {myDone > 0 ? `${myDone}✓` : '—'}
                    </td>
                    <td className={`breakdown-table__cell ${oppDone > 0 ? 'breakdown-table__cell--done' : 'breakdown-table__cell--miss'}`}>
                      {oppDone > 0 ? `${oppDone}✓` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <footer className="battle-result__footer">
        <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
      </footer>
    </div>
  );
}
