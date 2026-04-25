import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function tileState(day, today, doneByDate, totalHabits) {
  const isPast  = day < today;
  const isToday = day === today;
  const done    = doneByDate[day] ?? 0;
  if (isPast) {
    if (done === 0)              return 'red';
    if (done < totalHabits / 2)  return 'orange';
    if (done < totalHabits)      return 'yellow';
    return 'green';
  }
  if (isToday && done > 0) {
    if (done >= totalHabits)     return 'green';
    if (done < totalHabits / 2)  return 'orange';
    return 'yellow';
  }
  return 'neutral';
}

function buildTiles(duel, doneByDate, totalHabits) {
  const today = new Date().toISOString().split('T')[0];
  return [...Array(7)].map((_, i) => {
    const d = new Date(duel.week_start + 'T12:00:00');
    d.setDate(d.getDate() + i);
    const day = d.toISOString().split('T')[0];
    return {
      day,
      label:   DAY_LABELS[i],
      dateNum: d.getDate(),
      state:   tileState(day, today, doneByDate, totalHabits),
      isToday: day === today,
    };
  });
}

function weekLabel(weekStart) {
  return new Date(weekStart + 'T12:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ResultBadge({ result }) {
  if (!result) return null;
  const cls = result === 'W' ? 'cal-result--win'
            : result === 'L' ? 'cal-result--loss'
            : 'cal-result--draw';
  return <span className={`cal-result ${cls}`}>{result}</span>;
}

function WeekRow({ week }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="cal-week">
      <button className="cal-week__row" onClick={() => setExpanded(e => !e)}>
        <div className="cal-week__strip">
          {week.tiles.map(({ day, label, dateNum, state, isToday }) => (
            <div
              key={day}
              className={`calendar-tile calendar-tile--${state} cal-week__tile${isToday ? ' calendar-tile--today' : ''}`}
            >
              <span className="calendar-tile__label">{label}</span>
              <span className="calendar-tile__date">{dateNum}</span>
              {isToday && <span className="calendar-tile__arrow" aria-hidden="true">▼</span>}
            </div>
          ))}
        </div>
        <div className="cal-week__footer">
          <div className="cal-week__meta">
            <span className="cal-week__label">Week of {weekLabel(week.weekStart)}</span>
            {week.isPractice
              ? <span className="cal-week__opp">Practice week</span>
              : week.opponentName && <span className="cal-week__opp">vs {week.opponentName}</span>
            }
          </div>
          <div className="cal-week__right">
            {!week.isPractice && <ResultBadge result={week.result} />}
            <span className="cal-week__chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="cal-week__details">
          <div className="cal-week__detail-row">
            <span className="cal-week__detail-label">Your score</span>
            <span className="cal-week__detail-value">{week.myScore ?? '—'}</span>
          </div>
          {!week.isPractice && (
            <div className="cal-week__detail-row">
              <span className="cal-week__detail-label">{week.opponentName ?? 'Opponent'}</span>
              <span className="cal-week__detail-value">{week.oppScore ?? '—'}</span>
            </div>
          )}
          <div className="cal-week__detail-row">
            <span className="cal-week__detail-label">Total check-ins</span>
            <span className="cal-week__detail-value">{week.totalCheckins}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CalendarHistory() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [pageState, setPageState] = useState('loading');
  const [stats,     setStats]     = useState({ streak: 0, bestScore: 0, wins: 0, losses: 0, draws: 0 });
  const [weeks,     setWeeks]     = useState([]);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: duels } = await supabase
        .from('duels')
        .select(`
          id, week_start, week_end, status, winner_id, is_practice,
          user_a_id, user_b_id,
          user_a:profiles!duels_user_a_id_fkey(id, username),
          user_b:profiles!duels_user_b_id_fkey(id, username)
        `)
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .in('status', ['active', 'closed'])
        .order('week_start', { ascending: false });

      if (!duels?.length) { setPageState('empty'); return; }

      const duelIds = duels.map(d => d.id);

      const [
        { data: allScores },
        { data: myCheckins },
        { data: allCheckins },
        { data: myDuelHabits },
        { data: profile },
      ] = await Promise.all([
        supabase.from('scores').select('duel_id, user_id, total_points').in('duel_id', duelIds),
        supabase.from('check_ins').select('duel_id, checked_date').in('duel_id', duelIds).eq('user_id', user.id).eq('completed', true),
        supabase.from('check_ins').select('duel_id').in('duel_id', duelIds).eq('completed', true),
        supabase.from('duel_habits').select('duel_id, habit_id').in('duel_id', duelIds).eq('user_id', user.id),
        supabase.from('profiles').select('wins, losses').eq('id', user.id).single(),
      ]);

      // ── Build lookup maps ──────────────────────────────────

      const scoresByDuel = {};
      for (const s of allScores ?? []) {
        if (!scoresByDuel[s.duel_id]) scoresByDuel[s.duel_id] = {};
        if (s.user_id === user.id) scoresByDuel[s.duel_id].my  = s;
        else                       scoresByDuel[s.duel_id].opp = s;
      }

      const myDoneByDuel = {};
      for (const ci of myCheckins ?? []) {
        if (!myDoneByDuel[ci.duel_id]) myDoneByDuel[ci.duel_id] = {};
        myDoneByDuel[ci.duel_id][ci.checked_date] =
          (myDoneByDuel[ci.duel_id][ci.checked_date] ?? 0) + 1;
      }

      const totalByDuel = {};
      for (const ci of allCheckins ?? []) {
        totalByDuel[ci.duel_id] = (totalByDuel[ci.duel_id] ?? 0) + 1;
      }

      const habitsByDuel = {};
      for (const h of myDuelHabits ?? []) {
        habitsByDuel[h.duel_id] = (habitsByDuel[h.duel_id] ?? 0) + 1;
      }

      // ── Per-week data ──────────────────────────────────────

      const weekData = duels.map(duel => {
        const opp        = duel.user_a_id === user.id ? duel.user_b : duel.user_a;
        const scores     = scoresByDuel[duel.id] ?? {};
        const doneByDate = myDoneByDuel[duel.id] ?? {};
        const totalHabits = habitsByDuel[duel.id] ?? 0;

        let result = null;
        if (duel.status === 'closed') {
          result = !duel.winner_id ? 'D' : duel.winner_id === user.id ? 'W' : 'L';
        }

        return {
          duelId:       duel.id,
          weekStart:    duel.week_start,
          weekEnd:      duel.week_end,
          isPractice:   duel.is_practice,
          opponentName: opp?.username ?? null,
          result,
          myScore:       scores.my?.total_points  ?? null,
          oppScore:      scores.opp?.total_points ?? null,
          totalCheckins: totalByDuel[duel.id] ?? 0,
          tiles:         buildTiles(duel, doneByDate, totalHabits),
          doneByDate,
          totalHabits,
        };
      });

      // ── Global stats ──────────────────────────────────────

      const bestScore = weekData.reduce((max, w) => Math.max(max, w.myScore ?? 0), 0);
      const wins      = profile?.wins   ?? 0;
      const losses    = profile?.losses ?? 0;
      const draws     = duels.filter(d => d.status === 'closed' && !d.winner_id && !d.is_practice).length;

      // Green streak: consecutive days ending today, all habits done
      const today = new Date().toISOString().split('T')[0];
      let streak    = 0;
      let checkDate = today;

      for (let i = 0; i < 365; i++) {
        const week = weekData.find(w => w.weekStart <= checkDate && w.weekEnd >= checkDate);
        if (!week || week.totalHabits === 0) break;
        const done = week.doneByDate[checkDate] ?? 0;
        if (done < week.totalHabits) break;
        streak++;
        const prev = new Date(checkDate + 'T12:00:00');
        prev.setDate(prev.getDate() - 1);
        checkDate = prev.toISOString().split('T')[0];
      }

      setStats({ streak, bestScore, wins, losses, draws });
      setWeeks(weekData);
      setPageState('ready');
    }

    load();
  }, [user]);

  if (pageState === 'loading') {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  return (
    <div className="cal-history">
      <header className="cal-history__header">
        <button className="cal-history__back" onClick={() => navigate('/')} aria-label="Back">←</button>
        <h1 className="cal-history__title">Calendar</h1>
      </header>

      {pageState === 'empty' ? (
        <div className="page-empty">
          <p className="page-empty__text">Your journey starts this week</p>
          <p className="page-empty__sub">Come back Monday to see your history.</p>
        </div>
      ) : (
        <>
          <div className="cal-history__stats">
            <div className="cal-history__stat-card">
              <span className="cal-history__stat-value">{stats.streak}</span>
              <span className="cal-history__stat-label">day streak</span>
            </div>
            <div className="cal-history__stat-card">
              <span className="cal-history__stat-value">{stats.bestScore}</span>
              <span className="cal-history__stat-label">best week</span>
            </div>
            <div className="cal-history__stat-card">
              <span className="cal-history__stat-value">{stats.wins}·{stats.losses}·{stats.draws}</span>
              <span className="cal-history__stat-label">W · L · D</span>
            </div>
          </div>

          <div className="cal-history__weeks">
            {weeks.map(week => (
              <WeekRow key={week.duelId} week={week} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
