import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function EvidenceFeed() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [snapshots, setSnapshots] = useState([]);
  const [opponent, setOpponent] = useState(null);
  const [pageState, setPageState] = useState('loading');

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: duel } = await supabase
        .from('duels')
        .select(`
          id, week_start, week_end,
          user_a_id, user_b_id,
          user_a:profiles!duels_user_a_id_fkey(id, username),
          user_b:profiles!duels_user_b_id_fkey(id, username)
        `)
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .eq('status', 'active')
        .maybeSingle();

      if (!duel) { setPageState('no-duel'); return; }

      const opp = duel.user_a_id === user.id ? duel.user_b : duel.user_a;
      setOpponent(opp);

      const { data: checkins } = await supabase
        .from('check_ins')
        .select('habit_id, user_id, snapshot_url, checked_date, created_at, habits(name)')
        .eq('duel_id', duel.id)
        .not('snapshot_url', 'is', null)
        .gte('checked_date', duel.week_start)
        .order('created_at', { ascending: false });

      setSnapshots(checkins ?? []);
      setPageState('ready');
    }

    load();
  }, [user]);

  if (pageState === 'loading') {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  if (pageState === 'no-duel') {
    return (
      <div className="page-empty">
        <p className="page-empty__text">No active duel.</p>
        <p className="page-empty__sub">Evidence appears here during a live duel week.</p>
      </div>
    );
  }

  return (
    <div className="evidence-page">
      <header className="evidence-page__header">
        <button className="evidence-page__back" onClick={() => navigate('/')} aria-label="Back">←</button>
        <h1 className="evidence-page__title">Evidence Feed</h1>
      </header>

      {snapshots.length === 0 ? (
        <div className="page-empty">
          <p className="page-empty__text">No snapshots yet.</p>
          <p className="page-empty__sub">
            Photos appear here when you or {opponent?.username ?? 'your opponent'} attach one during check-in.
          </p>
        </div>
      ) : (
        <ul className="evidence-feed" role="list">
          {snapshots.map((s) => {
            const isMe   = s.user_id === user.id;
            const label  = isMe ? 'You' : (opponent?.username ?? 'Opponent');
            const dt     = new Date(s.created_at);
            const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

            return (
              <li key={`${s.user_id}-${s.habit_id}-${s.checked_date}`} className="evidence-card">
                <img
                  className="evidence-card__img"
                  src={s.snapshot_url}
                  alt={`${label} — ${s.habits?.name}`}
                  loading="lazy"
                />
                <div className="evidence-card__meta">
                  <span className={`evidence-card__who evidence-card__who--${isMe ? 'me' : 'them'}`}>
                    {label}
                  </span>
                  <span className="evidence-card__habit">{s.habits?.name}</span>
                  <span className="evidence-card__time">{dateStr} · {timeStr}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
