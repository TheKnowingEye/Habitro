import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { darken } from '../../lib/darken';
import { toLocalDateStr } from '../../lib/dates';

const CATEGORY_ICON = {
  fitness:    '🏋️',
  study:      '📚',
  deep_work:  '💻',
  sleep:      '😴',
  meditation: '🧘',
  diet:       '🥗',
  reading:    '📖',
  cold_shower:'🚿',
  walking:    '🚶',
  hydration:  '💧',
};

const MAX = 5;

export default function HabitSetupModal({ duel, dark, accent, onDone }) {
  const { user } = useAuth();
  const [pageState, setPageState] = useState('loading');
  const [allHabits, setAllHabits] = useState([]);
  const [selections, setSelections] = useState({});
  const [carried, setCarried] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !duel) return;

    async function load() {
      const { data: habits } = await supabase
        .from('habits')
        .select('*')
        .order('category');

      // Carry forward from last week
      const lastMon = new Date(duel.week_start + 'T00:00:00');
      lastMon.setDate(lastMon.getDate() - 7);
      const lastMonStr = toLocalDateStr(lastMon);

      const { data: lastDuel } = await supabase
        .from('duels')
        .select('id')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .eq('week_start', lastMonStr)
        .eq('is_practice', false)
        .maybeSingle();

      let init = {};
      if (lastDuel) {
        const { data: lastHabits } = await supabase
          .from('duel_habits')
          .select('habit_id, target_frequency')
          .eq('duel_id', lastDuel.id)
          .eq('user_id', user.id);
        for (const h of lastHabits ?? []) init[h.habit_id] = h.target_frequency;
        if (Object.keys(init).length) setCarried(true);
      }

      setAllHabits(habits ?? []);
      setSelections(init);
      setPageState('ready');
    }

    load();
  }, [user, duel]);

  async function handleConfirm() {
    const entries = Object.entries(selections);
    if (!entries.length || saving) return;
    setSaving(true);
    await supabase.from('duel_habits').insert(
      entries.map(([habit_id, target_frequency]) => ({
        duel_id: duel.id, user_id: user.id, habit_id, target_frequency,
      }))
    );
    onDone();
  }

  function toggle(habit) {
    setSelections(prev => {
      if (prev[habit.id] !== undefined) {
        const { [habit.id]: _, ...rest } = prev;
        return rest;
      }
      if (Object.keys(prev).length >= MAX) return prev;
      return { ...prev, [habit.id]: habit.min_frequency ?? 1 };
    });
  }

  function nudge(habitId, delta) {
    const h   = allHabits.find(h => h.id === habitId);
    const min = h?.min_frequency ?? 1;
    const max = h?.max_frequency ?? 7;
    setSelections(prev => ({
      ...prev,
      [habitId]: Math.min(max, Math.max(min, (prev[habitId] ?? min) + delta)),
    }));
  }

  const selectedHabits   = allHabits.filter(h => selections[h.id] !== undefined);
  const availableHabits  = allHabits.filter(h => selections[h.id] === undefined);
  const selectedCount    = selectedHabits.length;
  const canAdd           = selectedCount < MAX;

  const border = dark ? 'rgba(78,94,133,0.45)' : 'rgba(62,47,36,0.15)';
  const muted  = dark ? 'rgba(184,174,152,0.45)' : 'rgba(62,47,36,0.38)';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      {/* Sheet */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: dark ? '#1A2036' : '#FBF4E6',
        borderRadius: '12px 12px 0 0',
        border: `1px solid ${border}`, borderBottom: 'none',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: dark ? 'rgba(184,174,152,0.28)' : 'rgba(62,47,36,0.18)', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '4px 16px 10px', borderBottom: `1px solid ${border}`, flexShrink: 0,
        }}>
          <div>
            <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', fontWeight: 700, color: accent, letterSpacing: '0.12em' }}>
              // WEEKLY QUESTS
            </span>
            {carried && (
              <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '7px', color: muted, letterSpacing: '0.08em', marginTop: 3 }}>
                CARRIED FROM LAST WEEK · ADJUST BELOW
              </div>
            )}
          </div>
          <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '8px', color: muted, letterSpacing: '0.1em' }}>
            {selectedCount}/{MAX}
          </span>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {pageState === 'loading' ? (
            <div style={{ padding: 32, textAlign: 'center', fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: muted, letterSpacing: '0.1em' }}>
              LOADING...
            </div>
          ) : (
            <>
              {/* Selected habits */}
              {selectedHabits.length > 0 && (
                <>
                  <div style={{ padding: '10px 16px 4px', fontFamily: '"Silkscreen",monospace', fontSize: '7px', color: accent, letterSpacing: '0.12em' }}>
                    SELECTED
                  </div>
                  {selectedHabits.map(habit => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      selected
                      freq={selections[habit.id]}
                      dark={dark}
                      accent={accent}
                      onToggle={() => toggle(habit)}
                      onNudge={d => nudge(habit.id, d)}
                    />
                  ))}
                </>
              )}

              {/* Available habits */}
              {availableHabits.length > 0 && (
                <>
                  <div style={{ padding: '12px 16px 4px', fontFamily: '"Silkscreen",monospace', fontSize: '7px', color: muted, letterSpacing: '0.12em' }}>
                    {selectedHabits.length > 0 ? 'ADD MORE' : 'CHOOSE YOUR HABITS'}
                  </div>
                  {availableHabits.map(habit => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      selected={false}
                      disabled={!canAdd}
                      dark={dark}
                      accent={accent}
                      onToggle={() => toggle(habit)}
                    />
                  ))}
                </>
              )}
              <div style={{ height: 8 }} />
            </>
          )}
        </div>

        {/* Confirm button */}
        <div style={{ padding: '12px 16px 16px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0 || saving}
            style={{
              width: '100%', padding: '14px 0',
              background: selectedCount > 0 ? accent : (dark ? 'rgba(78,94,133,0.25)' : 'rgba(62,47,36,0.1)'),
              border: 'none', borderRadius: 4, cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
              fontFamily: '"Silkscreen",monospace', fontSize: '11px', fontWeight: 700,
              color: selectedCount > 0 ? '#FBF4E6' : muted,
              letterSpacing: '0.1em',
              boxShadow: selectedCount > 0 ? `0 4px 0 ${darken(accent, 0.35)}` : 'none',
              transition: 'background 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            {saving ? 'SAVING...' : selectedCount === 0 ? 'SELECT AT LEAST 1 HABIT' : `CONFIRM ${selectedCount} QUEST${selectedCount > 1 ? 'S' : ''} ▶`}
          </button>
        </div>
      </div>
    </div>
  );
}

function HabitRow({ habit, selected, disabled, freq, dark, accent, onToggle, onNudge }) {
  const icon  = CATEGORY_ICON[habit.category] ?? '🎯';
  const muted = dark ? 'rgba(184,174,152,0.45)' : 'rgba(62,47,36,0.38)';
  const border = dark ? 'rgba(78,94,133,0.2)' : 'rgba(62,47,36,0.08)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px',
      borderBottom: `1px solid ${border}`,
      background: selected ? (dark ? `${accent}0D` : `${accent}0A`) : 'transparent',
      borderLeft: `3px solid ${selected ? accent : 'transparent'}`,
      opacity: disabled ? 0.4 : 1,
      transition: 'background 0.15s ease',
    }}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        disabled={disabled && !selected}
        style={{
          width: 22, height: 22, flexShrink: 0,
          background: selected ? accent : 'transparent',
          border: `2px solid ${selected ? accent : (dark ? 'rgba(184,174,152,0.35)' : 'rgba(62,47,36,0.3)')}`,
          borderRadius: 2, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
        }}
      >
        {selected && (
          <svg width="10" height="8" viewBox="0 0 10 8" shapeRendering="crispEdges">
            <polyline points="1,4 4,7 9,1" fill="none" stroke="#FBF4E6" strokeWidth="2" />
          </svg>
        )}
      </button>

      {/* Icon + name */}
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: '"Silkscreen",monospace', fontSize: '9px',
          color: selected ? (dark ? '#F4ECD8' : '#3E2F24') : muted,
          letterSpacing: '0.06em',
          textDecoration: 'none',
        }}>
          {habit.name?.toUpperCase()}
        </div>
        {selected && (
          <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '7px', color: muted, letterSpacing: '0.06em', marginTop: 2 }}>
            {freq}×/WK
          </div>
        )}
      </div>

      {/* Frequency stepper (selected only) */}
      {selected && onNudge && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onNudge(-1)}
            style={{ width: 24, height: 24, background: dark ? 'rgba(78,94,133,0.35)' : 'rgba(62,47,36,0.1)', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: '"Silkscreen",monospace', fontSize: '12px', color: dark ? '#F4ECD8' : '#3E2F24', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >−</button>
          <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', color: accent, minWidth: 14, textAlign: 'center' }}>{freq}</span>
          <button
            onClick={() => onNudge(+1)}
            style={{ width: 24, height: 24, background: dark ? 'rgba(78,94,133,0.35)' : 'rgba(62,47,36,0.1)', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: '"Silkscreen",monospace', fontSize: '12px', color: dark ? '#F4ECD8' : '#3E2F24', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >+</button>
        </div>
      )}
    </div>
  );
}
