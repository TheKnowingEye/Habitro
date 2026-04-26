import CornerFrame from './CornerFrame';

export default function PixelCard({ children, style = {}, accent, dark }) {
  return (
    <div style={{
      position: 'relative',
      background: dark ? 'rgba(30,38,64,0.85)' : 'rgba(251,244,230,0.88)',
      backdropFilter: 'blur(8px)',
      border: `1px solid ${dark ? 'rgba(78,94,133,0.6)' : 'rgba(62,47,36,0.18)'}`,
      borderRadius: 4,
      padding: '14px 14px',
      ...style,
    }}>
      <CornerFrame color={accent || '#C97D60'} size={8} />
      {children}
    </div>
  );
}
