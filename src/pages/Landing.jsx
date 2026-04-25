import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Shared theme data (mirrors Onboarding.jsx) ───────────────────────────────

const THEMES = {
  dawn: {
    label: 'Dawn',
    sky: ['#F4D4C4', '#E8B8B0', '#D4A59A'],
    sunY: 78, sunColor: '#F7C5A8', sunGlow: 'rgba(247,197,168,0.45)',
    ground: ['#B8B089', '#9CAF88'], hill: '#8A9A7B', hillFar: '#A8B89C',
    treeLeaves: '#7A8F6E', treeLeavesShade: '#5E7356',
    trunk: '#6B4423', trunkShade: '#4A2F18',
    fox: '#C97D60', foxShade: '#A05D45', foxBelly: '#F0DCC8',
    cloud: '#FBEEE4', cloudShade: '#E8D4C8',
    stars: false, fireflies: false, petals: true, petalColor: '#F2C4B8',
    accent: '#C97D60', textPrimary: '#3E2F24', textMuted: '#7A6555',
    panel: '#FBF4E6',
  },
  day: {
    label: 'Day',
    sky: ['#CFE4E8', '#E8EED8', '#F4ECD8'],
    sunY: 22, sunColor: '#F5E5B8', sunGlow: 'rgba(245,229,184,0.55)',
    ground: ['#A8B885', '#9CAF88'], hill: '#88A078', hillFar: '#B0C098',
    treeLeaves: '#7FA06E', treeLeavesShade: '#5F8052',
    trunk: '#6B4423', trunkShade: '#4A2F18',
    fox: '#C97D60', foxShade: '#A05D45', foxBelly: '#F4ECD8',
    cloud: '#FFFFFF', cloudShade: '#E4EBE8',
    stars: false, fireflies: false, petals: false,
    accent: '#6B8E5A', textPrimary: '#2E3E28', textMuted: '#6B7A5A',
    panel: '#FBF4E6',
  },
  dusk: {
    label: 'Dusk',
    sky: ['#E8A878', '#D4847A', '#8B6A8E'],
    sunY: 72, sunColor: '#F2A472', sunGlow: 'rgba(242,164,114,0.55)',
    ground: ['#7A7060', '#6B6555'], hill: '#5E5849', hillFar: '#7A6E5E',
    treeLeaves: '#8B6A5E', treeLeavesShade: '#604A3E',
    trunk: '#4A2F18', trunkShade: '#2E1C0E',
    fox: '#B86A4E', foxShade: '#8A4D36', foxBelly: '#E8CFB8',
    cloud: '#F2C8A4', cloudShade: '#C99A80',
    stars: false, fireflies: true, fireflyColor: '#F5E5B8', petals: false,
    accent: '#C97D60', textPrimary: '#3A2A24', textMuted: '#7A5E4E',
    panel: '#FBF0DC',
  },
  night: {
    label: 'Night',
    sky: ['#2E3855', '#3E4A6E', '#4E5E85'],
    sunY: 25, sunColor: '#F4ECD8', sunGlow: 'rgba(244,236,216,0.35)',
    ground: ['#3A4A3E', '#2E3A32'], hill: '#334038', hillFar: '#45554A',
    treeLeaves: '#3E5548', treeLeavesShade: '#28382E',
    trunk: '#2E1C0E', trunkShade: '#1A0E06',
    fox: '#8A5D4A', foxShade: '#5E3E30', foxBelly: '#C9B89C',
    cloud: '#4E5E85', cloudShade: '#3A4868',
    stars: true, fireflies: true, fireflyColor: '#F4E5A8', petals: false,
    accent: '#E8C478', textPrimary: '#F4ECD8', textMuted: '#B8AE98',
    panel: '#2E3855',
  },
};

