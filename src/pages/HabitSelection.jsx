import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { HABIT_CATEGORIES } from '../constants/habits';
import HabitCard from '../components/checkin/HabitCard';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

const MAX_HABITS = 5;
const categoryMap = Object.fromEntries(HABIT_CATEGORIES.map((c) => [c.id, c]));

function getWeekStart(todayStr) {
  const d = new Date(todayStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

export default function HabitSelection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [habits, setHabits] = useState([]);
  const [duel, setDuel] = useState(null);
  // { [habitUUID]: targetFrequency }
  const [selections, setSelections] = useState({});
  const [pageState, setPageState] = useState('loading');
  // loading | selecting | saving | locked | already-selected | no-duel
  const [error, setError] = useState(null);
  const [existingHabits, setExistingHabits] = useState([]);
  const [weekProgress, setWeekProgress] = useState({});
  const [showToast, setShowToast] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: duelData, error: duelErr } = await supabase
        .from('duels')
        .select('id, status, is_practice')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .in('status', ['pending', 'active'])
        .maybeSingle();

      if (duelErr || !duelData) { setPageState('no-duel'); return; }

      // If habits already chosen, show read-only summary then redirect
      const { data: existing } = await supabase
        .from('duel_habits')
        .select('id, habit_id, target_frequency, habits(name, category)')
        .eq('duel_id', duelData.id)
        .eq('user_id', user.id);

      if (existing?.length > 0) {
        const weekStart = getWeekStart(today);
        const { data: checkins } = await supabase
          .from('check_ins')
          .select('habit_id')
          .eq('duel_id', duelData.id)
          .eq('user_id', user.id)
          .eq('completed', true)
          .gte('checked_date', weekStart)
          .lte('checked_date', today);

        const progress = {};
        for (const ci of checkins ?? []) {
          progress[ci.habit_id] = (progress[ci.habit_id] ?? 0) + 1;
        }
        setExistingHabits(existing);
        setWeekProgress(progress);
        setPageState('already-selected');
        return;
      }

      const { data: habitData, error: habitErr } = await supabase
        .from('habits')
        .select('*');

      if (habitErr || !habitData?.length) {
        setError('Failed to load habits. Please refresh.');
        setPageState('selecting');
        return;
      }

      const categoryOrder = HABIT_CATEGORIES.map((c) => c.id);
      const sorted = [...habitData].sort(
        (a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
      );

      setDuel(duelData);
      setHabits(sorted);
      setPageState('selecting');
    }

    load();
  }, [user, today]);

  // Already-selected: show toast then redirect after 2 s
  useEffect(() => {
    if (pageState !== 'already-selected') return;
    const toastTimer    = setTimeout(() => setShowToast(true), 800);
    const redirectTimer = setTimeout(() => navigate('/', { replace: true }), 2200);
    return () => { clearTimeout(toastTimer); clearTimeout(redirectTimer); };
  }, [pageState, navigate]);

  // Locked: navigate after flash animation finishes
  useEffect(() => {
    if (pageState !== 'locked') return;
    const timer = setTimeout(() => navigate('/'), 750);
    return () => clearTimeout(timer);
  }, [pageState, navigate]);

  function toggleHabit(habit) {
    const minFreq = categoryMap[habit.category]?.minFreq ?? 1;
    setSelections((prev) => {
      if (prev[habit.id] !== undefined) {
        const next = { ...prev };
        delete next[habit.id];
        return next;
      }
      if (Object.keys(prev).length >= MAX_HABITS) return prev;
      return { ...prev, [habit.id]: minFreq };
    });
  }

  function setFrequency(habitId, freq) {
    setSelections((prev) => ({ ...prev, [habitId]: freq }));
  }

  async function handleSubmit() {
    if (selectedCount < 1) return;
    setPageState('saving');
    setError(null);

    const rows = Object.entries(selections).map(([habitId, freq]) => ({
      duel_id:          duel.id,
      user_id:          user.id,
      habit_id:         habitId,
      target_frequency: freq,
    }));

    const { error: err } = await supabase.from('duel_habits').insert(rows);

    if (err) {
      setError(err.message);
      setPageState('selecting');
      return;
    }

    setPageState('locked');
  }

  const selectedCount  = Object.keys(selections).length;
  const selectedHabits = habits.filter((h) => selections[h.id] !== undefined);

  // ── Render states ─────────────────────────────────────────

  if (pageState === 'loading') {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  if (pageState === 'locked') {
    return (
      <div className="lockin-flash" aria-live="assertive">
        <div className="lockin-flash__icon" aria-hidden="true">✓</div>
        <p className="lockin-flash__text">Committed.</p>
      </div>
    );
  }

  if (pageState === 'no-duel') {
    return (
      <div className="page-empty">
        <p className="page-empty__text">No active duel yet.</p>
        <p className="page-empty__sub">New matchups begin every Monday.</p>
      </div>
    );
  }

  if (pageState === 'already-selected') {
    return (
      <div className="habit-selection">
        {showToast && (
          <div className="toast" role="status" aria-live="polite">
            Habits locked for this week
          </div>
        )}
        <header className="habit-selection__header">
          <h1 className="habit-selection__title">Your Habits This Week</h1>
          <p className="habit-selection__subtitle">Redirecting to dashboard…</p>
        </header>
        <ul className="habit-already__list">
          {existingHabits.map((h) => {
            const cat  = categoryMap[h.habits?.category] ?? {};
            const done = weekProgress[h.habit_id] ?? 0;
            return (
              <li key={h.id} className="habit-already__item">
                <span className="habit-already__emoji" aria-hidden="true">{cat.icon ?? '🎯'}</span>
                <div className="habit-already__info">
                  <span className="habit-already__name">{h.habits.name}</span>
                  <span className="habit-already__progress">{done} / {h.target_frequency} days done</span>
                </div>
                <div className="habit-already__segments" aria-hidden="true">
                  {Array.from({ length: h.target_frequency }, (_, i) => (
                    <div key={i} className={`habit-already__seg${i < done ? ' habit-already__seg--filled' : ''}`} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // Main selection view
  return (
    <div className="habit-selection">
      {duel?.is_practice && (
        <div className="dashboard__practice-banner" role="note">
          <span className="dashboard__practice-icon" aria-hidden="true">🏋️</span>
          <span>Practice week — no rank is on the line yet. Pick the habits you want to commit to.</span>
        </div>
      )}

      <header className="habit-selection__header">
        <h1 className="habit-selection__title">Choose Your Habits</h1>
        <p className="habit-selection__subtitle">Pick 1–5 habits to track against your opponent</p>
        <Badge variant={selectedCount > 0 ? 'active' : 'default'}>
          {selectedCount} / {MAX_HABITS} selected
        </Badge>
      </header>

      <ul className="habit-selection__list" role="group" aria-label="Available habits">
        {habits.map((habit) => {
          const cat        = categoryMap[habit.category] ?? {};
          const isSelected = selections[habit.id] !== undefined;
          const isDisabled = !isSelected && selectedCount >= MAX_HABITS;
          return (
            <li
              key={habit.id}
              className={`habit-selection__item${isSelected ? ' habit-selection__item--selected' : ''}`}
            >
              <HabitCard
                habit={habit}
                icon={cat.icon ?? '🎯'}
                minFreq={cat.minFreq ?? 1}
                maxFreq={cat.maxFreq ?? 7}
                selected={isSelected}
                frequency={selections[habit.id]}
                disabled={isDisabled}
                onToggle={() => toggleHabit(habit)}
                onFrequencyChange={(f) => setFrequency(habit.id, f)}
              />
            </li>
          );
        })}
      </ul>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="habit-summary-panel">
        {selectedCount === 0 ? (
          <p className="habit-summary-panel__empty">Select at least one habit to get started</p>
        ) : (
          <ul className="habit-summary-panel__chips" aria-label="Selected habits">
            {selectedHabits.map((h) => {
              const cat = categoryMap[h.category] ?? {};
              return (
                <li key={h.id} className="habit-summary-chip">
                  <span aria-hidden="true">{cat.icon ?? '🎯'}</span>
                  <span>{h.name}</span>
                  <span className="habit-summary-chip__freq">{selections[h.id]}×</span>
                </li>
              );
            })}
          </ul>
        )}
        <Button
          onClick={handleSubmit}
          disabled={selectedCount < 1 || pageState === 'saving'}
          loading={pageState === 'saving'}
        >
          {pageState === 'saving' ? 'Locking in…' : 'Lock in and start →'}
        </Button>
      </div>
    </div>
  );
}
