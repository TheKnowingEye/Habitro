import { useState, useEffect } from 'react';
import Avatar from './Avatar';
import CornerFrame from './CornerFrame';

const TIER_COLOR = {
  bronze:   '#CD7F32',
  silver:   '#C0C0C0',
  gold:     '#DAA520',
  platinum: '#7CB9C8',
  elite:    '#A78BFA',
};
const TIER_ICON = {
  bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', elite: '👑',
};

function weekLabel(weekStart, weekEnd) {
  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

export default function MatchRevealScreen({ duel, myProfile, oppProfile, accent, onDismiss }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 60),
      setTimeout(() => setPhase(2), 500),
      setTimeout(() => setPhase(3), 860),
      setTimeout(() => setPhase(4), 1180),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  function dismiss() {
    setPhase('out');
    setTimeout(onDismiss, 380);
  }

  const out  = phase === 'out';
  const p    = n => !out && phase >= n;
  const myTier  = myProfile?.rank_tier  ?? 'bronze';
  const oppTier = oppProfile?.rank_tier ?? 'bronze';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 350,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#0B0F1C',
      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.14) 3px, rgba(0,0,0,0.14) 4px)',
      opacity: out ? 0 : p(1) ? 1 : 0,
      transition: 'opacity 0.38s ease',
    }}>

      {/* Radial vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 35%, rgba(0,0,0,0.72) 100%)',
      }} />

      {/* Horizontal light band */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '50%',
        height: 1, marginTop: -120,
        background: `linear-gradient(90deg, transparent, ${accent}18, transparent)`,
        opacity: p(2) ? 1 : 0,
        transition: 'opacity 0.6s ease',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '0 28px', width: '100%', maxWidth: 360,
      }}>

        {/* Week range */}
        <div style={{
          fontFamily: '"Silkscreen",monospace', fontSize: '8px',
          color: 'rgba(184,174,152,0.38)', letterSpacing: '0.16em',
          marginBottom: 14,
          opacity: p(2) ? 1 : 0, transform: p(2) ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>
          {weekLabel(duel.week_start, duel.week_end)}
        </div>

        {/* Main title */}
        <div style={{
          fontFamily: '"Silkscreen",monospace', fontSize: '20px', fontWeight: 700,
          color: accent, letterSpacing: '0.1em', textAlign: 'center',
          textShadow: `0 0 24px ${accent}55, 0 0 48px ${accent}22`,
          marginBottom: 6,
          opacity: p(2) ? 1 : 0, transform: p(2) ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 0.42s ease 0.06s, transform 0.42s ease 0.06s',
        }}>
          ⚔ DUEL BEGINS
        </div>

        <div style={{
          fontFamily: '"Silkscreen",monospace', fontSize: '8px',
          color: 'rgba(184,174,152,0.3)', letterSpacing: '0.12em',
          marginBottom: 44,
          opacity: p(2) ? 1 : 0,
          transition: 'opacity 0.4s ease 0.1s',
        }}>
          YOUR OPPONENT IS READY
        </div>

        {/* VS row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, width: '100%',
          marginBottom: 44,
          opacity: p(3) ? 1 : 0, transform: p(3) ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.95)',
          transition: 'opacity 0.45s ease, transform 0.45s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

          {/* My card */}
          <div style={{
            flex: 1, position: 'relative',
            backgroundColor: 'rgba(255,255,255,0.035)',
            border: `1px solid ${accent}50`,
            borderRadius: 4,
            padding: '18px 10px 14px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <CornerFrame color={accent} size={7} />
            <Avatar kind={myProfile?.avatar_kind ?? 'fox'} size={54} />
            <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: accent, letterSpacing: '0.08em' }}>
              YOU
            </div>
            <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '7px', color: TIER_COLOR[myTier], letterSpacing: '0.06em' }}>
              {TIER_ICON[myTier]} {myTier.toUpperCase()}
            </div>
          </div>

          {/* VS */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0,
          }}>
            <div style={{
              fontFamily: '"Silkscreen",monospace', fontSize: '14px', fontWeight: 700,
              color: 'rgba(184,174,152,0.45)', letterSpacing: '0.08em',
            }}>
              VS
            </div>
          </div>

          {/* Opp card */}
          <div style={{
            flex: 1, position: 'relative',
            backgroundColor: 'rgba(255,255,255,0.035)',
            border: '1px solid rgba(184,174,152,0.2)',
            borderRadius: 4,
            padding: '18px 10px 14px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <CornerFrame color="rgba(184,174,152,0.3)" size={7} />
            <Avatar kind={oppProfile?.avatar_kind ?? 'cat'} size={54} />
            <div style={{
              fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: '#F4ECD8',
              letterSpacing: '0.06em', maxWidth: '100%',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center',
            }}>
              {oppProfile?.username?.toUpperCase() ?? 'OPPONENT'}
            </div>
            <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '7px', color: TIER_COLOR[oppTier], letterSpacing: '0.06em' }}>
              {TIER_ICON[oppTier]} {oppTier.toUpperCase()}
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={dismiss}
          style={{
            width: '100%', padding: '14px 0',
            background: accent, border: 'none', borderRadius: 4, cursor: 'pointer',
            fontFamily: '"Silkscreen",monospace', fontSize: '11px', fontWeight: 700,
            color: '#FBF4E6', letterSpacing: '0.12em',
            boxShadow: `0 4px 0 rgba(0,0,0,0.4), 0 0 20px ${accent}33`,
            opacity: p(4) ? 1 : 0, transform: p(4) ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.38s ease, transform 0.38s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = `0 6px 0 rgba(0,0,0,0.4), 0 0 28px ${accent}55`}
          onMouseLeave={e => e.currentTarget.style.boxShadow = `0 4px 0 rgba(0,0,0,0.4), 0 0 20px ${accent}33`}
        >
          BEGIN DUEL ▶
        </button>

      </div>
    </div>
  );
}