function getThemeForHour(h) {
  if (h >= 5  && h < 10) return 'dawn';
  if (h >= 10 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

function darken(hex, amount) {
  if (!hex || !hex.startsWith('#')) return hex;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = Math.max(0, Math.round(parseInt(full.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(full.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(full.slice(4, 6), 16) * (1 - amount)));
  return `rgb(${r},${g},${b})`;
}

function hexA(hex, a) {
  if (!hex || !hex.startsWith('#')) return hex;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Scene SVG (same components as Onboarding) ────────────────────────────────

function SunMoon({ cx, cy, color, glow, isMoon }) {
  const pixels = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      const dx = col - 3, dy = row - 3;
      if (Math.sqrt(dx * dx + dy * dy) > 3.3) continue;
      pixels.push(
        <rect key={`${row}-${col}`}
          x={cx - 10.5 + col * 3} y={cy - 10.5 + row * 3}
          width="3" height="3" fill={color} shapeRendering="crispEdges" />
      );
    }
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r="26" fill={glow} opacity="0.55" />
      <circle cx={cx} cy={cy} r="18" fill={glow} opacity="0.7" />
      <g shapeRendering="crispEdges">
        {pixels}
        {isMoon && <>
          <rect x={cx + 1} y={cy - 6} width="3" height="3" fill="rgba(0,0,0,0.15)" />
          <rect x={cx - 4} y={cy + 1} width="3" height="3" fill="rgba(0,0,0,0.15)" />
        </>}
      </g>
    </g>
  );
}

function PixelCloud({ x, y, scale = 1, color, shade }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} shapeRendering="crispEdges">
      <rect x="6"  y="6"  width="36" height="6" fill={color} />
      <rect x="3"  y="9"  width="42" height="6" fill={color} />
      <rect x="0"  y="12" width="48" height="6" fill={color} />
      <rect x="3"  y="18" width="42" height="3" fill={color} />
      <rect x="3"  y="18" width="42" height="3" fill={shade} opacity="0.35" />
      <rect x="9"  y="15" width="6"  height="3" fill={shade} opacity="0.2" />
      <rect x="30" y="9"  width="6"  height="3" fill={shade} opacity="0.15" />
    </g>
  );
}

function PixelTree({ x, y, leaves, leavesShade, trunk, trunkShade }) {
  return (
    <g transform={`translate(${x} ${y})`} shapeRendering="crispEdges">
      <rect x="24" y="0"  width="30" height="6" fill={leaves} />
      <rect x="18" y="6"  width="42" height="6" fill={leaves} />
      <rect x="12" y="12" width="54" height="6" fill={leaves} />
      <rect x="6"  y="18" width="66" height="6" fill={leaves} />
      <rect x="0"  y="24" width="78" height="6" fill={leaves} />
      <rect x="0"  y="30" width="78" height="6" fill={leaves} />
      <rect x="6"  y="36" width="66" height="6" fill={leaves} />
      <rect x="12" y="42" width="54" height="6" fill={leaves} />
      <rect x="24" y="48" width="30" height="6" fill={leaves} />
      <rect x="6"  y="36" width="66" height="6" fill={leavesShade} opacity="0.45" />
      <rect x="12" y="42" width="54" height="6" fill={leavesShade} opacity="0.5" />
      <rect x="24" y="48" width="30" height="6" fill={leavesShade} opacity="0.55" />
      <rect x="18" y="6"  width="12" height="6" fill="#FFFFFF" opacity="0.08" />
      <rect x="12" y="12" width="18" height="6" fill="#FFFFFF" opacity="0.06" />
      <rect x="30" y="18" width="6"  height="6" fill={leavesShade} opacity="0.3" />
      <rect x="48" y="24" width="6"  height="6" fill={leavesShade} opacity="0.3" />
      <rect x="18" y="30" width="6"  height="6" fill={leavesShade} opacity="0.3" />
      <rect x="54" y="36" width="6"  height="6" fill={leavesShade} opacity="0.35" />
      <rect x="33" y="54" width="12" height="28" fill={trunk} />
      <rect x="33" y="54" width="3"  height="28" fill={trunkShade} opacity="0.55" />
      <rect x="42" y="54" width="3"  height="28" fill="#FFFFFF" opacity="0.05" />
      <rect x="30" y="78" width="18" height="4"  fill={trunk} />
      <rect x="27" y="82" width="24" height="3"  fill={trunkShade} opacity="0.6" />
    </g>
  );
}

function PixelFox({ x, y, body, shade, belly }) {
  return (
    <g transform={`translate(${x} ${y})`} shapeRendering="crispEdges">
      <rect x="0"  y="12" width="6"  height="10" fill={body} />
      <rect x="3"  y="8"  width="6"  height="4"  fill={body} />
      <rect x="6"  y="6"  width="4"  height="3"  fill="#F4ECD8" />
      <rect x="0"  y="20" width="6"  height="2"  fill={shade} opacity="0.5" />
      <rect x="10" y="14" width="18" height="12" fill={body} />
      <rect x="10" y="22" width="18" height="4"  fill={shade} opacity="0.5" />
      <rect x="13" y="18" width="12" height="7"  fill={belly} />
      <rect x="22" y="6"  width="12" height="10" fill={body} />
      <rect x="22" y="13" width="12" height="3"  fill={shade} opacity="0.4" />
      <rect x="22" y="2"  width="4"  height="5"  fill={body} />
      <rect x="30" y="2"  width="4"  height="5"  fill={body} />
      <rect x="23" y="4"  width="2"  height="3"  fill={shade} opacity="0.6" />
      <rect x="31" y="4"  width="2"  height="3"  fill={shade} opacity="0.6" />
      <rect x="25" y="10" width="6"  height="4"  fill={belly} />
      <rect x="25" y="10" width="2"  height="1"  fill={shade} opacity="0.9" />
      <rect x="29" y="10" width="2"  height="1"  fill={shade} opacity="0.9" />
      <rect x="27" y="13" width="2"  height="1"  fill={shade} />
      <rect x="12" y="24" width="3"  height="4"  fill={shade} />
      <rect x="23" y="24" width="3"  height="4"  fill={shade} />
    </g>
  );
}

function Hills({ w, h, near, far }) {
  return (
    <g shapeRendering="crispEdges">
      <path d={`M0 ${h * 0.55} L${w * 0.2} ${h * 0.42} L${w * 0.45} ${h * 0.5} L${w * 0.7} ${h * 0.38} L${w} ${h * 0.48} L${w} ${h} L0 ${h} Z`} fill={far} />
      <path d={`M0 ${h * 0.72} L${w * 0.3} ${h * 0.58} L${w * 0.6} ${h * 0.65} L${w * 0.85} ${h * 0.55} L${w} ${h * 0.62} L${w} ${h} L0 ${h} Z`} fill={near} />
    </g>
  );
}

function Firefly({ cx, cy, color, delay }) {
  return (
    <g style={{ animation: `firefly 4s ${delay}s ease-in-out infinite` }}>
      <circle cx={cx} cy={cy} r="3" fill={color} opacity="0.25" />
      <circle cx={cx} cy={cy} r="1.2" fill={color} />
    </g>
  );
}

function Star({ cx, cy, delay }) {
  return (
    <g shapeRendering="crispEdges" style={{ animation: `twinkle 3s ${delay}s ease-in-out infinite` }}>
      <rect x={cx - 0.5} y={cy - 0.5} width="1" height="1" fill="#F4ECD8" />
    </g>
  );
}

function HeroScene({ theme, height = 520 }) {
  const W = 390, H = height;
  const clouds = [
    { y: 60,  scale: 1.0,  dur: 60, delay: 0 },
    { y: 100, scale: 0.7,  dur: 80, delay: -20 },
    { y: 140, scale: 0.85, dur: 70, delay: -45 },
    { y: 40,  scale: 0.55, dur: 90, delay: -10 },
  ];
  const stars = useMemo(() =>
    [...Array(30)].map((_, i) => ({
      cx: (i * 137.5) % W, cy: (i * 73.1) % 180 + 20, delay: (i * 0.3) % 3,
    })), []);
  const fireflies = useMemo(() =>
    [...Array(12)].map((_, i) => ({
      cx: (i * 97.3) % W, cy: (i * 61.7) % 180 + 260, delay: (i * 0.7) % 4,
    })), []);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%"
         preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`lsky-${theme.label}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={theme.sky[0]} />
          <stop offset="55%"  stopColor={theme.sky[1]} />
          <stop offset="100%" stopColor={theme.sky[2]} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill={`url(#lsky-${theme.label})`} />
      {theme.stars && stars.map((s, i) => <Star key={i} {...s} />)}
      <SunMoon cx={W * 0.72} cy={(H * theme.sunY) / 100 - 50}
               color={theme.sunColor} glow={theme.sunGlow} isMoon={theme.label === 'Night'} />
      <g>
        {clouds.map((c, i) => (
          <g key={i} style={{ animation: `drift ${c.dur}s ${c.delay}s linear infinite` }}>
            <PixelCloud x={-60} y={c.y} scale={c.scale} color={theme.cloud} shade={theme.cloudShade} />
          </g>
        ))}
      </g>
      <g transform={`translate(0 ${H * 0.2})`}>
        <Hills w={W} h={H * 0.8} near={theme.hill} far={theme.hillFar} />
      </g>
      <rect x="0" y={H - 90} width={W} height="90" fill={theme.ground[1]} />
      <rect x="0" y={H - 90} width={W} height="6"  fill={theme.ground[0]} />
      <g style={{ animation: 'sway 6s ease-in-out infinite', transformOrigin: `179px ${H - 90 + 82}px` }}>
        <PixelTree x={140} y={H - 210}
          leaves={theme.treeLeaves} leavesShade={theme.treeLeavesShade}
          trunk={theme.trunk} trunkShade={theme.trunkShade} />
      </g>
      <g style={{ animation: 'breathe 3.2s ease-in-out infinite', transformOrigin: `205px ${H - 100}px` }}>
        <PixelFox x={190} y={H - 128} body={theme.fox} shade={theme.foxShade} belly={theme.foxBelly} />
      </g>
      <g shapeRendering="crispEdges">
        {[30, 75, 110, 260, 305, 340].map((gx, i) => (
          <g key={i}>
            <rect x={gx}     y={H - 88} width="2" height="4" fill={theme.treeLeavesShade} opacity="0.7" />
            <rect x={gx + 3} y={H - 86} width="2" height="3" fill={theme.treeLeavesShade} opacity="0.6" />
          </g>
        ))}
      </g>
      {theme.fireflies && fireflies.map((f, i) => (
        <Firefly key={i} {...f} color={theme.fireflyColor} />
      ))}
      {theme.petals && [...Array(8)].map((_, i) => (
        <g key={i} style={{ animation: `fall ${8 + i}s ${-i * 1.2}s linear infinite` }}>
          <rect x={30 + i * 45} y="-10" width="3" height="3"
            fill={theme.petalColor} opacity="0.75" shapeRendering="crispEdges" />
        </g>
      ))}
    </svg>
  );
}

// ── UI helpers ───────────────────────────────────────────────────────────────

function Wordmark({ color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="22" height="22" viewBox="0 0 22 22" shapeRendering="crispEdges">
        <rect x="9"  y="14" width="4" height="6" fill={color} opacity="0.85" />
        <rect x="7"  y="8"  width="8" height="6" fill={color} opacity="0.8" />
        <rect x="5"  y="10" width="3" height="3" fill={color} opacity="0.6" />
        <rect x="14" y="10" width="3" height="3" fill={color} opacity="0.6" />
        <rect x="10" y="4"  width="2" height="5" fill={color} opacity="0.9" />
      </svg>
      <span style={{
        fontFamily: '"Silkscreen", monospace',
        fontSize: 16, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color,
      }}>HABITRO</span>
    </div>
  );
}

function TimeBadge({ theme, themeKey }) {
  const labels = { dawn: 'dawn', day: 'day', dusk: 'dusk', night: 'night' };
  return (
    <div style={{
      padding: '5px 11px',
      background: hexA(theme.panel, 0.75),
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: `1px solid ${hexA(theme.textMuted, 0.2)}`,
      borderRadius: 999,
      fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: theme.textPrimary, fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accent, boxShadow: `0 0 6px ${theme.accent}`, display: 'inline-block' }} />
      {labels[themeKey]}
    </div>
  );
}

function PixelButton({ label, accent, onClick, variant = 'primary', dark }) {
  const [pressed, setPressed] = useState(false);
  const isPrimary = variant === 'primary';
  const bg          = isPrimary ? accent : dark ? '#3E4A6E' : '#FBF4E6';
  const ink         = isPrimary ? '#FBF4E6' : dark ? '#F4ECD8' : '#3E2F24';
  const shadowColor = isPrimary ? darken(accent, 0.35) : dark ? '#1E2640' : 'rgba(62,47,36,0.55)';
  const borderColor = isPrimary ? darken(accent, 0.2)  : dark ? '#2E3855' : 'rgba(62,47,36,0.25)';
  return (
    <button
      onClick={onClick}
      type="button"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        position: 'relative', display: 'block', width: '100%',
        padding: '16px 20px',
        background: bg,
        border: `2px solid ${borderColor}`,
        borderRadius: 10,
        fontFamily: '"Silkscreen", monospace',
        fontWeight: 700, fontSize: 13,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: ink, cursor: 'pointer',
        boxShadow: pressed ? `0 0 0 ${shadowColor}` : `0 5px 0 ${shadowColor}`,
        transform: pressed ? 'translateY(5px)' : 'translateY(0)',
        transition: 'transform 0.08s ease-out, box-shadow 0.08s ease-out',
      }}
    >{label}</button>
  );
}

