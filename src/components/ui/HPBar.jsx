import Avatar from './Avatar';

export default function HPBar({ value, max = 100, color, label, sublabel, avatarKind, flipped = false }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: flipped ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
      <Avatar kind={avatarKind} size={40} />
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex', justifyContent: flipped ? 'flex-end' : 'flex-start',
          fontFamily: '"Silkscreen",monospace', fontSize: '9px',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.85)', marginBottom: 3,
        }}>
          <span style={{ fontWeight: 700 }}>{label}</span>
        </div>
        <div style={{
          position: 'relative', height: 16,
          background: 'rgba(0,0,0,0.35)',
          border: '2px solid rgba(0,0,0,0.5)',
          overflow: 'hidden',
          imageRendering: 'pixelated',
        }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: flipped ? 'auto' : 0,
            right: flipped ? 0 : 'auto',
            width: `${pct * 100}%`,
            background: `linear-gradient(180deg, ${color}EE 0%, ${color} 60%, ${color}CC 100%)`,
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.25)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(transparent 0 3px, rgba(0,0,0,0.08) 3px 4px)' }} />
          </div>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center',
            justifyContent: flipped ? 'flex-start' : 'flex-end',
            paddingInline: 4,
            fontFamily: '"Silkscreen",monospace', fontSize: '8px',
            fontWeight: 700, color: 'rgba(255,255,255,0.9)',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}>
            {Math.round(pct * 100)}%
          </div>
        </div>
        <div style={{
          fontFamily: '"Silkscreen",monospace', fontSize: '8px',
          color: 'rgba(255,255,255,0.5)', marginTop: 2,
          textAlign: flipped ? 'right' : 'left',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>{sublabel}</div>
      </div>
    </div>
  );
}
