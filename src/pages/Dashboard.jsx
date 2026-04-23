import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useScore } from '../hooks/useScore';
import { supabase } from '../lib/supabase';
import ScoreGap from '../components/scoring/ScoreGap';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import NotificationBell from '../components/ui/NotificationBell';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [duel, setDuel] = useState(null);
  const [opponent, setOpponent] = useState(null);
  // 'none' | 'partial' | 'all'
  const [checkinStatus, setCheckinStatus] = useState('none');
  const [pendingHabitNames, setPendingHabitNames] = useState([]);
  const [totalHabits, setTotalHabits] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
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

      // Fetch all habits for this duel + today's completed check-ins in parallel
      const [{ data: duelHabits }, { data: todayCheckins }] = await Promise.all([
        supabase
          .from('duel_habits')
          .select('habit_id, habits(name)')
          .eq('duel_id', duelData.id)
          .eq('user_id', user.id),
        supabase
          .from('check_ins')
          .select('habit_id, completed')
          .eq('duel_id', duelData.id)
          .eq('user_id', user.id)
          .eq('checked_date', today),
      ]);

      const total       = duelHabits?.length ?? 0;
      const doneIds     = new Set((todayCheckins ?? []).filter((c) => c.completed).map((c) => c.habit_id));
      const doneCount   = doneIds.size;
      const pendingNames = (duelHabits ?? [])
        .filter((h) => !doneIds.has(h.habit_id))
        .map((h) => h.habits.name);

      const status = doneCount === 0 ? 'none' : doneCount >= total ? 'all' : 'partial';

      setDuel(duelData);
      setOpponent(opp);
      setCheckinStatus(status);
      setPendingHabitNames(pendingNames);
      setTotalHabits(total);
      setCompletedToday(doneCount);
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
        <div className="dashboard__header-right">
          <NotificationBell />
          <Link to="/profile" className="dashboard__profile-link" aria-label="View profile">
            <div className="dashboard__avatar">{user?.email?.[0]?.toUpperCase() ?? '?'}</div>
          </Link>
        </div>
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
        {checkinStatus === 'all' && (
          <p className="dashboard__checkin-hint dashboard__checkin-hint--done">
            <span aria-hidden="true">✓</span> All {totalHabits} habit{totalHabits !== 1 ? 's' : ''} done today
          </p>
        )}
        {checkinStatus === 'partial' && (
          <p className="dashboard__checkin-hint dashboard__checkin-hint--partial">
            {completedToday} of {totalHabits} done
            {pendingHabitNames.length > 0 && (
              <> · Still to go: <strong>{pendingHabitNames.join(', ')}</strong></>
            )}
          </p>
        )}
        <Button onClick={() => navigate('/checkin')}>
          {checkinStatus === 'none' ? 'Check in today' : "Update today's check-ins"}
        </Button>
      </div>

      {/* ── Quick links ─────────────────────────────────────── */}
      <nav className="dashboard__nav">
        <Link to="/evidence" className="dashboard__nav-link">Evidence Feed</Link>
        <Link to="/profile"  className="dashboard__nav-link">My Profile</Link>
      </nav>
    </div>
  );
}
