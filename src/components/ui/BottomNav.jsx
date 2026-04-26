import { darken } from '../../lib/darken';

const TAB_ITEMS = [
  {
    id: 'home', label: 'DUEL',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 18 18" shapeRendering="crispEdges">
        <rect x="2"  y="2"  width="2" height="2" fill="currentColor"/>
        <rect x="4"  y="4"  width="2" height="2" fill="currentColor"/>
        <rect x="6"  y="6"  width="2" height="2" fill="currentColor"/>
        <rect x="8"  y="8"  width="2" height="2" fill="currentColor"/>
        <rect x="10" y="10" width="2" height="2" fill="currentColor"/>
        <rect x="12" y="12" width="2" height="2" fill="currentColor"/>
        <rect x="14" y="14" width="2" height="2" fill="currentColor"/>
        <rect x="12" y="2"  width="2" height="2" fill="currentColor"/>
        <rect x="10" y="4"  width="2" height="2" fill="currentColor"/>
        <rect x="6"  y="10" width="2" height="2" fill="currentColor"/>
        <rect x="4"  y="12" width="2" height="2" fill="currentColor"/>
        <rect x="2"  y="14" width="2" height="2" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'checkin', label: 'QUEST',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 18 18" shapeRendering="crispEdges">
        <rect x="2" y="4"  width="14" height="2" fill="currentColor"/>
        <rect x="2" y="8"  width="14" height="2" fill="currentColor"/>
        <rect x="2" y="12" width="10" height="2" fill="currentColor"/>
        <rect x="2" y="4"  width="2"  height="10" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'feed', label: 'PROOF',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 18 18" shapeRendering="crispEdges">
        <rect x="3" y="3" width="12" height="10" fill="none" stroke="currentColor" strokeWidth="2"/>
        <rect x="5" y="5" width="8"  height="4"  fill="currentColor" opacity="0.4"/>
        <rect x="5" y="10" width="3" height="2"  fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'profile', label: 'PROFILE',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 18 18" shapeRendering="crispEdges">
        <rect x="7"  y="2"  width="4" height="4" fill="currentColor"/>
        <rect x="5"  y="6"  width="8" height="4" fill="currentColor"/>
        <rect x="3"  y="10" width="2" height="6" fill="currentColor"/>
        <rect x="8"  y="10" width="2" height="6" fill="currentColor"/>
        <rect x="13" y="10" width="2" height="6" fill="currentColor"/>
      </svg>
    ),
  },
];

export default function BottomNav({ active, onSelect, accent, dark }) {
  return (
    <div style={{
      display: 'flex',
      background: dark ? 'rgba(20,26,46,0.95)' : 'rgba(251,244,230,0.95)',
      backdropFilter: 'blur(12px)',
      borderTop: `2px solid ${dark ? 'rgba(78,94,133,0.6)' : 'rgba(62,47,36,0.15)'}`,
      paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      flexShrink: 0,
    }}>
      {TAB_ITEMS.map(tab => {
        const isActive = tab.id === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, padding: '10px 4px 4px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: isActive ? accent : (dark ? 'rgba(184,174,152,0.5)' : 'rgba(62,47,36,0.35)'),
              transition: 'color 0.15s ease',
              position: 'relative',
            }}
          >
            {isActive && (
              <div style={{
                position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
                width: 32, height: 3,
                background: accent,
                boxShadow: `0 2px 0 ${darken(accent, 0.35)}`,
              }} />
            )}
            <Icon />
            <span style={{
              fontFamily: '"Silkscreen",monospace', fontSize: '7px',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              fontWeight: isActive ? 700 : 400,
            }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
