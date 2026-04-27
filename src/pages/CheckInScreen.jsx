import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import PixelCard from '../components/ui/PixelCard';
import ProofModal from '../components/ui/ProofModal';
import { darken } from '../lib/darken';
import { toLocalDateStr } from '../lib/dates';

function xpForHabit(targetFreq) {
  return (targetFreq || 1) * 3;
}

// ── Quest card ────────────────────────────────────────────────────
function QuestCard({ habit, done, hasProof, weekDays, dark, accent, onToggle, onProof }) {
  const name = habit.habits?.name ?? 'Habit';
  const xp   = xpForHabit(habit.target_frequency);

  return (
    <div style={{
      position: 'relative',
      background: done
        ? (dark ? 'rgba(30,38,64,0.92)' : 'rgba(251,244,230,0.97)')
        : (dark ? 'rgba(20,26,46,0.6)' : 'rgba(251,244,230,0.6)'),
      border: `1px solid ${done
        ? (dark ? `${accent}55` : `${accent}77`)
        : (dark ? 'rgba(78,94,133,0.42)' : 'rgba(62,47,36,0.15)')}`,
      borderRadius: 4,
      padding: '12px 14px',
      boxShadow: done
        ? `0 3px 0 ${darken(accent, 0.44)}`
        : `0 2px 0 ${dark ? '#0E1220' : 'rgba(62,47,36,0.13)'}`,
      transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
    }}>
      {/* Left accent bar when done */}
      {done && (
        <div style={{
          position: 'absolute', left: 0, top: 8, bottom: 8,
          width: 3, background: accent,
          borderRadius: '0 2px 2px 0',
          boxShadow: `1px 0 0 ${darken(accent, 0.4)}`,
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

        {/* Pixel checkbox */}
        <button
          onClick={onToggle}
          style={{
            width: 28, height: 28, flexShrink: 0,
            background: done ? accent : 'transparent',
            border: `2px solid ${done
              ? darken(accent, 0.22)
              : (dark ? 'rgba(184,174,152,0.36)' : 'rgba(62,47,36,0.26)')}`,
            borderRadius: 2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: done ? `0 2px 0 ${darken(accent, 0.48)}` : 'none',
            transition: 'background 0.15s ease, border-color 0.15s ease',
          }}
        >
          {done && (
            <svg width="14" height="12" viewBox="0 0 14 12" shapeRendering="crispEdges">
              <rect x="0"  y="6"  width="2" height="2" fill="#FBF4E6"/>
              <rect x="2"  y="8"  width="2" height="2" fill="#FBF4E6"/>
              <rect x="4"  y="10" width="2" height="2" fill="#FBF4E6"/>
              <rect x="6"  y="8"  width="2" height="2" fill="#FBF4E6"/>
              <rect x="8"  y="6"  width="2" height="2" fill="#FBF4E6"/>
              <rect x="10" y="4"  width="2" height="2" fill="#FBF4E6"/>
              <rect x="12" y="2"  width="2" height="2" fill="#FBF4E6"/>
            </svg>
          )}
        </button>

        {/* Name column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: '"Silkscreen",monospace', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: done
              ? (dark ? '#F4ECD8' : '#3E2F24')
              : (dark ? 'rgba(244,236,216,0.45)' : 'rgba(62,47,36,0.4)'),
            textDecoration: done ? 'line-through' : 'none',
            textDecorationColor: done ? (dark ? `${accent}88` : `${accent}99`) : 'transparent',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            transition: 'color 0.2s ease',
          }}>
            {name}
          </div>

          {/* Week streak badge */}
          {weekDays > 0 && (
            <div style={{ marginTop: 5, display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{
                fontFamily: '"Silkscreen",monospace', fontSize: '7px', letterSpacing: '0.08em',
                padding: '2px 5px',
                background: dark ? 'rgba(232,196,120,0.1)' : 'rgba(201,125,96,0.08)',
                border: `1px solid ${dark ? 'rgba(232,196,120,0.25)' : 'rgba(201,125,96,0.2)'}`,
                borderRadius: 2, color: dark ? '#E8C478' : '#C97D60',
              }}>
                🔥 {weekDays}d
              </span>
              {hasProof && (
                <span style={{
                  fontFamily: '"Silkscreen",monospace', fontSize: '7px', letterSpacing: '0.08em',
                  padding: '2px 5px',
                  background: 'rgba(107,142,90,0.12)',
                  border: '1px solid rgba(107,142,90,0.26)',
                  borderRadius: 2, color: '#6B8E5A',
                }}>
                  📷
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right column: XP + PROOF button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <span style={{
            fontFamily: '"Silkscreen",monospace', fontSize: '11px', fontWeight: 700,
            color: done ? accent : (dark ? 'rgba(184,174,152,0.35)' : 'rgba(62,47,36,0.25)'),
            letterSpacing: '0.06em',
            transition: 'color 0.2s ease',
          }}>
            +{xp} XP
          </span>

          {done && !hasProof && (
            <button
              onClick={onProof}
              style={{
                background: 'none',
                border: `1px solid ${dark ? 'rgba(78,94,133,0.5)' : 'rgba(62,47,36,0.22)'}`,
                borderRadius: 3, padding: '4px 8px', cursor: 'pointer',
                fontFamily: '"Silkscreen",monospace', fontSize: '7px',
                color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.08em',
              }}
            >
              PROOF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────
export default function CheckInScreen({ theme, dark, accent }) {
  const { user } = useAuth();

  const [pageState,      setPageState]      = useState('loading');
  const [duelId,         setDuelId]         = useState(null);
  const [isPractice,     setIsPractice]     = useState(false);
  const [duelHabits,     setDuelHabits]     = useState([]);
  const [checkins,       setCheckins]       = useState({});
  const [weeklyProgress, setWeeklyProgress] = useState({});
  const [proofHabit,     setProofHabit]     = useState(null);
  const [uploading,      setUploading]      = useState(false);

  const savingRef = useRef(new Set());
  const today     = toLocalDateStr();

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

      if (!duelHabitData?.length) { setPageState('no-habits'); return; }

      // Monday of this week (local time)
      const _now = new Date();
      const _wd  = new Date(_now);
      _wd.setDate(_now.getDate() - ((_now.getDay() + 6) % 7));
      const weekStartStr = toLocalDateStr(_wd);

      const [{ data: weekCheckins }, { data: todayCheckins }] = await Promise.all([
        supabase.from('check_ins')
          .select('habit_id')
          .eq('duel_id', duel.id)
          .eq('user_id', user.id)
          .eq('completed', true)
          .gte('checked_date', weekStartStr)
          .lt('checked_date', today),
        supabase.from('check_ins')
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
      for (const ci of todayCheckins ?? []) {
        checkinsMap[ci.habit_id] = { completed: ci.completed, snapshot_url: ci.snapshot_url };
      }

      setDuelId(duel.id);
      setIsPractice(duel.is_practice ?? false);
      setDuelHabits(duelHabitData);
      setCheckins(checkinsMap);
      setWeeklyProgress(progress);
      setPageState('ready');
    }

    load();
  }, [user]);

  async function handleToggle(habit) {
    if (savingRef.current.has(habit.habit_id)) return;

    const current = checkins[habit.habit_id]?.completed ?? false;
    const next    = !current;

    // Optimistic update
    setCheckins(prev => ({
      ...prev,
      [habit.habit_id]: { completed: next, snapshot_url: next ? (prev[habit.habit_id]?.snapshot_url ?? null) : null },
    }));

    savingRef.current.add(habit.habit_id);
    const { error: err } = await supabase.from('check_ins').upsert(
      { duel_id: duelId, user_id: user.id, habit_id: habit.habit_id, checked_date: today, completed: next, solo: isPractice },
      { onConflict: 'duel_id,user_id,habit_id,checked_date' }
    );
    savingRef.current.delete(habit.habit_id);

    if (err) {
      // Revert
      setCheckins(prev => ({
        ...prev,
        [habit.habit_id]: { completed: current, snapshot_url: prev[habit.habit_id]?.snapshot_url ?? null },
      }));
      return;
    }

    // Always open proof modal when marking complete
    if (next) setProofHabit(habit);
  }

  async function handleProofSubmit({ file, caption }) {
    const habit = proofHabit;
    setProofHabit(null);

    if (!file && !caption) return;

    setUploading(true);
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
      }
    }

    await supabase.from('check_ins')
      .update({ snapshot_url: snapshotUrl, note: caption || null })
      .eq('duel_id', duelId)
      .eq('user_id', user.id)
      .eq('habit_id', habit.habit_id)
      .eq('checked_date', today);

    if (snapshotUrl) {
      setCheckins(prev => ({
        ...prev,
        [habit.habit_id]: { ...prev[habit.habit_id], snapshot_url: snapshotUrl },
      }));
    }
    setUploading(false);
  }

  // ── States ────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.1em' }}>
          LOADING...
        </span>
      </div>
    );
  }

  if (pageState === 'no-duel') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, textAlign: 'center' }}>
        <span style={{ fontSize: 40 }}>📋</span>
        <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '11px', color: dark ? '#F4ECD8' : '#3E2F24', letterSpacing: '0.08em' }}>NO ACTIVE QUESTS</span>
        <span style={{ fontSize: '13px', color: dark ? '#B8AE98' : '#7A6555', lineHeight: 1.5 }}>Join a duel to unlock daily quests.</span>
      </div>
    );
  }

  if (pageState === 'no-habits') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, textAlign: 'center' }}>
        <span style={{ fontSize: 40 }}>⚙️</span>
        <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '11px', color: dark ? '#F4ECD8' : '#3E2F24', letterSpacing: '0.08em' }}>NO HABITS SET</span>
        <span style={{ fontSize: '13px', color: dark ? '#B8AE98' : '#7A6555', lineHeight: 1.5 }}>Set your habits to begin the duel.</span>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────
  const completedCount = duelHabits.filter(h => checkins[h.habit_id]?.completed).length;
  const totalCount     = duelHabits.length;
  const xpEarned       = duelHabits.filter(h => checkins[h.habit_id]?.completed).reduce((s, h) => s + xpForHabit(h.target_frequency), 0);
  const xpTotal        = duelHabits.reduce((s, h) => s + xpForHabit(h.target_frequency), 0);
  const allComplete    = completedCount === totalCount && totalCount > 0;
  const progressPct    = xpTotal > 0 ? (xpEarned / xpTotal) * 100 : 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 14px 12px',
        borderBottom: `1px solid ${dark ? 'rgba(78,94,133,0.35)' : 'rgba(62,47,36,0.1)'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', fontWeight: 700, color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.1em' }}>
            // TODAY'S QUESTS
          </span>
          <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', fontWeight: 700, color: accent }}>
            {completedCount}/{totalCount}{allComplete ? ' COMPLETED' : ''}
          </span>
        </div>

        {/* XP progress bar */}
        <div style={{ position: 'relative', height: 8, background: dark ? 'rgba(78,94,133,0.25)' : 'rgba(62,47,36,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${darken(accent, 0.08)}, ${accent})`,
            transition: 'width 0.45s cubic-bezier(.22,.61,.36,1)',
            borderRadius: 2,
          }} />
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)', pointerEvents: 'none' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '8px', color: dark ? '#6B7A8E' : '#AAA090', letterSpacing: '0.08em' }}>
            ⚡ {xpEarned} / {xpTotal} XP
          </span>
        </div>
      </div>

      {/* ── Quest list ───────────────────────────────────────────── */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {duelHabits.map(habit => (
          <QuestCard
            key={habit.id}
            habit={habit}
            done={checkins[habit.habit_id]?.completed ?? false}
            hasProof={!!checkins[habit.habit_id]?.snapshot_url}
            weekDays={weeklyProgress[habit.habit_id] ?? 0}
            dark={dark}
            accent={accent}
            onToggle={() => handleToggle(habit)}
            onProof={() => setProofHabit(habit)}
          />
        ))}

        {/* All-done banner — below the habit list */}
        {allComplete && (
          <PixelCard accent={accent} dark={dark} style={{ padding: '14px 16px', textAlign: 'center', marginTop: 4 }}>
            <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '11px', fontWeight: 700, color: accent, letterSpacing: '0.12em', marginBottom: 6 }}>
              ALL QUESTS DONE!
            </div>
            <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.08em' }}>
              +{xpTotal} XP EARNED TODAY
            </div>
          </PixelCard>
        )}

        {/* Date footer */}
        <div style={{ textAlign: 'center', paddingTop: 4 }}>
          <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '8px', color: dark ? 'rgba(184,174,152,0.25)' : 'rgba(62,47,36,0.2)', letterSpacing: '0.1em' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
          </span>
        </div>

        <div style={{ height: 8 }} />
      </div>

      {/* ── Proof modal ──────────────────────────────────────────── */}
      {proofHabit && (
        <ProofModal
          habit={proofHabit}
          dark={dark}
          accent={accent}
          onSubmit={handleProofSubmit}
          onClose={() => setProofHabit(null)}
        />
      )}
    </div>
  );
}
