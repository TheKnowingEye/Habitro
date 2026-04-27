import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import PixelCard from '../components/ui/PixelCard';
import CornerFrame from '../components/ui/CornerFrame';
import { Avatar } from '../components/ui/Avatar';
import { darken } from '../lib/darken';

const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0,     title: 'Novice' },
  { level: 2, xp: 500,   title: 'Apprentice' },
  { level: 3, xp: 1200,  title: 'Habit Keeper' },
  { level: 4, xp: 2500,  title: 'Dedicated' },
  { level: 5, xp: 4500,  title: 'Seasoned' },
  { level: 6, xp: 7500,  title: 'Veteran' },
  { level: 7, xp: 12000, title: 'Elite' },
  { level: 8, xp: 20000, title: 'Legend' },
];

const AVATAR_KINDS = ['fox', 'cat', 'rabbit', 'raccoon'];
const DAY_LABELS   = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HISTORY_WEEKS = 12;

// Returns HISTORY_WEEKS Mon→Sun ranges ending with the current week, oldest first
function getCalendarWeeks(n) {
  const today = new Date();
  const daysFromMonday = (today.getDay() + 6) % 7;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysFromMonday);
  thisMonday.setHours(0, 0, 0, 0);

  const weeks = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    weeks.push({
      weekStart: start.toISOString().split('T')[0],
      weekEnd:   end.toISOString().split('T')[0],
      isNow:     i === 0,
    });
  }
  return weeks;
}

function shortDate(isoDate) {
  return new Date(isoDate + 'T12:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase();
}

function getXpProgress(totalXp, level) {
  const curr = LEVEL_THRESHOLDS.find(t => t.level === level) ?? LEVEL_THRESHOLDS[0];
  const next  = LEVEL_THRESHOLDS.find(t => t.level === level + 1);
  if (!next) return { earned: totalXp - curr.xp, needed: 0, pct: 100, nextLevel: null };
  const earned = Math.max(0, totalXp - curr.xp);
  const needed = next.xp - curr.xp;
  return { earned, needed, pct: Math.min(100, (earned / needed) * 100), nextLevel: next.level };
}

function StatBar({ label, value, dark, accent }) {
  const pct   = Math.min(100, value);
  const empty = dark ? 'rgba(78,94,133,0.25)' : 'rgba(62,47,36,0.08)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', fontWeight: 700, color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.08em', width: 28 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 8, background: empty, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: `linear-gradient(90deg, ${darken(accent, 0.08)}, ${accent})`, borderRadius: 2 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)', pointerEvents: 'none' }} />
      </div>
      <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', fontWeight: 700, color: dark ? '#F4ECD8' : '#3E2F24', width: 24, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

function HistoryGrid({ weeks, dark, accent, partial }) {
  function cellColor(val) {
    if (val === 1)   return accent;
    if (val === 0.5) return partial || '#5E9E8A';
    if (val === 0)   return dark ? 'rgba(180,60,60,0.35)' : 'rgba(180,60,60,0.2)';
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
    if (val === 0) return dark ? 'rgba(255,120,120,0.8)' : 'rgba(160,50,50,0.7)';
    return dark ? 'rgba(184,174,152,0.22)' : 'rgba(62,47,36,0.18)';
  }

  const labelW = 42;

  return (
    <div>
      {/* Day headers — sticky inside the scroll container */}
      <div style={{ display: 'grid', gridTemplateColumns: `${labelW}px repeat(7, 1fr)`, gap: 3, marginBottom: 5 }}>
        <div />
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontFamily: '"Silkscreen",monospace', fontSize: '7px', color: dark ? 'rgba(184,174,152,0.5)' : 'rgba(62,47,36,0.4)' }}>{d}</div>
        ))}
      </div>

      {/* Scrollable week rows */}
      <div style={{ maxHeight: 240, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: `${labelW}px repeat(7, 1fr)`, gap: 3, marginBottom: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '7px', lineHeight: 1.2, color: week.isNow ? accent : (dark ? 'rgba(184,174,152,0.45)' : 'rgba(62,47,36,0.38)'), letterSpacing: '0.04em' }}>
                {week.isNow ? 'NOW' : shortDate(week.weekStart)}
              </span>
            </div>
            {week.vals.map((val, di) => (
              <div
                key={di}
                style={{
                  height: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: cellColor(val),
                  border: val === null
                    ? `1px dashed ${dark ? 'rgba(184,174,152,0.18)' : 'rgba(62,47,36,0.12)'}`
                    : '1px solid transparent',
                  borderRadius: 2,
                  fontFamily: '"Silkscreen",monospace', fontSize: '9px',
                  color: cellInk(val),
                  boxShadow: val === 1 ? `0 2px 0 ${darken(accent, 0.35)}` : val === 0.5 ? `0 2px 0 ${darken(partial || '#5E9E8A', 0.3)}` : 'none',
                }}
              >
                {cellIcon(val)}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '7px', color: dark ? 'rgba(184,174,152,0.28)' : 'rgba(62,47,36,0.2)', letterSpacing: '0.06em', marginTop: 10, textAlign: 'center' }}>
        STATS AUTO-DERIVE FROM YOUR HABITS. UNLOCK MORE AS YOU PLAY.
      </div>
    </div>
  );
}

