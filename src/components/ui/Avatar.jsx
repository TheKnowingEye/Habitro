const AVATARS = {
  fox:     { body: '#C97D60', shade: '#A05D45', belly: '#F4ECD8', accent: '#3E2F24' },
  cat:     { body: '#6B6555', shade: '#4A4538', belly: '#E8DCC8', accent: '#2E2A22' },
  rabbit:  { body: '#E8D4B8', shade: '#C9B498', belly: '#FBF4E6', accent: '#8A7458' },
  raccoon: { body: '#7A7060', shade: '#5A5040', belly: '#C9BFA8', accent: '#2A2520' },
};

const SPRITE_PORTRAIT = {
  fox: [
    [4,1,2,2,'body'], [10,1,2,2,'body'],
    [4,2,1,1,'accent'], [11,2,1,1,'accent'],
    [3,3,10,8,'body'],
    [3,8,10,3,'shade'],
    [5,5,6,4,'belly'],
    [5,6,2,1,'accent'], [9,6,2,1,'accent'],
    [7,8,2,1,'accent'],
    [4,11,8,4,'body'],
    [4,13,8,2,'shade'],
    [6,14,4,1,'belly'],
  ],
  cat: [
    [3,1,2,3,'body'], [11,1,2,3,'body'],
    [3,2,1,2,'shade'], [12,2,1,2,'shade'],
    [3,3,10,8,'body'],
    [3,8,10,3,'shade'],
    [5,5,6,4,'belly'],
    [5,6,2,1,'accent'], [9,6,2,1,'accent'],
    [7,8,2,1,'accent'],
    [4,11,8,4,'body'],
    [4,13,8,2,'shade'],
    [2,7,1,1,'accent'], [13,7,1,1,'accent'],
  ],
  rabbit: [
    [4,0,2,5,'body'], [10,0,2,5,'body'],
    [5,1,1,3,'shade'], [11,1,1,3,'shade'],
    [3,4,10,7,'body'],
    [3,8,10,3,'shade'],
    [5,5,6,4,'belly'],
    [5,6,2,1,'accent'], [9,6,2,1,'accent'],
    [7,8,2,1,'accent'],
    [4,11,8,4,'body'],
    [4,13,8,2,'shade'],
    [6,14,4,1,'belly'],
  ],
  raccoon: [
    [4,1,2,2,'body'], [10,1,2,2,'body'],
    [3,3,10,8,'body'],
    [3,6,10,2,'accent'],
    [5,6,1,2,'belly'], [10,6,1,2,'belly'],
    [5,6,2,1,'accent'], [9,6,2,1,'accent'],
    [4,9,8,2,'shade'],
    [7,9,2,1,'accent'],
    [4,11,8,4,'body'],
    [4,13,8,2,'shade'],
    [6,12,4,1,'accent'],
  ],
};

export function Avatar({ kind = 'fox', size = 64 }) {
  const palette = AVATARS[kind] || AVATARS.fox;
  const sprite  = SPRITE_PORTRAIT[kind] || SPRITE_PORTRAIT.fox;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16"
         shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {sprite.map(([x, y, w, h, role], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={palette[role]} />
      ))}
    </svg>
  );
}

export function AvatarMini({ kind = 'fox', size = 16 }) {
  const p = AVATARS[kind] || AVATARS.fox;
  return (
    <svg width={size} height={size} viewBox="0 0 8 8"
         shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="2" y="0" width="1" height="1" fill={p.body} />
      <rect x="5" y="0" width="1" height="1" fill={p.body} />
      <rect x="1" y="1" width="6" height="3" fill={p.body} />
      <rect x="3" y="2" width="2" height="1" fill={p.belly} />
      <rect x="2" y="2" width="1" height="1" fill={p.accent} />
      <rect x="5" y="2" width="1" height="1" fill={p.accent} />
      <rect x="1" y="4" width="6" height="2" fill={p.shade} />
      <rect x="1" y="6" width="2" height="1" fill={p.accent} />
      <rect x="5" y="6" width="2" height="1" fill={p.accent} />
    </svg>
  );
}

export { AVATARS };
export default Avatar;
