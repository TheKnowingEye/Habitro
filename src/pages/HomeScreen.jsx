import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import CampScene from '../components/ui/CampScene';
import HPBar from '../components/ui/HPBar';
import PixelCard from '../components/ui/PixelCard';
import CornerFrame from '../components/ui/CornerFrame';
import { Avatar } from '../components/ui/Avatar';
import { darken } from '../lib/darken';
import { toLocalDateStr } from '../lib/dates';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function formatLastSeen(lastSeen) {
  if (!lastSeen) return null;
  const diffMs  = Date.now() - new Date(lastSeen).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 3)  return { online: true,  label: 'ONLINE' };
  if (diffMin < 60) return { online: false, label: `${diffMin}M AGO` };
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return { online: false, label: `${diffHr}H AGO` };
  return { online: false, label: `${Math.floor(diffHr / 24)}D AGO` };
}

function toDateStr(d) { return toLocalDateStr(d); }

function getWeekDays(weekStart) {
  const days = [];
  const start = new Date(weekStart + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(toDateStr(d));
  }
  return days;
}

function calColor(val, accent, dark, partial) {
  if (val === 1)   return accent;
  if (val === 0.5) return partial || '#D4A574';
  if (val === 0)   return dark ? 'rgba(180,60,60,0.35)' : 'rgba(180,60,60,0.18)';
  return 'transparent';
}
function calIcon(val) {
  if (val === 1)   return '✓';
  if (val === 0.5) return '~';
  if (val === 0)   return '✗';
  return '·';
}
function calInk(val, dark) {
  if (val === 1 || val === 0.5) return '#FBF4E6';
  if (val === 0) return dark ? 'rgba(255,120,120,0.7)' : 'rgba(160,50,50,0.7)';
  return dark ? 'rgba(184,174,152,0.3)' : 'rgba(62,47,36,0.2)';
}