export default function ProfileScreen({ theme, dark, accent, onAvatarChange }) {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [loading,  setLoading]  = useState(true);
  const [profile,  setProfile]  = useState(null);
  const [league,   setLeague]   = useState(null);
  const [streak,   setStreak]   = useState(0);
  const [weeks,    setWeeks]    = useState([]);

  const partial = theme.partial;

  useEffect(() => {
    if (!user) return;

    async function load() {
      // Generate 12 calendar weeks regardless of duel history
      const calWeeks = getCalendarWeeks(HISTORY_WEEKS);
      const earliest = calWeeks[0].weekStart;

      const [{ data: prof }, { data: lm }, { data: duels }] = await Promise.all([
        supabase.from('profiles')
          .select('username, total_xp, level, level_title, stat_str, stat_wis, stat_int, stat_vit, wins, losses, rank_tier, avatar_kind')
          .eq('id', user.id).single(),
        supabase.from('league_members')
          .select('leagues(tier), position')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1).maybeSingle(),
        supabase.from('duels')
          .select('id, week_start, week_end, status, user_a_id, user_b_id')
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
          .in('status', ['active', 'closed'])
          .gte('week_start', earliest)
          .order('week_start', { ascending: false })
          .limit(HISTORY_WEEKS),
      ]);

      setProfile(prof);
      setLeague(lm?.leagues ?? null);

      const today   = new Date().toISOString().split('T')[0];
      const duelIds = (duels ?? []).map(d => d.id);

      // Fetch check-in and habit data only if there are duels in range
      let doneMap      = {};
      let habitsByDuel = {};

      if (duelIds.length) {
        const [{ data: myCheckins }, { data: myHabits }] = await Promise.all([
          supabase.from('check_ins').select('duel_id, checked_date').in('duel_id', duelIds).eq('user_id', user.id).eq('completed', true),
          supabase.from('duel_habits').select('duel_id, habit_id').in('duel_id', duelIds).eq('user_id', user.id),
        ]);

        for (const ci of myCheckins ?? []) {
          if (!doneMap[ci.duel_id]) doneMap[ci.duel_id] = {};
          doneMap[ci.duel_id][ci.checked_date] = (doneMap[ci.duel_id][ci.checked_date] ?? 0) + 1;
        }
        for (const h of myHabits ?? []) {
          habitsByDuel[h.duel_id] = (habitsByDuel[h.duel_id] ?? 0) + 1;
        }

        // Streak: consecutive full days ending at yesterday
        let s = 0;
        let checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - 1);
        for (let i = 0; i < 30; i++) {
          const day  = checkDate.toISOString().split('T')[0];
          const duel = (duels ?? []).find(d => d.week_start <= day && d.week_end >= day);
          if (!duel) break;
          const total = habitsByDuel[duel.id] ?? 0;
          if (total === 0) break;
          const done = (doneMap[duel.id] ?? {})[day] ?? 0;
          if (done < total) break;
          s++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
        setStreak(s);
      }

      // Build week rows from calendar — weeks with no duel are all null
      const weekRows = calWeeks.map(cw => {
        const duel  = (duels ?? []).find(d => d.week_start === cw.weekStart);
        const total = duel ? (habitsByDuel[duel.id] ?? 0) : 0;
        const dayMap = duel ? (doneMap[duel.id] ?? {}) : {};

        const vals = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(cw.weekStart + 'T00:00:00');
          d.setDate(d.getDate() + i);
          const day = d.toISOString().split('T')[0];
          if (day > today) return null;          // future
          if (!duel || total === 0) return null; // no duel this week
          const done = dayMap[day] ?? 0;
          if (done === 0) return 0;
          return done >= total ? 1 : 0.5;
        });

        return { weekStart: cw.weekStart, isNow: cw.isNow, vals };
      });

      setWeeks(weekRows);
      setLoading(false);
    }

    load();
  }, [user]);

  async function handleAvatarChange(kind) {
    setProfile(prev => prev ? { ...prev, avatar_kind: kind } : prev);
    onAvatarChange?.(kind);
    await supabase.from('profiles').update({ avatar_kind: kind }).eq('id', user.id);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.1em' }}>LOADING...</span>
      </div>
    );
  }

  if (!profile) return null;

  const totalXp    = profile.total_xp ?? 0;
  const level      = profile.level ?? 1;
  const { earned, needed, pct, nextLevel } = getXpProgress(totalXp, level);
  const tierLabel  = league?.tier?.toUpperCase() ?? (profile.rank_tier ? profile.rank_tier.toUpperCase() : null);
  const avatarKind = profile.avatar_kind || 'fox';

  return (
    <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Identity card ──────────────────────────────────────── */}
        <div style={{
          position: 'relative',
          background: dark ? 'rgba(30,38,64,0.88)' : 'rgba(251,244,230,0.92)',
          border: `1px solid ${dark ? 'rgba(78,94,133,0.55)' : 'rgba(62,47,36,0.16)'}`,
          borderRadius: 4, padding: '16px 14px',
          boxShadow: `0 3px 0 ${dark ? '#1A1E2E' : 'rgba(62,47,36,0.14)'}`,
        }}>
          <CornerFrame color={accent} size={8} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <Avatar kind={avatarKind} size={64} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '14px', fontWeight: 700, color: dark ? '#F4ECD8' : '#3E2F24', letterSpacing: '0.06em', marginBottom: 4 }}>
                {(profile.username ?? 'PLAYER').toUpperCase()}
              </div>
              <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '8px', color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.08em', marginBottom: 10 }}>
                LVL {level} · {(profile.level_title ?? 'Novice').toUpperCase()}
              </div>
              <div style={{ position: 'relative', height: 8, background: dark ? 'rgba(78,94,133,0.28)' : 'rgba(62,47,36,0.09)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: `linear-gradient(90deg, ${darken(accent, 0.08)}, ${accent})`, borderRadius: 2 }} />
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)', pointerEvents: 'none' }} />
              </div>
              <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '7px', color: dark ? '#6B7A8E' : '#AAA090', letterSpacing: '0.06em' }}>
                {earned} / {needed || '∞'} XP{nextLevel ? ` · LVL ${nextLevel}` : ' · MAX'}
              </div>
            </div>
          </div>

          {/* Avatar selector */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {AVATAR_KINDS.map(kind => (
              <button
                key={kind}
                onClick={() => handleAvatarChange(kind)}
                style={{
                  padding: 4,
                  background: kind === avatarKind ? `${accent}22` : 'transparent',
                  border: `2px solid ${kind === avatarKind ? accent : (dark ? 'rgba(78,94,133,0.38)' : 'rgba(62,47,36,0.2)')}`,
                  borderRadius: 3, cursor: 'pointer',
                  boxShadow: kind === avatarKind ? `0 2px 0 ${darken(accent, 0.4)}` : 'none',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <Avatar kind={kind} size={28} />
              </button>
            ))}
          </div>

          {/* Stat badges */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {[
              { icon: '🔥', value: `${streak} STREAK` },
              { icon: '⚡', value: `${totalXp} XP` },
              ...(tierLabel ? [{ icon: '🏆', value: `TIER ${tierLabel}` }] : []),
            ].map((b, i) => (
              <span key={i} style={{
                fontFamily: '"Silkscreen",monospace', fontSize: '8px', letterSpacing: '0.08em',
                padding: '4px 8px',
                background: dark ? 'rgba(78,94,133,0.22)' : 'rgba(62,47,36,0.07)',
                border: `1px solid ${dark ? 'rgba(78,94,133,0.45)' : 'rgba(62,47,36,0.16)'}`,
                borderRadius: 3, color: dark ? '#F4ECD8' : '#3E2F24',
              }}>
                {b.icon} {b.value}
              </span>
            ))}
          </div>
        </div>

        {/* ── How it works ───────────────────────────────────────── */}
        <PixelCard accent={accent} dark={dark}>
          <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.1em', marginBottom: 12 }}>// HOW IT WORKS</div>
          {[
            { icon: '⚡', label: 'XP',   body: 'Earn XP for every habit you complete. More XP = higher level.' },
            { icon: '❤️', label: 'HP',   body: "Weekly duel health. Miss habits and it drains. Beat your opponent's HP to win the week." },
            { icon: '🏆', label: 'RANK', body: 'Wins push you up tiers. Losses drop you. Rank resets every season.' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 16, flexShrink: 0, width: 24, textAlign: 'center' }}>{item.icon}</span>
              <div>
                <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', fontWeight: 700, color: dark ? '#F4ECD8' : '#3E2F24', letterSpacing: '0.08em', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: dark ? '#B8AE98' : '#7A6555', lineHeight: 1.5 }}>{item.body}</div>
              </div>
            </div>
          ))}
        </PixelCard>

        {/* ── Character stats ───────────────────────────────────── */}
        <PixelCard accent={accent} dark={dark}>
          <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.1em', marginBottom: 12 }}>// CHARACTER STATS</div>
          <StatBar label="STR" value={profile.stat_str ?? 0} dark={dark} accent={accent} />
          <StatBar label="WIS" value={profile.stat_wis ?? 0} dark={dark} accent={accent} />
          <StatBar label="END" value={profile.stat_vit ?? 0} dark={dark} accent={accent} />
          <StatBar label="INT" value={profile.stat_int ?? 0} dark={dark} accent={accent} />
        </PixelCard>

        {/* ── Completion history — 12 weeks, scrollable ─────────── */}
        <PixelCard accent={accent} dark={dark}>
          <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.1em', marginBottom: 12 }}>
            // COMPLETION HISTORY
            <span style={{ fontSize: '7px', color: dark ? 'rgba(184,174,152,0.38)' : 'rgba(62,47,36,0.3)', marginLeft: 8 }}>last 12 wks · scroll ↕</span>
          </div>
          <HistoryGrid weeks={weeks} dark={dark} accent={accent} partial={partial} />
        </PixelCard>

        {/* ── Sign out ──────────────────────────────────────────── */}
        <button
          onClick={handleSignOut}
          style={{
            width: '100%', padding: '12px 0',
            background: 'none',
            border: `1px solid ${dark ? 'rgba(184,60,60,0.45)' : 'rgba(180,50,50,0.28)'}`,
            borderRadius: 4, cursor: 'pointer',
            fontFamily: '"Silkscreen",monospace', fontSize: '9px', fontWeight: 700,
            color: dark ? 'rgba(255,120,120,0.65)' : 'rgba(160,50,50,0.6)',
            letterSpacing: '0.12em',
            boxShadow: `0 2px 0 ${dark ? 'rgba(180,40,40,0.3)' : 'rgba(160,50,50,0.14)'}`,
          }}
        >
          SIGN OUT
        </button>

        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
