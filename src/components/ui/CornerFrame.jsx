function PixelCorner({ size = 10, color, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 4 4"
         shapeRendering="crispEdges" style={{ imageRendering: 'pixelated', ...style }}>
      <rect x="0" y="0" width="4" height="1" fill={color} />
      <rect x="0" y="0" width="1" height="4" fill={color} />
    </svg>
  );
}

export default function CornerFrame({ color, size = 10, style = {} }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}>
      <PixelCorner color={color} size={size} style={{ position: 'absolute', top: 4, left: 4 }} />
      <PixelCorner color={color} size={size} style={{ position: 'absolute', top: 4, right: 4, transform: 'scaleX(-1)' }} />
      <PixelCorner color={color} size={size} style={{ position: 'absolute', bottom: 4, left: 4, transform: 'scaleY(-1)' }} />
      <PixelCorner color={color} size={size} style={{ position: 'absolute', bottom: 4, right: 4, transform: 'scale(-1,-1)' }} />
    </div>
  );
}
