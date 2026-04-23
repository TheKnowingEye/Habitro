import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { shouldPromptSnapshot } from '../lib/scoring';
import HabitCheckItem from '../components/checkin/HabitCheckItem';
import SnapshotPrompt from '../components/checkin/SnapshotPrompt';
import Button from '../components/ui/Button';
import NotificationBell from '../components/ui/NotificationBell';

export default function CheckIn() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [duelId, setDuelId] = useState(null);
  const [isPractice, setIsPractice] = useState(false);
  const [duelHabits, setDuelHabits] = useState([]);
  // Live DB state: { [habit_id]: { completed: boolean, snapshot_url: string|null } }
  const [checkins, setCheckins] = useState({});
  // Days completed before today: { [habit_id]: number }
  const [weeklyProgress, setWeeklyProgress] = useState({});
  const [pageState, setPageState] = useState('loading'); // loading | ready | no-duel
  const [hasSnapshotToday, setHasSnapshotToday] = useState(false);
  // Habit waiting on snapshot decision (toggled to complete, upsert deferred)
  const [pendingSnapshotHabit, setPendingSnapshotHabit] = useState(null);
  const [error, setError] = useState(null);
  const [showExitToast, setShowExitToast] = useState(false);

  // Prevent a rapid double-tap from firing two concurrent upserts for the same habit
  const savingRef = useRef(new Set());

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: duel } = await supabase
        .from('duels')
        .select('id, is_practice')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .eq('status', 'active')
        .maybeSingle();

      if (!duel) { setPageState('no-duel'); return; }

      const { data: duelHabitData } = await supabase
        .from('duel_habits')
        .select('id, habit_id, target_frequency, habits(name)')
        .eq('duel_id', duel.id)
        .eq('user_id', user.id);

      if (!duelHabitData?.length) {
        navigate('/habits', { replace: true });
        return;
      }

      // Weekly progress — completed days before today (for progress bar)
      const weekStart = new Date(today + 'T00:00:00');
      weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
      const weekStartStr = weekStart.toISOString().split('T')[0];

      const [{ data: weekCheckins }, { data: todayCheckins }] = await Promise.all([
        supabase
          .from('check_ins')
          .select('habit_id')
          .eq('duel_id', duel.id)
          .eq('user_id', user.id)
          .eq('completed', true)
          .gte('checked_date', weekStartStr)
          .lt('checked_date', today),
        supabase
          .from('check_ins')
          .select('habit_id, completed, snapshot_url')
          .eq('duel_id', duel.id)
          .eq('user_id', user.id)
          .eq('checked_date', today),
      ]);

      const progress = {};
      for (const ci of weekCheckins ?? []) {
        progress[ci.habit_id] = (progress[ci.habit_id] ?? 0) + 1;
      }

      const checkinsMap = {};
      let snapshotExists = false;
      for (const ci of todayCheckins ?? []) {
        checkinsMap[ci.habit_id] = { completed: ci.completed, snapshot_url: ci.snapshot_url };
        if (ci.snapshot_url) snapshotExists = true;
      }

      setDuelId(duel.id);
      setIsPractice(duel.is_practice ?? false);
      setDuelHabits(duelHabitData);
      setCheckins(checkinsMap);
      setWeeklyProgress(progress);
      setHasSnapshotToday(snapshotExists);
      setPageState('ready');
    }

    load();
  }, [user, navigate, today]);

  // Low-level upsert — does NOT update local state (caller handles that)
  async function doUpsert(habit, completed, snapshotUrl = null) {
    const { error: err } = await supabase
      .from('check_ins')
      .upsert(
        {
          duel_id:      duelId,
          user_id:      user.id,
          habit_id:     habit.habit_id,
          checked_date: today,
          completed,
          solo:         isPractice,
          snapshot_url: snapshotUrl,
        },
        { onConflict: 'duel_id,user_id,habit_id,checked_date' }
      );

    if (err) {
      setError('Failed to save — tap the habit again to retry.');
      return false;
    }
    if (snapshotUrl) setHasSnapshotToday(true);
    return true;
  }

  async function handleToggle(habit) {
    if (savingRef.current.has(habit.habit_id)) return;

    const current = checkins[habit.habit_id]?.completed ?? false;
    const next    = !current;
    setError(null);

    // Optimistic UI update — reverted below if the upsert fails
    setCheckins((prev) => ({
      ...prev,
      [habit.habit_id]: {
        completed:    next,
        snapshot_url: next ? (prev[habit.habit_id]?.snapshot_url ?? null) : null,
      },
    }));

    // Toggling TO complete: maybe show snapshot prompt before upserting.
    // Only prompt if no snapshot exists today yet (never prompt twice).
    if (next && !hasSnapshotToday && shouldPromptSnapshot(habit.target_frequency)) {
      setPendingSnapshotHabit(habit);
      return; // upsert is deferred until handleSnapshotDecision
    }

    savingRef.current.add(habit.habit_id);
    const ok = await doUpsert(habit, next);
    savingRef.current.delete(habit.habit_id);

    if (!ok) {
      // Revert optimistic update on failure
      setCheckins((prev) => ({
        ...prev,
        [habit.habit_id]: { completed: current, snapshot_url: prev[habit.habit_id]?.snapshot_url ?? null },
      }));
    }
  }

  // Called by SnapshotPrompt: file = File object, or null if user skipped
  async function handleSnapshotDecision(file) {
    const habit = pendingSnapshotHabit;
    setPendingSnapshotHabit(null);

    let snapshotUrl = null;

    if (file) {
      const ext  = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${duelId}/${today}-${habit.habit_id.slice(0, 8)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('snapshots')
        .upload(path, file, { upsert: true });

      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('snapshots').getPublicUrl(path);
        snapshotUrl = publicUrl;
      } else {
        setError('Photo upload failed — check-in saved without snapshot.');
      }
    }

    savingRef.current.add(habit.habit_id);
    const ok = await doUpsert(habit, true, snapshotUrl);
    savingRef.current.delete(habit.habit_id);

    if (!ok) {
      // Revert the optimistic check if save failed
      setCheckins((prev) => ({
        ...prev,
        [habit.habit_id]: { completed: false, snapshot_url: null },
      }));
    } else {
      // Confirm snapshot_url in local state
      setCheckins((prev) => ({
        ...prev,
        [habit.habit_id]: { completed: true, snapshot_url: snapshotUrl },
      }));
    }
  }

  function handleDone() {
    setShowExitToast(true);
    setTimeout(() => navigate('/'), 900);
  }

  const completedCount = duelHabits.filter((h) => checkins[h.habit_id]?.completed).length;

  // ── Render states ─────────────────────────────────────────

  if (pageState === 'loading') {
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

  return (
    <div className="checkin-page">
      <header className="checkin-page__header">
        <div className="checkin-page__header-top">
          <h1 className="checkin-page__title">Today's Check-in</h1>
          <NotificationBell />
        </div>
        <p className="checkin-page__date">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
        <p className="checkin-page__autosave">Saves automatically</p>
      </header>

      <ul className="checkin-page__list" role="group" aria-label="Habits to check in">
        {duelHabits.map((h) => (
          <li key={h.id}>
            <HabitCheckItem
              habit={{ name: h.habits.name, target_frequency: h.target_frequency }}
              completed={checkins[h.habit_id]?.completed ?? false}
              onChange={() => handleToggle(h)}
              doneThisWeek={weeklyProgress[h.habit_id] ?? 0}
            />
          </li>
        ))}
      </ul>

      {error && <p className="form-error" role="alert">{error}</p>}

      <footer className="checkin-page__footer">
        <p className="checkin-page__tally">
          {completedCount} of {duelHabits.length} done today
        </p>
        <Button onClick={handleDone}>Done</Button>
      </footer>

      {showExitToast && (
        <div className="toast" role="status" aria-live="polite">
          Progress saved
        </div>
      )}

      {pendingSnapshotHabit && (
        <SnapshotPrompt
          onSubmit={handleSnapshotDecision}
          onSkip={() => handleSnapshotDecision(null)}
        />
      )}
    </div>
  );
}
