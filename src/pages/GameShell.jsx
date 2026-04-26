import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { HABITRO_THEMES, getThemeForHour } from '../lib/themes';
import StatBadge from '../components/ui/StatBadge';
import NotifDrawer from '../components/ui/NotifDrawer';
import HistoryModal from '../components/ui/HistoryModal';
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
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [profile,     setProfile]     = useState(null);
  const [notifs,      setNotifs]      = useState([]);

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
    supabase
      .from('profiles')
      .select('total_xp, avatar_kind')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });
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
          onClick={() => setNotifOpen(o => !o)}
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
            onOpenLeader={() => {}}
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
          <ProfileScreen theme={theme} dark={dark} accent={accent} />
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

      {/* ── Bottom nav ────────────────────────────────────────── */}
      <BottomNav active={tab} onSelect={setTab} accent={accent} dark={dark} />
    </div>
  );
}
