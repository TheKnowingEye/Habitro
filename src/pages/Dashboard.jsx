import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useScore } from '../hooks/useScore';
import { supabase } from '../lib/supabase';
import ScoreGap from '../components/scoring/ScoreGap';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [duel, setDuel] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [pageState, setPageState] = useState('loading');

  const today = new Date().toISOString().split('T')[0];

  const { myScore, opponentScore, loading: scoresLoading } = useScore(
    duel?.id ?? null,
    user?.id ?? null
  );

  useEffect(() => {
    if (!user) return;

    async function load() {
      // Load active duel with both participants' profiles
      const { data: duelData } = await supabase
        .from('duels')
        .select(`
          id, status, week_start, week_end, is_practice,
          user_a_id, user_b_id,
          user_a:profiles!duels_user_a_id_fkey(id, username, rank_tier),
          user_b:profiles!duels_user_b_id_fkey(id, username, rank_tier)
        `)
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .eq('status', 'active')
        .maybeSingle();

      if (!duelData) {
        // No active duel — check if habits need to be selected
        const { data: pending } = await supabase
          .from('duels')
          .select('id')
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
          .eq('status', 'pending')
          .maybeSingle();

        if (pending) { navigate('/habits', { replace: true }); return; }

        setPageState('no-duel');
        return;
      }

      // Resolve which profile is the opponent
      const opp = duelData.user_a_id === user.id ? duelData.user_b : duelData.user_a;

      // Has the user already checked in today?
      const { data: ci } = await supabase
        .from('check_ins')
        .select('id')
        .eq('duel_id', duelData.id)
        .eq('user_id', user.id)
        .eq('checked_date', today)
        .limit(1);

      setDuel(duelData);
      setOpponent(opp);
      setCheckedInToday((ci?.length ?? 0) > 0);
      setPageState('ready');
    }

    load();
  }, [user, navigate, today]);

  if (pageState === 'loading' || (pageState === 'ready' && scoresLoading)) {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  if (pageState === 'no-duel') {
    return (
      <div className="page-empty">
        <p className="page-empty__text">No active duel.</p>
        <p className="page-empty__sub">New matchups begin every Monday.</p>
      </div>
    );
  }

  const daysLeft = duel
    ? Math.max(0, Math.ceil((new Date(duel.week_end) - new Date()) / 86_400_000))
    : 0;

  const weekDay = new Date(duel.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="dashboard">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="dashboard__header">
        <div className="dashboard__week">
          <span className="dashboard__week-label">Week of {weekDay}</span>
          <Badge variant={daysLeft <= 1 ? 'active' : 'default'}>
            {daysLeft === 0 ? 'Final day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
          </Badge>
        </div>
        <Link to="/profile" className="dashboard__profile-link" aria-label="View profile">
          <div className="dashboard__avatar">{user?.email?.[0]?.toUpperCase() ?? '?'}</div>
        </Link>
      </header>

      {/* ── Practice week banner ────────────────────────────── */}
      {duel.is_practice && (
        <div className="dashboard__practice-banner" role="note">
          <span className="dashboard__practice-icon" aria-hidden="true">🏋️</span>
          <span>Practice week — your first real opponent arrives Monday.</span>
        </div>
      )}

      {/* ── Opponent banner ─────────────────────────────────── */}
      {!duel.is_practice && (
        <div className="dashboard__opponent">
          <span className="dashboard__vs">vs</span>
          <div className="dashboard__opp-info">
            <span className="dashboard__opp-name">{opponent?.username ?? '…'}</span>
            {opponent?.rank_tier && (
              <Badge variant="default">{opponent.rank_tier}</Badge>
            )}
          </div>
        </div>
      )}

      {/* ── Live score gap ──────────────────────────────────── */}
      <div className="dashboard__scores">
        <ScoreGap
          myScore={myScore}
          opponentScore={opponentScore}
          myUsername="You"
          opponentUsername={opponent?.username}
        />
      </div>

      {/* ── Check-in CTA ────────────────────────────────────── */}
      <div className="dashboard__checkin">
        {checkedInToday ? (
          <div className="dashboard__done-today">
            <span className="dashboard__done-icon" aria-hidden="true">✓</span>
            <div>
              <p className="dashboard__done-title">Checked in today</p>
              <p className="dashboard__done-sub">Come back tomorrow to keep the streak.</p>
            </div>
          </div>
        ) : (
          <Button onClick={() => navigate('/checkin')}>
            Check In Today
          </Button>
        )}
      </div>

      {/* ── Quick links ─────────────────────────────────────── */}
      <nav className="dashboard__nav">
        <Link to="/evidence" className="dashboard__nav-link">Evidence Feed</Link>
        <Link to="/profile"  className="dashboard__nav-link">My Profile</Link>
      </nav>
    </div>
  );
}
