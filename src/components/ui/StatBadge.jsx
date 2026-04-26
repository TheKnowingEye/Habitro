export default function StatBadge({ icon, value, label, dark }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: dark ? 'rgba(30,38,64,0.7)' : 'rgba(0,0,0,0.18)',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 6,
      padding: '4px 8px',
    }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <div>
        <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', fontWeight: 700, color: '#FBF4E6', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '8px', color: 'rgba(251,244,230,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      </div>
    </div>
  );
}
