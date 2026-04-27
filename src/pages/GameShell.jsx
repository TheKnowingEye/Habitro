import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { HABITRO_THEMES, getThemeForHour } from '../lib/themes';
import { toLocalDateStr } from '../lib/dates';
import StatBadge from '../components/ui/StatBadge';
import NotifDrawer from '../components/ui/NotifDrawer';
import HistoryModal from '../components/ui/HistoryModal';
import LeaderboardModal from '../components/ui/LeaderboardModal';
import MatchRevealScreen from '../components/ui/MatchRevealScreen';
import HabitSetupModal from '../components/ui/HabitSetupModal';
import BottomNav from '../components/ui/BottomNav';

import HomeScreen from './HomeScreen';
import CheckInScreen from './CheckInScreen';
import FeedScreen from './FeedScreen';
import ProfileScreen from './ProfileScreen';

export default function GameShell() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [now,         setNow]         = useState(new Date());
  const [tab,         setTab]         = useState('home');
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [historyOpen,  setHistoryOpen]  = useState(false);
  const [leaderOpen,   setLeaderOpen]   = useState(false);
  const [profile,      setProfile]      = useState(null);
  const [notifs,       setNotifs]       = useState([]);
  const [matchDuel,      setMatchDuel]      = useState(null);
  const [matchMyProf,    setMatchMyProf]    = useState(null);
  const [matchOppProf,   setMatchOppProf]   = useState(null);
  const [habitSetupDuel, setHabitSetupDuel] = useState(null);

  const themeKey = getThemeForHour(now.getHours());
  const theme    = HABITRO_THEMES[themeKey];
  const dark     = themeKey === 'night';
  const accent   = theme.accent;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;

    async function loadProfile() {
      const { data: prof } = await supabase
        .from('profiles')
        .select('total_xp, avatar_kind, rank_tier')
        .eq('id', user.id)
        .single();
      if (prof) setProfile(prof);

      // Check for a fresh duel this week that hasn't been revealed yet
      const today = new Date();
      const daysFromMon = (today.getDay() + 6) % 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysFromMon);
      const mondayStr = toLocalDateStr(monday);

      const { data: duel } = await supabase
        .from('duels')
        .select('id, week_start, week_end, user_a_id, user_b_id')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .eq('week_start', mondayStr)
        .eq('is_practice', false)
        .eq('status', 'active')
        .maybeSingle();

      if (duel) {
        // Check if habits are already set for this week
        const { count } = await supabase
          .from('duel_habits')
          .select('id', { count: 'exact', head: true })
          .eq('duel_id', duel.id)
          .eq('user_id', user.id);

        if ((count ?? 0) === 0) setHabitSetupDuel(duel);

        // Show match reveal if not yet seen
        if (!localStorage.getItem(`match_revealed_${duel.id}`)) {
          const oppId = duel.user_a_id === user.id ? duel.user_b_id : duel.user_a_id;
          const { data: oppProf } = await supabase
            .from('profiles')
            .select('username, avatar_kind, rank_tier')
            .eq('id', oppId)
            .single();
          setMatchDuel(duel);
          setMatchMyProf(prof);
          setMatchOppProf(oppProf);
        }
      }
    }

    loadProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setNotifs(data); });
  }, [user]);

  const unreadCount = notifs.filter(n => !n.read_at).length;

  async function handleBellClick() {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening && user && unreadCount > 0) {
      const now = new Date().toISOString();
      setNotifs(prev => prev.map(n => ({ ...n, read: true, read_at: n.read_at || now })));
      await supabase
        .from('notifications')
        .update({ read: true, read_at: now })
        .eq('user_id', user.id)
        .is('read_at', null);
    }
  }

  function handleMatchDismiss() {
    if (matchDuel) localStorage.setItem(`match_revealed_${matchDuel.id}`, '1');
    setMatchDuel(null);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: theme.panel,
      color: theme.textPrimary,
      fontFamily: '"Quicksand", sans-serif',
      transition: 'background 0.6s ease, color 0.6s ease',
      overflow: 'hidden',
    }}>
      {/* ── HUD bar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        background: dark ? 'rgba(20,26,46,0.92)' : 'rgba(0,0,0,0.14)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${dark ? 'rgba(78,94,133,0.5)' : 'rgba(62,47,36,0.15)'}`,
        flexShrink: 0, zIndex: 10,
      }}>
        <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', color: accent, flexShrink: 0 }}>
          HABITRO
        </span>

        <div style={{ flex: 1 }} />

        <StatBadge icon="⚡" value={profile?.total_xp ?? '—'} label="XP"     dark={dark} />
        <StatBadge icon="🔥" value={0}                         label="STREAK" dark={dark} />

        <button
          onClick={handleBellClick}
          style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1, color: 'rgba(255,255,255,0.75)' }}
        >
          🔔
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -4,
              background: '#ef4444', color: '#fff',
              fontSize: 9, fontWeight: 700, minWidth: 16, height: 16,
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1,
            }}>{unreadCount}</span>
          )}
        </button>
      </div>

      {/* ── Screen area ──────────────────────────────────────── */}
      <div key={tab} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'home' && (
          <HomeScreen
            theme={theme}
            dark={dark}
            accent={accent}
            userAvatar={profile?.avatar_kind || 'fox'}
            onOpenLeader={() => setLeaderOpen(true)}
            onOpenHistory={() => setHistoryOpen(true)}
          />
        )}
        {tab === 'checkin' && (
          <CheckInScreen theme={theme} dark={dark} accent={accent} />
        )}
        {tab === 'feed' && (
          <FeedScreen theme={theme} dark={dark} accent={accent} />
        )}
        {tab === 'profile' && (
          <ProfileScreen
            theme={theme} dark={dark} accent={accent}
            onAvatarChange={kind => setProfile(p => p ? { ...p, avatar_kind: kind } : p)}
          />
        )}
      </div>

      {/* ── Notification drawer ───────────────────────────────── */}
      <NotifDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        dark={dark}
        accent={accent}
        notifs={notifs}
      />

      {/* ── History modal ─────────────────────────────────────── */}
      <HistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        dark={dark}
        accent={accent}
        partial={theme.partial}
      />

      {/* ── Leaderboard modal ─────────────────────────────────── */}
      <LeaderboardModal
        open={leaderOpen}
        onClose={() => setLeaderOpen(false)}
        dark={dark}
        accent={accent}
      />

      {/* ── Bottom nav ────────────────────────────────────────── */}
      <BottomNav active={tab} onSelect={setTab} accent={accent} dark={dark} />

      {/* ── Habit setup ───────────────────────────────────────── */}
      {habitSetupDuel && !matchDuel && (
        <HabitSetupModal
          duel={habitSetupDuel}
          dark={dark}
          accent={accent}
          onDone={() => setHabitSetupDuel(null)}
        />
      )}

      {/* ── Match reveal ──────────────────────────────────────── */}
      {matchDuel && (
        <MatchRevealScreen
          duel={matchDuel}
          myProfile={matchMyProf}
          oppProfile={matchOppProf}
          accent={accent}
          onDismiss={handleMatchDismiss}
        />
      )}
    </div>
  );
}
