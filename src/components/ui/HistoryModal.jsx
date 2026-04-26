import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { darken } from '../../lib/darken';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function HistoryModal({ open, onClose, dark, accent, partial }) {
  const { user }  = useAuth();
  const [weeks,   setWeeks]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);

    async function load() {
      const { data: duels } = await supabase
        .from('duels')
        .select('id, week_start, week_end, status, user_a_id, user_b_id')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .in('status', ['active', 'closed'])
        .order('week_start', { ascending: false })
        .limit(4);

      if (!duels?.length) { setWeeks([]); setLoading(false); return; }

      const today   = new Date().toISOString().split('T')[0];
      const duelIds = duels.map(d => d.id);

      const [{ data: myCheckins }, { data: myHabits }] = await Promise.all([
        supabase.from('check_ins').select('duel_id, checked_date').in('duel_id', duelIds).eq('user_id', user.id).eq('completed', true),
        supabase.from('duel_habits').select('duel_id, habit_id').in('duel_id', duelIds).eq('user_id', user.id),
      ]);

      const doneMap = {};
      const habitsByDuel = {};
      for (const ci of myCheckins ?? []) {
        if (!doneMap[ci.duel_id]) doneMap[ci.duel_id] = {};
        doneMap[ci.duel_id][ci.checked_date] = (doneMap[ci.duel_id][ci.checked_date] ?? 0) + 1;
      }
      for (const h of myHabits ?? []) {
        habitsByDuel[h.duel_id] = (habitsByDuel[h.duel_id] ?? 0) + 1;
      }

      // Build weeks newest→oldest (duels is already sorted desc)
      const weekRows = duels.map((duel, wi) => {
        const total  = habitsByDuel[duel.id] ?? 0;
        const dayMap = doneMap[duel.id] ?? {};
        const isNow  = duel.status === 'active';
        const label  = isNow ? 'WK 4\n(NOW)' : `WK ${duels.length - wi}`;
        const vals   = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(duel.week_start + 'T00:00:00');
          d.setDate(d.getDate() + i);
          const day = d.toISOString().split('T')[0];
          if (day > today) return null;
          const done = dayMap[day] ?? 0;
          if (done === 0) return 0;
          return done >= total ? 1 : 0.5;
        });
        return { label, vals, isNow };
      }).reverse(); // oldest first

      setWeeks(weekRows);
      setLoading(false);
    }

    load();
  }, [open, user]);

  if (!open) return null;

  function cellColor(val) {
    if (val === 1)   return accent;
    if (val === 0.5) return partial || '#5E9E8A';
    if (val === 0)   return dark ? 'rgba(160,50,50,0.45)' : 'rgba(180,60,60,0.22)';
    return 'transparent';
  }
  function cellIcon(val) {
    if (val === 1)   return '✓';
    if (val === 0.5) return '~';
    if (val === 0)   return '✗';
    return '·';
  }
  function cellInk(val) {
    if (val === 1 || val === 0.5) return '#FBF4E6';
    if (val === 0) return dark ? 'rgba(255,130,130,0.85)' : 'rgba(160,50,50,0.75)';
    return dark ? 'rgba(184,174,152,0.2)' : 'rgba(62,47,36,0.16)';
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      />

      {/* Sheet */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: dark ? '#1A2036' : '#FBF4E6',
        borderRadius: '12px 12px 0 0',
        borderTop:   `1px solid ${dark ? 'rgba(78,94,133,0.65)' : 'rgba(62,47,36,0.18)'}`,
        borderLeft:  `1px solid ${dark ? 'rgba(78,94,133,0.65)' : 'rgba(62,47,36,0.18)'}`,
        borderRight: `1px solid ${dark ? 'rgba(78,94,133,0.65)' : 'rgba(62,47,36,0.18)'}`,
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
          <div style={{ width: 36, height: 4, background: dark ? 'rgba(184,174,152,0.28)' : 'rgba(62,47,36,0.18)', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 16px 12px',
          borderBottom: `1px solid ${dark ? 'rgba(78,94,133,0.35)' : 'rgba(62,47,36,0.1)'}`,
        }}>
          <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', fontWeight: 700, color: accent, letterSpacing: '0.12em' }}>
            // HISTORY
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Silkscreen",monospace', fontSize: '8px', color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.1em', padding: 4 }}
          >
            CLOSE ✕
          </button>
        </div>

        {/* Calendar grid */}
        <div style={{ padding: '16px 16px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: dark ? '#6B7A8E' : '#AAA090', letterSpacing: '0.1em' }}>
              LOADING...
            </div>
          ) : weeks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: dark ? '#6B7A8E' : '#AAA090', letterSpacing: '0.08em' }}>
              NO HISTORY YET
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
                <div />
                {DAY_LABELS.map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', fontFamily: '"Silkscreen",monospace', fontSize: '8px', color: dark ? 'rgba(184,174,152,0.5)' : 'rgba(62,47,36,0.4)' }}>{d}</div>
                ))}
              </div>

              {/* Week rows */}
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', gap: 4, marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', paddingRight: 4 }}>
                    <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '7px', color: dark ? 'rgba(184,174,152,0.48)' : 'rgba(62,47,36,0.38)', lineHeight: 1.3, whiteSpace: 'pre' }}>
                      {week.label}
                    </span>
                  </div>
                  {week.vals.map((val, di) => (
                    <div
                      key={di}
                      style={{
                        height: 28,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: cellColor(val),
                        border: val === null
                          ? `1px dashed ${dark ? 'rgba(184,174,152,0.16)' : 'rgba(62,47,36,0.12)'}`
                          : '1px solid transparent',
                        borderRadius: 3,
                        fontFamily: '"Silkscreen",monospace', fontSize: '10px',
                        color: cellInk(val),
                        boxShadow: val === 1 ? `0 2px 0 ${darken(accent, 0.38)}` : val === 0.5 ? `0 2px 0 ${darken(partial || '#5E9E8A', 0.3)}` : 'none',
                      }}
                    >
                      {cellIcon(val)}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
