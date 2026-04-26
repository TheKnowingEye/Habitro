export default function NotifDrawer({ open, onClose, dark, accent, notifs = [] }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 40,
      pointerEvents: open ? 'all' : 'none',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.35)',
        opacity: open ? 1 : 0,
        transition: 'opacity 0.22s ease',
        backdropFilter: open ? 'blur(2px)' : 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        transform: open ? 'translateY(0)' : 'translateY(-110%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        background: dark ? '#2E3855' : '#FBF4E6',
        borderBottom: `3px solid ${accent}`,
        paddingTop: 60, paddingBottom: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        maxHeight: '80%',
        overflowY: 'auto',
      }}>
        <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: dark ? '#F4ECD8' : '#3E2F24', fontWeight: 700 }}>
            // NOTIFICATIONS
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Silkscreen",monospace', fontSize: '10px', color: dark ? '#B8AE98' : '#7A6555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            CLOSE ✕
          </button>
        </div>

        {notifs.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: '"Silkscreen",monospace', fontSize: '10px', color: dark ? '#6B7A8E' : '#AAA090', letterSpacing: '0.08em' }}>
            NO NOTIFICATIONS YET
          </div>
        ) : notifs.map((n, i) => (
          <div key={n.id ?? i} style={{
            padding: '10px 16px',
            display: 'flex', gap: 10, alignItems: 'flex-start',
            borderBottom: `1px solid ${dark ? 'rgba(78,94,133,0.4)' : 'rgba(62,47,36,0.1)'}`,
            background: !n.read_at ? (dark ? 'rgba(78,94,133,0.25)' : `${accent}12`) : 'transparent',
          }}>
            <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>
              {n.type === 'hp_drain' ? '💀' : n.type === 'opponent_checkin' ? '⚔️' : '🔔'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', fontWeight: 700, color: dark ? '#F4ECD8' : '#3E2F24', letterSpacing: '0.05em' }}>
                  {n.type?.toUpperCase().replace('_', ' ') ?? 'NOTIFICATION'}
                </span>
                {!n.read_at && <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0, marginTop: 2, display: 'inline-block' }} />}
              </div>
              <div style={{ fontSize: '12px', color: dark ? '#B8AE98' : '#7A6555', marginTop: 2 }}>{n.message}</div>
              <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '8px', color: dark ? '#6B7A8E' : '#AAA090', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