export default function HomeScreen({ theme, dark, accent, userAvatar, onOpenLeader, onOpenHistory, onStreakChange }) {
  const { user } = useAuth();
  const partial   = theme.partial;

  const [loading,       setLoading]       = useState(true);
  const [duel,          setDuel]          = useState(null);
  const [myScore,       setMyScore]       = useState(null);
  const [oppScore,      setOppScore]      = useState(null);
  const [oppProfile,    setOppProfile]    = useState(null);
  const [myHabitCount,  setMyHabitCount]  = useState(0);
  const [oppHabitCount, setOppHabitCount] = useState(0);
  const [weekDays,      setWeekDays]      = useState([]);
  const [weekVals,      setWeekVals]      = useState(Array(7).fill(null));
  const [todayDone,     setTodayDone]     = useState(0);
  const [oppTodayDone,  setOppTodayDone]  = useState(0);
  const [streak,        setStreak]        = useState(0);
  const [rankPos,       setRankPos]       = useState(null);
  const [animHP,        setAnimHP]        = useState({ user: 0, opp: 0 });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: duelData } = await supabase
        .from('duels')
        .select('id, status, week_start, week_end, is_practice, user_a_id, user_b_id')
        .eq('status', 'active')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (!duelData) { setLoading(false); return; }

      setDuel(duelData);
      const oppId  = duelData.user_a_id === user.id ? duelData.user_b_id : duelData.user_a_id;
      const today  = toDateStr(new Date());
      const days   = getWeekDays(duelData.week_start);
      setWeekDays(days);

      const [
        { data: scores },
        { data: oppProf },
        { data: myHabits },
        { data: oppHabits },
        { data: weekCheckins },
        { data: leagueRow },
      ] = await Promise.all([
        supabase.from('scores').select('user_id, hp, total_points, consecutive_days').eq('duel_id', duelData.id),
        oppId
          ? supabase.from('profiles').select('username, avatar_kind, last_seen').eq('id', oppId).single()
          : Promise.resolve({ data: null }),
        supabase.from('duel_habits').select('id').eq('duel_id', duelData.id).eq('user_id', user.id),
        oppId
          ? supabase.from('duel_habits').select('id').eq('duel_id', duelData.id).eq('user_id', oppId)
          : Promise.resolve({ data: [] }),
        supabase.from('check_ins')
          .select('user_id, checked_date, completed')
          .eq('duel_id', duelData.id)
          .gte('checked_date', duelData.week_start)
          .lte('checked_date', today),
        supabase.from('league_members').select('position').eq('user_id', user.id).maybeSingle(),
      ]);

      if (cancelled) return;

      const myHp  = scores?.find(s => s.user_id === user.id)?.hp ?? 100;
      const oppHp = oppId ? (scores?.find(s => s.user_id === oppId)?.hp ?? 100) : 0;

      setMyScore(scores?.find(s => s.user_id === user.id) ?? null);
      setOppScore(oppId ? (scores?.find(s => s.user_id === oppId) ?? null) : null);
      setOppProfile(oppProf);

      const myTotal  = myHabits?.length  ?? 0;
      const oppTotal = oppHabits?.length ?? 0;
      setMyHabitCount(myTotal);
      setOppHabitCount(oppTotal);
      setRankPos(leagueRow?.position ?? null);

      const checkins    = weekCheckins ?? [];
      const todayMyDone = checkins.filter(c => c.user_id === user.id && c.checked_date === today && c.completed).length;
      const todayOppDone = oppId
        ? checkins.filter(c => c.user_id === oppId && c.checked_date === today && c.completed).length
        : 0;
      setTodayDone(todayMyDone);
      setOppTodayDone(todayOppDone);

      // Week calendar values — today shows pending (null) if no check-ins yet
      const vals = days.map(day => {
        if (day > today) return null;
        const done = checkins.filter(c => c.user_id === user.id && c.checked_date === day && c.completed).length;
        if (done === 0) return day === today ? null : 0;
        return done >= myTotal ? 1 : 0.5;
      });
      setWeekVals(vals);

      // Streak from DB (consecutive_days on scores row — persists across weeks)
      const myStreak = scores?.find(s => s.user_id === user.id)?.consecutive_days ?? 0;
      setStreak(myStreak);
      onStreakChange?.(myStreak);
      setLoading(false);

      // Animate HP bars in
      let start = null;
      const animate = (ts) => {
        if (!start) start = ts;
        const ease = 1 - Math.pow(1 - Math.min(1, (ts - start) / 1000), 3);
        setAnimHP({ user: Math.round(myHp * ease), opp: Math.round(oppHp * ease) });
        if (ease < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  // ── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.1em' }}>
          LOADING...
        </span>
      </div>
    );
  }

  // ── No active duel ────────────────────────────────────────────
  if (!duel) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, textAlign: 'center' }}>
        <span style={{ fontSize: 40 }}>⚔️</span>
        <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '11px', color: dark ? '#F4ECD8' : '#3E2F24', letterSpacing: '0.08em' }}>NO ACTIVE DUEL</span>
        <span style={{ fontSize: '13px', color: dark ? '#B8AE98' : '#7A6555', lineHeight: 1.5 }}>
          Matchmaking runs every Monday. Check back then!
        </span>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────
  const today      = toDateStr(new Date());
  const todayIdx   = weekDays.indexOf(today);
  const dayNum     = todayIdx >= 0 ? todayIdx + 1 : 7;
  const oppName    = oppProfile?.username?.toUpperCase() ?? (duel.is_practice ? 'BOT' : 'OPPONENT');
  const oppAvatar  = oppProfile?.avatar_kind || 'cat';
  const weekEnd    = new Date(duel.week_end + 'T23:59:59');
  const daysLeft   = Math.max(0, Math.ceil((weekEnd - new Date()) / 86_400_000));
  const oppMissed  = Math.max(0, oppHabitCount - oppTodayDone);

  return (
    <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

      {/* ── Scene ──────────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 220, flexShrink: 0 }}>
        <CampScene theme={theme} userAvatar={userAvatar} opponentAvatar={oppAvatar} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.35) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Week banner */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          padding: '4px 14px',
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.18)', borderRadius: 4,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', fontWeight: 700, color: '#FBF4E6', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            ⚔ {duel.is_practice ? 'PRACTICE' : 'DUEL'} · DAY {dayNum} OF 7
          </span>
        </div>

        {/* HP bars */}
        <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <HPBar value={animHP.user} label="YOU"     sublabel={`${myScore?.hp ?? 100} HP`}  color="#6B8E5A" avatarKind={userAvatar} />
          <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', color: 'rgba(255,255,255,0.8)', flexShrink: 0, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>VS</div>
          <HPBar value={animHP.opp}  label={oppName} sublabel={`${oppScore?.hp ?? 100} HP`}  color="#8B6A8E" avatarKind={oppAvatar} flipped />
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div style={{ padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* This week calendar */}
        <PixelCard accent={accent} dark={dark}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: dark ? '#B8AE98' : '#7A6555' }}>// THIS WEEK</span>
              <button
                onClick={() => onOpenHistory?.()}
                style={{
                  background: 'none', border: `1px solid ${dark ? 'rgba(78,94,133,0.5)' : 'rgba(62,47,36,0.25)'}`,
                  borderRadius: 3, padding: '2px 7px', cursor: 'pointer',
                  fontFamily: '"Silkscreen",monospace', fontSize: '8px',
                  color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}
              >HISTORY</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13 }}>🔥</span>
              <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '11px', fontWeight: 700, color: accent }}>{streak} DAY STREAK</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {DAY_LABELS.map((d, i) => {
              const val     = weekVals[i] ?? null;
              const isToday = weekDays[i] === today;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '8px', textTransform: 'uppercase', color: dark ? 'rgba(184,174,152,0.6)' : 'rgba(62,47,36,0.45)' }}>{d}</span>
                  <div style={{
                    width: 28, height: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: calColor(val, accent, dark, partial),
                    border: isToday
                      ? `2px solid ${accent}`
                      : val === null ? `1px dashed ${dark ? 'rgba(184,174,152,0.2)' : 'rgba(62,47,36,0.15)'}` : '2px solid transparent',
                    borderRadius: 2,
                    fontFamily: '"Silkscreen",monospace', fontSize: '10px',
                    color: calInk(val, dark),
                    boxShadow: val === 1   ? `0 3px 0 ${darken(accent, 0.35)}`
                              : val === 0.5 ? `0 2px 0 ${darken(partial, 0.3)}`
                              : 'none',
                  }}>{calIcon(val)}</div>
                </div>
              );
            })}
          </div>
        </PixelCard>

        {/* 2×2 stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: '✅', value: `${todayDone}/${myHabitCount}`,                        label: 'HABITS TODAY', onClick: null },
            { icon: '🏅', value: rankPos ? `RANK ${rankPos}` : 'UNRANKED',              label: 'LEADERBOARD',  onClick: onOpenLeader },
            { icon: '📅', value: daysLeft === 1 ? 'FINAL DAY' : `${daysLeft} DAYS`,     label: 'DUEL LEFT',    onClick: null },
            { icon: oppMissed > 0 ? '💀' : '✓', value: `${oppMissed} MISSED`,           label: `${oppName} TODAY`, onClick: null },
          ].map((s, i) => (
            <div
              key={i}
              onClick={s.onClick ?? undefined}
              style={{
                position: 'relative',
                background: dark ? 'rgba(30,38,64,0.85)' : 'rgba(251,244,230,0.85)',
                border: `1px solid ${s.onClick ? accent + '88' : (dark ? 'rgba(78,94,133,0.5)' : 'rgba(62,47,36,0.15)')}`,
                borderRadius: 4,
                padding: '10px 10px 10px 12px',
                boxShadow: `0 3px 0 ${dark ? '#1E2640' : 'rgba(62,47,36,0.2)'}`,
                cursor: s.onClick ? 'pointer' : 'default',
              }}
            >
              <CornerFrame color={accent} size={6} />
              <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '12px', fontWeight: 700, color: dark ? '#F4ECD8' : '#3E2F24' }}>{s.value}</div>
              <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '8px', color: dark ? '#6B7A8E' : '#AAA090', marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Opponent status card */}
        <PixelCard accent={accent} dark={dark} style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar kind={oppAvatar} size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '11px', fontWeight: 700, color: dark ? '#F4ECD8' : '#3E2F24', marginBottom: 3 }}>
                {oppName} · {duel.is_practice ? 'PRACTICE' : 'OPPONENT'}
              </div>
              <div style={{ fontSize: '13px', color: dark ? '#B8AE98' : '#7A6555', lineHeight: 1.4 }}>
                Checked in {oppTodayDone}/{oppHabitCount} habits today.
              </div>
            </div>
            {(() => {
              const seen = duel.is_practice ? null : formatLastSeen(oppProfile?.last_seen);
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 8px',
                  background: seen?.online ? 'rgba(74,210,149,0.15)' : `${accent}22`,
                  border: `1px solid ${seen?.online ? 'rgba(74,210,149,0.5)' : accent + '55'}`,
                  borderRadius: 4,
                  flexShrink: 0,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: seen?.online ? '#4AD295' : (dark ? 'rgba(184,174,152,0.4)' : 'rgba(62,47,36,0.3)'),
                    boxShadow: seen?.online ? '0 0 6px #4AD295' : 'none',
                  }} />
                  <span style={{
                    fontFamily: '"Silkscreen",monospace', fontSize: '8px',
                    color: seen?.online ? '#4AD295' : (dark ? '#B8AE98' : '#7A6555'),
                    letterSpacing: '0.08em',
                  }}>
                    {duel.is_practice ? 'BOT' : (seen ? seen.label : 'OFFLINE')}
                  </span>
                </div>
              );
            })()}
          </div>
        </PixelCard>

        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