function FeatureCard({ theme, number, icon, title, body }) {
  return (
    <div style={{
      marginBottom: 18, padding: '22px 20px',
      background: hexA('#FFFFFF', 0.5),
      border: `1px solid ${hexA(theme.textMuted, 0.15)}`,
      borderRadius: 18,
      display: 'flex', gap: 16,
    }}>
      <div style={{
        flexShrink: 0, width: 52, height: 52,
        borderRadius: 14,
        background: hexA(theme.accent, 0.12),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: '"Caveat", cursive', fontSize: 15, color: theme.accent, marginBottom: 2 }}>
          chapter {number}
        </div>
        <h3 style={{ margin: '0 0 6px', fontFamily: '"Fraunces", serif', fontSize: 18, fontWeight: 500, color: theme.textPrimary }}>
          {title}
        </h3>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: theme.textMuted }}>
          {body}
        </p>
      </div>
    </div>
  );
}

const DuelIcon = ({ color }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" shapeRendering="crispEdges">
    {[4,6,8,10,12,14,16,18,20].map((y, i) => <rect key={`a${i}`} x={5 + i*2} y={y} width="2" height="2" fill={color} />)}
    {[4,6,8,10,14,16,18,20].map((y, i) => <rect key={`b${i}`} x={21 - i*2} y={y} width="2" height="2" fill={color} />)}
  </svg>
);

