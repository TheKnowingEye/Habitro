import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { HABIT_CATEGORIES } from '../constants/habits';
import HabitCard from '../components/checkin/HabitCard';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

const MAX_HABITS = 5;

export default function HabitSelection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [habits, setHabits] = useState([]);
  const [duel, setDuel] = useState(null);
  // { [habitUUID]: targetFrequency }
  const [selections, setSelections] = useState({});
  const [pageState, setPageState] = useState('loading'); // loading | selecting | saving | no-duel
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;

    async function load() {
      // 1. Find this user's pending or active duel
      const { data: duelData, error: duelErr } = await supabase
        .from('duels')
        .select('id, status')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .in('status', ['pending', 'active'])
        .maybeSingle();

      if (duelErr || !duelData) {
        setPageState('no-duel');
        return;
      }

      // 2. If habits already chosen for this duel, go straight to dashboard
      const { data: existing } = await supabase
        .from('duel_habits')
        .select('id')
        .eq('duel_id', duelData.id)
        .eq('user_id', user.id)
        .limit(1);

      if (existing?.length > 0) {
        navigate('/', { replace: true });
        return;
      }

      // 3. Fetch habits from DB so we use real UUIDs for inserts
      const { data: habitData, error: habitErr } = await supabase
        .from('habits')
        .select('*');

      if (habitErr || !habitData?.length) {
        setError('Failed to load habits. Please refresh.');
        setPageState('selecting');
        return;
      }

      // Sort to match the canonical order in HABIT_CATEGORIES
      const categoryOrder = HABIT_CATEGORIES.map((c) => c.id);
      const sorted = [...habitData].sort(
        (a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
      );

      setDuel(duelData);
      setHabits(sorted);
      setPageState('selecting');
    }

    load();
  }, [user, navigate]);

  function toggleHabit(habit) {
    setSelections((prev) => {
      if (prev[habit.id] !== undefined) {
        const next = { ...prev };
        delete next[habit.id];
        return next;
      }
      if (Object.keys(prev).length >= MAX_HABITS) return prev;
      return { ...prev, [habit.id]: habit.min_frequency };
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
      duel_id: duel.id,
      user_id: user.id,
      habit_id: habitId,
      target_frequency: freq,
    }));

    const { error: err } = await supabase.from('duel_habits').insert(rows);

    if (err) {
      setError(err.message);
      setPageState('selecting');
      return;
    }

    navigate('/');
  }

  const selectedCount = Object.keys(selections).length;

  if (pageState === 'loading') {
    return (
      <div className="page-loading">
        <div className="spinner" />
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

  return (
    <div className="habit-selection">
      <header className="habit-selection__header">
        <h1 className="habit-selection__title">Choose Your Habits</h1>
        <p className="habit-selection__subtitle">Track 1–5 habits this week against your opponent</p>
        <Badge variant={selectedCount > 0 ? 'active' : 'default'}>
          {selectedCount} / {MAX_HABITS} selected
        </Badge>
      </header>

      <ul className="habit-selection__list" role="group" aria-label="Available habits">
        {habits.map((habit) => (
          <li key={habit.id}>
            <HabitCard
              habit={habit}
              selected={selections[habit.id] !== undefined}
              frequency={selections[habit.id]}
              disabled={selections[habit.id] === undefined && selectedCount >= MAX_HABITS}
              onToggle={() => toggleHabit(habit)}
              onFrequencyChange={(f) => setFrequency(habit.id, f)}
            />
          </li>
        ))}
      </ul>

      {error && <p className="form-error" role="alert">{error}</p>}

      <footer className="habit-selection__footer">
        <Button
          onClick={handleSubmit}
          disabled={selectedCount < 1 || pageState === 'saving'}
          loading={pageState === 'saving'}
        >
          {pageState === 'saving' ? 'Saving…' : 'Lock In Habits →'}
        </Button>
      </footer>
    </div>
  );
}
