import { AvatarMini, AVATARS } from './Avatar';

export default function CampScene({ theme, userAvatar = 'fox', opponentAvatar = 'cat' }) {
  const W = 390, H = 220;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%"
         preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="camp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={theme.sky[0]} />
          <stop offset="100%" stopColor={theme.sky[1]} />
        </linearGradient>
        <linearGradient id="camp-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={theme.sky[1]} stopOpacity="0.7" />
          <stop offset="100%" stopColor={theme.sky[2]} stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width={W} height={H * 0.55} fill="url(#camp-sky)" />

      {/* Stars */}
      {theme.stars && [
        [30,12],[80,8],[140,18],[200,6],[260,14],[320,9],[370,15],
        [50,30],[110,25],[175,35],[235,22],[295,30],[355,26],
      ].map(([cx, cy], i) => (
        <rect key={i} x={cx} y={cy} width="2" height="2" fill="#F4ECD8" opacity="0.7"
              shapeRendering="crispEdges"
              style={{ animation: `twinkle ${2 + i * 0.3}s ${i * 0.4}s ease-in-out infinite` }} />
      ))}

      {/* Sun / Moon */}
      <circle cx={W * 0.78} cy={H * 0.22} r="18" fill={theme.sunGlow} opacity="0.4" />
      <circle cx={W * 0.78} cy={H * 0.22} r="11" fill={theme.sunColor} />
      {theme.label === 'Night' && (
        <g shapeRendering="crispEdges">
          <rect x={W * 0.78 + 2} y={H * 0.22 - 4} width="3" height="3" fill="rgba(0,0,0,0.12)" />
          <rect x={W * 0.78 - 3} y={H * 0.22 + 2} width="3" height="3" fill="rgba(0,0,0,0.12)" />
        </g>
      )}

      {/* Mountains */}
      <g shapeRendering="crispEdges">
        <polygon
          points={`0,${H*0.52} 60,${H*0.28} 130,${H*0.45} 200,${H*0.22} 270,${H*0.38} 330,${H*0.30} 390,${H*0.46} 390,${H*0.55} 0,${H*0.55}`}
          fill={theme.hillFar} />
        <polygon
          points={`0,${H*0.55} 80,${H*0.38} 160,${H*0.52} 230,${H*0.35} 310,${H*0.48} 390,${H*0.38} 390,${H*0.55} 0,${H*0.55}`}
          fill={theme.hill} />
      </g>

      {/* Lake */}
      <rect x="0" y={H * 0.55} width={W} height={H * 0.45} fill="url(#camp-water)" />
      {[0.6, 0.68, 0.76, 0.84].map((yf, i) => (
        <rect key={i} x={20 + i * 8} y={H * yf} width={W - 40 - i * 16} height="1"
              fill={theme.sunColor} opacity="0.12" />
      ))}
      <g opacity="0.25">
        <polygon
          points={`0,${H*0.55} 60,${H*0.79} 130,${H*0.62} 200,${H*0.95} 270,${H*0.72} 330,${H*0.82} 390,${H*0.66} 390,${H*0.55} 0,${H*0.55}`}
          fill={theme.hill} />
      </g>

      {/* Ground */}
      <rect x="0" y={H * 0.52} width={W} height={H * 0.06} fill={theme.hill} />
      <rect x="0" y={H * 0.52} width={W} height={2}         fill={theme.ground[0]} />

      {/* Campfire */}
      <g transform={`translate(${W * 0.5 - 8} ${H * 0.46})`} shapeRendering="crispEdges">
        <rect x="2" y="10" width="12" height="2" fill={theme.trunkShade} />
        <rect x="4" y="8"  width="8"  height="2" fill={theme.trunk} />
        <g style={{ animation: 'fireGlow 1.2s ease-in-out infinite alternate' }}>
          <rect x="6" y="2" width="4" height="6" fill="#F5A623" />
          <rect x="5" y="4" width="2" height="4" fill="#F5D020" opacity="0.9" />
          <rect x="9" y="5" width="2" height="3" fill="#F5D020" opacity="0.8" />
          <rect x="7" y="1" width="2" height="3" fill="#FFF0A0" opacity="0.9" />
        </g>
        <circle cx="8" cy="6" r="12" fill="#F5A623" opacity="0.12" />
      </g>

      {/* Avatar sprites */}
      <g transform={`translate(${W * 0.5 - 30} ${H * 0.46})`} shapeRendering="crispEdges">
        <AvatarMini kind={userAvatar} size={14} />
      </g>
      <g transform={`translate(${W * 0.5 + 18} ${H * 0.46})`} shapeRendering="crispEdges">
        <AvatarMini kind={opponentAvatar} size={14} />
      </g>

      {/* Fireflies */}
      {theme.fireflies && [
        [60, 160, 0], [110, 145, 1.5], [280, 170, 0.8], [340, 155, 2.2],
      ].map(([cx, cy, delay], i) => (
        <g key={i} style={{ animation: `firefly 4s ${delay}s ease-in-out infinite` }}>
          <circle cx={cx} cy={cy} r="2.5" fill={theme.fireflyColor || '#F4E5A8'} opacity="0.3" />
          <circle cx={cx} cy={cy} r="1"   fill={theme.fireflyColor || '#F4E5A8'} />
        </g>
      ))}

      {/* Drifting cloud */}
      <g style={{ animation: 'drift 80s -20s linear infinite' }} opacity="0.6">
        <g shapeRendering="crispEdges">
          <rect x="-60" y="30" width="36" height="4" fill={theme.cloud} />
          <rect x="-63" y="34" width="42" height="4" fill={theme.cloud} />
          <rect x="-60" y="38" width="36" height="3" fill={theme.cloud} opacity="0.6" />
        </g>
      </g>
    </svg>
  );
}