const FeedIcon = ({ color }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" shapeRendering="crispEdges">
    <rect x="5"  y="6"  width="18" height="16" fill="none" stroke={color} strokeWidth="2" />
    <rect x="8"  y="9"  width="12" height="8"  fill={color} opacity="0.35" />
    <rect x="10" y="12" width="3"  height="3"  fill={color} />
    <rect x="15" y="11" width="4"  height="4"  fill={color} opacity="0.7" />
  </svg>
);

const RankIcon = ({ color }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" shapeRendering="crispEdges">
    <rect x="10" y="18" width="2" height="5" fill={color} />
    <rect x="8"  y="10" width="6" height="8" fill={color} opacity="0.85" />
    <rect x="6"  y="12" width="2" height="4" fill={color} opacity="0.7" />
    <rect x="14" y="12" width="2" height="4" fill={color} opacity="0.7" />
    <rect x="19" y="20" width="2" height="4" fill={color} />
    <rect x="17" y="14" width="6" height="6" fill={color} opacity="0.75" />
    <rect x="15" y="16" width="2" height="3" fill={color} opacity="0.6" />
    <rect x="23" y="16" width="2" height="3" fill={color} opacity="0.6" />
  </svg>
);

const Leaf = ({ color, style }) => (
  <svg width="40" height="40" viewBox="0 0 40 40" shapeRendering="crispEdges" style={style}>
    <rect x="18" y="6"  width="6"  height="4" fill={color} />
    <rect x="14" y="10" width="14" height="4" fill={color} />
    <rect x="10" y="14" width="22" height="4" fill={color} />
    <rect x="14" y="18" width="18" height="4" fill={color} />
    <rect x="18" y="22" width="12" height="4" fill={color} />
    <rect x="22" y="26" width="6"  height="8" fill={color} opacity="0.7" />
  </svg>
);

