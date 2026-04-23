import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

function formatDayHeader(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const diff  = Math.round((today.setHours(12,0,0,0) - date) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

function groupByDay(snapshots) {
  const map = new Map();
  for (const s of snapshots) {
    const key = s.checked_date;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  // already sorted desc by created_at from query; extract days most-recent-first
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, label: formatDayHeader(date), items }));
}

function Tile({ s, isMe, opponentName, onOpen }) {
  const label    = isMe ? 'You' : (opponentName ?? 'Opponent');
  const timeStr  = formatTime(s.created_at);
  const habitStr = s.habits?.name ?? '';

  return (
    <button
      className="evidence-tile"
      onClick={onOpen}
      aria-label={`${label} — ${habitStr} at ${timeStr}`}
    >
      <img
        className="evidence-tile__img"
        src={s.snapshot_url}
        alt=""
        loading="lazy"
      />
      <div className="evidence-tile__overlay">
        <span className="evidence-tile__habit">{habitStr}</span>
        <span className="evidence-tile__time">{timeStr}</span>
      </div>
      <span className={`evidence-tile__label evidence-tile__label--${isMe ? 'me' : 'them'}`}>
        {label}
      </span>
    </button>
  );
}

function Lightbox({ s, isMe, opponentName, onClose }) {
  const label   = isMe ? 'You' : (opponentName ?? 'Opponent');
  const timeStr = formatTime(s.created_at);
  const dateStr = new Date(s.checked_date + 'T12:00:00')
    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const handleBackdrop = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="evidence-lightbox" onClick={handleBackdrop} role="dialog" aria-modal="true">
      <button className="evidence-lightbox__close" onClick={onClose} aria-label="Close">✕</button>
      <div className="evidence-lightbox__inner">
        <img className="evidence-lightbox__img" src={s.snapshot_url} alt={`${label} — ${s.habits?.name}`} />
        <div className="evidence-lightbox__meta">
          <span className={`evidence-tile__label evidence-tile__label--${isMe ? 'me' : 'them'}`}>{label}</span>
          <span className="evidence-lightbox__habit">{s.habits?.name}</span>
          <span className="evidence-lightbox__date">{dateStr} · {timeStr}</span>
        </div>
      </div>
    </div>
  );
}

export default function EvidenceFeed() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [snapshots, setSnapshots] = useState([]);
  const [opponent,  setOpponent]  = useState(null);
  const [pageState, setPageState] = useState('loading');
  const [selected,  setSelected]  = useState(null);

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

  const days = groupByDay(snapshots);

  return (
    <div className="evidence-page">
      <header className="evidence-page__header">
        <button className="evidence-page__back" onClick={() => navigate('/')} aria-label="Back">←</button>
        <h1 className="evidence-page__title">Evidence Feed</h1>
      </header>

      {days.length === 0 ? (
        <div className="page-empty">
          <p className="page-empty__text">No snapshots yet.</p>
          <p className="page-empty__sub">
            Photos appear here when you or {opponent?.username ?? 'your opponent'} attach one during check-in.
          </p>
        </div>
      ) : (
        days.map(({ date, label, items }) => (
          <section key={date} className="evidence-day">
            <h2 className="evidence-day__header">{label}</h2>
            <div className="evidence-grid">
              {items.map((s) => (
                <Tile
                  key={`${s.user_id}-${s.habit_id}-${s.checked_date}`}
                  s={s}
                  isMe={s.user_id === user.id}
                  opponentName={opponent?.username}
                  onOpen={() => setSelected(s)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {selected && (
        <Lightbox
          s={selected}
          isMe={selected.user_id === user.id}
          opponentName={opponent?.username}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
