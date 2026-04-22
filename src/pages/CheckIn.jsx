import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { shouldPromptSnapshot } from '../lib/scoring';
import HabitCheckItem from '../components/checkin/HabitCheckItem';
import SnapshotPrompt from '../components/checkin/SnapshotPrompt';
import Button from '../components/ui/Button';

export default function CheckIn() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [duelId, setDuelId] = useState(null);
  // Habits still pending a check-in today: [{ id, habit_id, target_frequency, habits: { name } }]
  const [pending, setPending] = useState([]);
  // Habits already checked in this session (read-only display)
  const [alreadyDone, setAlreadyDone] = useState([]);
  // { [duelHabitId]: boolean } — true = completed, false = not completed
  const [completions, setCompletions] = useState({});
  const [pageState, setPageState] = useState('loading');
  // loading | ready | snapshot-prompt | uploading | submitting | done | no-duel
  const [error, setError] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) return;

    async function load() {
      // 1. Active duel only — users can't check in on a pending duel
      const { data: duel } = await supabase
        .from('duels')
        .select('id')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .eq('status', 'active')
        .maybeSingle();

      if (!duel) { setPageState('no-duel'); return; }

      // 2. User's habit selections for this duel
      const { data: duelHabits } = await supabase
        .from('duel_habits')
        .select('id, habit_id, target_frequency, habits(name)')
        .eq('duel_id', duel.id)
        .eq('user_id', user.id);

      if (!duelHabits?.length) {
        // No habits selected yet — redirect to selection
        navigate('/habits', { replace: true });
        return;
      }

      // 3. Which habits have already been checked in today?
      const { data: existing } = await supabase
        .from('check_ins')
        .select('habit_id')
        .eq('duel_id', duel.id)
        .eq('user_id', user.id)
        .eq('checked_date', today);

      const doneHabitIds = new Set((existing ?? []).map((c) => c.habit_id));

      const pendingHabits = duelHabits.filter((h) => !doneHabitIds.has(h.habit_id));
      const doneHabits    = duelHabits.filter((h) =>  doneHabitIds.has(h.habit_id));

      if (pendingHabits.length === 0) { setPageState('done'); return; }

      const initCompletions = {};
      pendingHabits.forEach((h) => { initCompletions[h.id] = false; });

      setDuelId(duel.id);
      setPending(pendingHabits);
      setAlreadyDone(doneHabits);
      setCompletions(initCompletions);
      setPageState('ready');
    }

    load();
  }, [user, navigate, today]);

  function toggle(duelHabitId) {
    setCompletions((prev) => ({ ...prev, [duelHabitId]: !prev[duelHabitId] }));
  }

  function handleSubmitIntent() {
    const completedHabits = pending.filter((h) => completions[h.id]);
    // Snapshot prompt: check the habit with the highest target frequency among completed ones
    const maxFreq = completedHabits.reduce((max, h) => Math.max(max, h.target_frequency), 0);

    if (completedHabits.length > 0 && shouldPromptSnapshot(maxFreq)) {
      setPageState('snapshot-prompt');
    } else {
      doSubmit(null);
    }
  }

  async function doSubmit(snapshotUrl) {
    setPageState('submitting');
    setError(null);

    const rows = pending.map((h) => ({
      duel_id:       duelId,
      user_id:       user.id,
      habit_id:      h.habit_id,
      checked_date:  today,
      completed:     completions[h.id] ?? false,
      // Only attach snapshot to completed habits so the opponent sees relevant evidence
      snapshot_url:  completions[h.id] ? snapshotUrl : null,
    }));

    const { error: err } = await supabase.from('check_ins').insert(rows);

    if (err) {
      setError(err.message);
      setPageState('ready');
      return;
    }

    setPageState('done');
  }

  async function handleSnapshotUpload(file) {
    if (!file) { doSubmit(null); return; }

    setPageState('uploading');

    const ext  = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${duelId}/${today}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('snapshots')
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      // Non-fatal: submit without the snapshot rather than blocking the check-in
      setError('Photo upload failed — check-in saved without snapshot.');
      doSubmit(null);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('snapshots')
      .getPublicUrl(path);

    doSubmit(publicUrl);
  }

  const completedCount = Object.values(completions).filter(Boolean).length;
  const isSubmitting   = pageState === 'submitting' || pageState === 'uploading';

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

  if (pageState === 'done') {
    return (
      <div className="page-empty">
        <div className="checkin-done-icon" aria-hidden="true">✓</div>
        <p className="page-empty__text">All done for today.</p>
        <p className="page-empty__sub">Come back tomorrow to keep the streak alive.</p>
      </div>
    );
  }

  return (
    <div className="checkin-page">
      <header className="checkin-page__header">
        <h1 className="checkin-page__title">Today's Check-in</h1>
        <p className="checkin-page__date">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </header>

      {alreadyDone.length > 0 && (
        <section className="checkin-already-done" aria-label="Already logged today">
          <p className="checkin-section-label">Already logged</p>
          {alreadyDone.map((h) => (
            <div key={h.id} className="check-item check-item--locked">
              <div className="check-item__circle check-item__circle--done" aria-hidden="true">✓</div>
              <div className="check-item__info">
                <span className="check-item__name">{h.habits.name}</span>
              </div>
            </div>
          ))}
        </section>
      )}

      <ul className="checkin-page__list" role="group" aria-label="Habits to check in">
        {pending.map((h) => (
          <li key={h.id}>
            <HabitCheckItem
              habit={{ name: h.habits.name, target_frequency: h.target_frequency }}
              completed={completions[h.id] ?? false}
              onChange={() => toggle(h.id)}
            />
          </li>
        ))}
      </ul>

      {error && <p className="form-error" role="alert">{error}</p>}

      <footer className="checkin-page__footer">
        <p className="checkin-page__tally">
          {completedCount} of {pending.length} marked complete
        </p>
        <Button onClick={handleSubmitIntent} disabled={isSubmitting} loading={isSubmitting}>
          {isSubmitting ? 'Submitting…' : 'Submit Check-in'}
        </Button>
      </footer>

      {pageState === 'snapshot-prompt' && (
        <SnapshotPrompt
          onSubmit={handleSnapshotUpload}
          onSkip={() => doSubmit(null)}
        />
      )}
    </div>
  );
}