// ── Main page ────────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const themeKey = getThemeForHour(now.getHours());
  const theme    = THEMES[themeKey];
  const dark     = themeKey === 'night';

  const greet = themeKey === 'dawn' ? 'Good morning'
              : themeKey === 'day'  ? 'Hello there'
              : themeKey === 'dusk' ? 'Good evening'
              : 'A quiet night';

  const HERO_H = Math.max(window.innerHeight, 600);

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.panel,
      fontFamily: '"Quicksand", -apple-system, sans-serif',
      color: theme.textPrimary,
    }}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section style={{ position: 'relative', height: HERO_H }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <HeroScene theme={theme} height={HERO_H} />
        </div>

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '56px 20px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 2,
        }}>
          <Wordmark color={theme.textPrimary} />
          <TimeBadge theme={theme} themeKey={themeKey} />
        </div>

        {/* Hero copy + CTAs */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '24px 24px 36px',
          zIndex: 2,
        }}>
          {/* Vignette */}
          <div style={{
            position: 'absolute',
            inset: '-60px 0 0 0',
            background: `linear-gradient(180deg, transparent 0%, ${hexA(theme.panel, 0.85)} 55%, ${theme.panel} 100%)`,
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative' }}>
            <p style={{
              margin: 0,
              fontFamily: '"Caveat", cursive',
              fontSize: 22, color: theme.textMuted, letterSpacing: '0.01em',
            }}>{greet},</p>
            <h1 style={{
              margin: '6px 0 14px',
              fontFamily: '"Silkscreen", monospace',
              fontSize: 24, lineHeight: 1.25, fontWeight: 700,
              letterSpacing: '0.02em', textTransform: 'uppercase',
              color: theme.textPrimary,
            }}>
              Together<br />feels stronger.
            </h1>
            <p style={{
              margin: '0 0 22px', fontSize: 14, lineHeight: 1.55,
              color: theme.textMuted, maxWidth: 300,
            }}>
              A habit tracker with a pulse. Matched every Monday with one real person — seven days, side by side, may the most consistent soul win.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PixelButton
                label="Start your journey"
                accent={theme.accent}
                dark={dark}
                onClick={() => navigate('/onboarding?mode=signup')}
              />
              <PixelButton
                label="Sign in"
                variant="secondary"
                accent={theme.accent}
                dark={dark}
                onClick={() => navigate('/onboarding?mode=signin')}
              />
            </div>

            <div style={{
              marginTop: 18, textAlign: 'center',
              fontFamily: '"Caveat", cursive',
              fontSize: 17, color: theme.textMuted,
              animation: 'bob 2.5s ease-in-out infinite',
            }}>
              scroll to wander ↓
            </div>
          </div>
        </div>
      </section>

      {/* ── Story ────────────────────────────────────────────── */}
      <section style={{ padding: '56px 24px 32px', position: 'relative' }}>
        <Leaf style={{ position: 'absolute', top: 28, right: 18, opacity: 0.35 }} color={theme.treeLeaves} />
        <p style={{
          margin: 0,
          fontFamily: '"Silkscreen", monospace',
          fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: theme.accent,
        }}>// the quiet idea</p>
        <h2 style={{
          margin: '10px 0 16px',
          fontFamily: '"Silkscreen", monospace',
          fontSize: 19, lineHeight: 1.35, fontWeight: 700,
          letterSpacing: '0.01em', textTransform: 'uppercase',
          color: theme.textPrimary,
        }}>Willpower is a<br />lonely game.</h2>
        <p style={{ margin: '0 0 14px', fontSize: 14.5, lineHeight: 1.65, color: theme.textMuted }}>
          Alone, we coast. Paired up, we show up. The gentlest form of pressure is a person watching whether you did the thing today.
        </p>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: theme.textMuted }}>
          Habitro pairs you with one real opponent every week. Seven days of quiet competition. Winner keeps their grove. Loser tends theirs harder.
        </p>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section style={{ padding: '8px 24px 48px' }}>
        <FeatureCard theme={theme} number="01" icon={<DuelIcon color={theme.accent} />}
          title="Weekly Duel"
          body="Every Monday you're matched with one real opponent. Seven days. Whoever tends their habits most wins the round." />
        <FeatureCard theme={theme} number="02" icon={<FeedIcon color={theme.accent} />}
          title="Proof Feed"
          body="Drop a photo, a note, a small sign you showed up. Honest evidence — for you and the person you're running with." />
        <FeatureCard theme={theme} number="03" icon={<RankIcon color={theme.accent} />}
          title="Grow Your Grove"
          body="Win weeks to climb ranks and grow your grove. Slip and it thins. Your garden reflects who you actually are." />
      </section>

      {/* ── Week timeline ─────────────────────────────────────── */}
      <section style={{
        margin: '0 24px 48px',
        padding: '28px 22px',
        background: hexA(theme.accent, 0.08),
        border: `1px solid ${hexA(theme.accent, 0.2)}`,
        borderRadius: 18,
        position: 'relative',
      }}>
        <p style={{ margin: 0, fontFamily: '"Caveat", cursive', fontSize: 20, color: theme.accent }}>
          a week in Habitro —
        </p>
        <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            ['Mon', 'Meet your companion. Pick one habit to tend.'],
            ['Wed', 'Drop a small proof. A photo, a note, a mark on the page.'],
            ['Sat', 'Cheer them on. Let yourself be cheered on.'],
            ['Sun', 'The week closes softly. Your grove breathes forward.'],
          ].map(([day, text]) => (
            <li key={day} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{
                flexShrink: 0, width: 42,
                fontFamily: '"Caveat", cursive', fontSize: 20,
                color: theme.accent, paddingTop: 2,
              }}>{day}</span>
              <span style={{ fontSize: 14.5, lineHeight: 1.55, color: theme.textPrimary }}>
                {text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Closing CTA ───────────────────────────────────────── */}
      <section style={{ padding: '16px 24px 56px', textAlign: 'center' }}>
        <h3 style={{
          margin: '0 0 8px',
          fontFamily: '"Fraunces", serif',
          fontSize: 24, lineHeight: 1.2, fontWeight: 500,
          color: theme.textPrimary,
        }}>The path is nicer with company.</h3>
        <p style={{ margin: '0 0 22px', fontSize: 14.5, color: theme.textMuted }}>
          Free to begin. Your first companion is waiting next Monday.
        </p>
        <PixelButton
          label="Start your journey"
          accent={theme.accent}
          dark={dark}
          onClick={() => navigate('/onboarding?mode=signup')}
        />
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer style={{
        padding: '20px 24px 36px',
        textAlign: 'center',
        fontSize: 12, color: theme.textMuted,
        fontFamily: '"Caveat", cursive',
        borderTop: `1px solid ${hexA(theme.textMuted, 0.15)}`,
      }}>
        made quietly · Habitro {new Date().getFullYear()}
      </footer>
    </div>
  );
}
