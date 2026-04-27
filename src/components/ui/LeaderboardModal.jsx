import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { AvatarMini } from './Avatar';
import { toLocalDateStr } from '../../lib/dates';

const TIER_CONFIG = {
  bronze:   { label: 'BRONZE',   icon: '🥉', color: '#CD7F32', bg: 'rgba(205,127,50,0.13)' },
  silver:   { label: 'SILVER',   icon: '🥈', color: '#9EA0A3', bg: 'rgba(158,160,163,0.13)' },
  gold:     { label: 'GOLD',     icon: '🥇', color: '#DAA520', bg: 'rgba(218,165,32,0.13)' },
  platinum: { label: 'PLATINUM', icon: '💎', color: '#7CB9C8', bg: 'rgba(124,185,200,0.13)' },
  elite:    { label: 'ELITE',    icon: '👑', color: '#A78BFA', bg: 'rgba(167,139,250,0.13)' },
};

const PROMOTE_ZONE = 3;
const DEMOTE_ZONE  = 3;

export default function LeaderboardModal({ open, onClose, dark, accent }) {
  const { user } = useAuth();
  const [pageState, setPageState] = useState('loading');
  const [league,    setLeague]    = useState(null);
  const [members,   setMembers]   = useState([]);

  useEffect(() => {
    if (!open || !user) return;
    setPageState('loading');

    async function load() {
      const today = toLocalDateStr();

      const { data: memberships } = await supabase
        .from('league_members')
        .select('weekly_xp, position, promoted, demoted, leagues(id, tier, week_start, week_end)')
        .eq('user_id', user.id);

      const myMembership = (memberships ?? []).find(m =>
        m.leagues?.week_start <= today && m.leagues?.week_end >= today
      );

      if (!myMembership) { setPageState('no-league'); return; }

      const { data: allMembers } = await supabase
        .from('league_members')
        .select('user_id, weekly_xp, is_bot, profiles(username, avatar_kind)')
        .eq('league_id', myMembership.leagues.id)
        .order('weekly_xp', { ascending: false });

      setLeague(myMembership.leagues);
      setMembers((allMembers ?? []).map((m, i) => ({ ...m, rank: i + 1 })));
      setPageState('ready');
    }

    load();
  }, [open, user]);

  if (!open) return null;

  const tierConf = TIER_CONFIG[league?.tier] ?? TIER_CONFIG.bronze;
  const total    = members.length;

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
        maxHeight: '75vh',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: dark ? 'rgba(184,174,152,0.28)' : 'rgba(62,47,36,0.18)', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 16px 12px',
          borderBottom: `1px solid ${dark ? 'rgba(78,94,133,0.35)' : 'rgba(62,47,36,0.1)'}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', fontWeight: 700, color: accent, letterSpacing: '0.12em' }}>
              // LEADERBOARD
            </span>
            {league && (
              <span style={{
                fontFamily: '"Silkscreen",monospace', fontSize: '8px',
                color: tierConf.color, letterSpacing: '0.1em',
                background: tierConf.bg, padding: '2px 6px', borderRadius: 2,
                border: `1px solid ${tierConf.color}55`,
              }}>
                {tierConf.icon} {tierConf.label}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Silkscreen",monospace', fontSize: '8px', color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.1em', padding: 4 }}
          >
            CLOSE ✕
          </button>
        </div>

        {/* States */}
        {pageState === 'loading' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: dark ? '#6B7A8E' : '#AAA090', letterSpacing: '0.1em' }}>LOADING...</span>
          </div>
        )}

        {pageState === 'no-league' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 40 }}>🏆</span>
            <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', color: dark ? '#F4ECD8' : '#3E2F24', letterSpacing: '0.08em' }}>NOT RANKED YET</span>
            <span style={{ fontSize: '13px', color: dark ? '#B8AE98' : '#7A6555', lineHeight: 1.5 }}>
              Complete your first duel week to join a league.
            </span>
          </div>
        )}

        {pageState === 'ready' && (
          <>
            {/* Zone hint bar */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '7px 16px',
              borderBottom: `1px solid ${dark ? 'rgba(78,94,133,0.2)' : 'rgba(62,47,36,0.07)'}`,
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '7px', color: '#5E9E8A', letterSpacing: '0.08em' }}>
                ▲ TOP {PROMOTE_ZONE} PROMOTED
              </span>
              <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '7px', color: dark ? 'rgba(220,100,100,0.9)' : 'rgba(160,40,40,0.75)', letterSpacing: '0.08em' }}>
                ▼ BOTTOM {DEMOTE_ZONE} DEMOTED
              </span>
            </div>

            {/* Member rows */}
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {members.map((m, i) => {
                const isMe       = m.user_id === user.id;
                const inPromote  = i < PROMOTE_ZONE;
                const inDemote   = total > PROMOTE_ZONE + DEMOTE_ZONE && i >= total - DEMOTE_ZONE;
                const username   = m.profiles?.username ?? (m.is_bot ? 'BOT' : '???');
                const avatarKind = m.profiles?.avatar_kind ?? 'fox';

                const rowBg = isMe
                  ? `${accent}1A`
                  : inPromote
                    ? 'rgba(94,158,138,0.07)'
                    : inDemote
                      ? (dark ? 'rgba(160,50,50,0.1)' : 'rgba(180,60,60,0.06)')
                      : 'transparent';

                const leftBorderColor = isMe
                  ? accent
                  : inPromote
                    ? '#5E9E8A'
                    : inDemote
                      ? 'rgba(180,60,60,0.55)'
                      : 'transparent';

                const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                const rankColor = i === 0 ? '#DAA520' : i === 1 ? '#9EA0A3' : i === 2 ? '#CD7F32'
                  : (dark ? 'rgba(184,174,152,0.42)' : 'rgba(62,47,36,0.3)');

                return (
                  <div
                    key={m.user_id ?? i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 16px',
                      background: rowBg,
                      borderLeft: `3px solid ${leftBorderColor}`,
                      borderBottom: `1px solid ${dark ? 'rgba(78,94,133,0.1)' : 'rgba(62,47,36,0.06)'}`,
                    }}
                  >
                    {/* Rank */}
                    <span style={{
                      fontFamily: '"Silkscreen",monospace',
                      fontSize: rankEmoji ? '14px' : '9px',
                      color: rankColor,
                      minWidth: 24, textAlign: 'center', flexShrink: 0,
                    }}>
                      {rankEmoji ?? `#${i + 1}`}
                    </span>

                    <AvatarMini kind={avatarKind} size={28} />

                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontFamily: '"Silkscreen",monospace', fontSize: '9px',
                        color: isMe ? accent : (dark ? '#F4ECD8' : '#3E2F24'),
                        letterSpacing: '0.06em',
                        fontWeight: isMe ? 700 : 400,
                      }}>
                        {isMe ? `YOU` : username?.toUpperCase()}
                        {m.is_bot ? ' 🤖' : ''}
                      </span>
                    </div>

                    {/* Weekly XP */}
                    <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: accent, letterSpacing: '0.06em', flexShrink: 0 }}>
                      ⚡ {m.weekly_xp}
                    </span>

                    {/* Zone arrows */}
                    {inPromote && (
                      <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: '#5E9E8A', flexShrink: 0 }}>↑</span>
                    )}
                    {inDemote && (
                      <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: 'rgba(180,60,60,0.85)', flexShrink: 0 }}>↓</span>
                    )}
                  </div>
                );
              })}
              <div style={{ height: 12 }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
