import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ── Time-of-day themes ───────────────────────────────────────────────────────

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
  if (h >= 5 && h < 10) return 'dawn';
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

// ── SVG scene components ─────────────────────────────────────────────────────

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

function HeroScene({ theme }) {
  const W = 390, H = 520;
  const clouds = [
    { y: 60,  scale: 1.0,  dur: 60, delay: 0 },
    { y: 100, scale: 0.7,  dur: 80, delay: -20 },
    { y: 140, scale: 0.85, dur: 70, delay: -45 },
    { y: 40,  scale: 0.55, dur: 90, delay: -10 },
  ];
  const stars = useMemo(() =>
    [...Array(30)].map((_, i) => ({
      cx: (i * 137.5) % W,
      cy: (i * 73.1) % 180 + 20,
      delay: (i * 0.3) % 3,
    })), []);
  const fireflies = useMemo(() =>
    [...Array(12)].map((_, i) => ({
      cx: (i * 97.3) % W,
      cy: (i * 61.7) % 180 + 260,
      delay: (i * 0.7) % 4,
    })), []);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%"
         preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sky-${theme.label}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={theme.sky[0]} />
          <stop offset="55%"  stopColor={theme.sky[1]} />
          <stop offset="100%" stopColor={theme.sky[2]} />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={W} height={H} fill={`url(#sky-${theme.label})`} />

      {theme.stars && stars.map((s, i) => <Star key={i} {...s} />)}

      <SunMoon
        cx={W * 0.72}
        cy={(H * theme.sunY) / 100 - 50}
        color={theme.sunColor}
        glow={theme.sunGlow}
        isMoon={theme.label === 'Night'}
      />

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

      <g style={{ animation: 'sway 6s ease-in-out infinite', transformOrigin: `${140 + 39}px ${H - 90 + 82}px` }}>
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

// ── Form primitives ──────────────────────────────────────────────────────────

function PixelInput({ label, type = 'text', value, onChange, placeholder, dark, accent,
                      required, minLength, maxLength, autoComplete, autoCapitalize, spellCheck }) {
  const [focused, setFocused] = useState(false);
  const border      = dark ? '#2E3855'              : 'rgba(62,47,36,0.2)';
  const shadow      = dark ? '#1E2640'              : 'rgba(62,47,36,0.35)';
  const ink         = dark ? '#F4ECD8'              : '#3E2F24';
  const bg          = dark ? '#3E4A6E'              : '#FBF4E6';
  const labelColor  = dark ? '#B8AE98'              : '#7A6555';

  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{
        display: 'block',
        fontFamily: '"Silkscreen", monospace',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: labelColor,
        marginBottom: 6,
        paddingLeft: 2,
      }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: bg,
          border: `2px solid ${border}`,
          borderRadius: 10,
          fontFamily: '"Quicksand", sans-serif',
          fontSize: 15,
          fontWeight: 500,
          color: ink,
          outline: 'none',
          boxSizing: 'border-box',
          boxShadow: focused
            ? `0 3px 0 ${shadow}, 0 0 0 3px ${accent}40`
            : `0 3px 0 ${shadow}`,
          transition: 'box-shadow 0.1s ease',
        }}
      />
    </label>
  );
}

function PixelSegmented({ value, options, onChange, accent, dark }) {
  const bg          = dark ? 'rgba(30,38,64,0.5)'   : 'rgba(62,47,36,0.08)';
  const inactiveInk = dark ? '#B8AE98'              : '#7A6555';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${options.length}, 1fr)`,
      gap: 8,
      padding: 6,
      background: bg,
      borderRadius: 12,
      marginBottom: 24,
    }}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '11px 10px',
              background: active ? accent : 'transparent',
              border: 'none',
              borderRadius: 8,
              fontFamily: '"Silkscreen", monospace',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: active ? '#FBF4E6' : inactiveInk,
              cursor: 'pointer',
              boxShadow: active ? `0 3px 0 ${darken(accent, 0.35)}` : 'none',
              transform: active ? 'translateY(-1px)' : 'translateY(0)',
              transition: 'all 0.12s ease',
            }}
          >{opt.label}</button>
        );
      })}
    </div>
  );
}

function PixelDivider({ label, dark }) {
  const line = dark ? 'rgba(184,174,152,0.25)' : 'rgba(62,47,36,0.18)';
  const text = dark ? '#B8AE98'               : '#7A6555';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
      <div style={{ flex: 1, height: 1, background: line }} />
      <span style={{
        fontFamily: '"Silkscreen", monospace',
        fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: text,
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: line }} />
    </div>
  );
}

function SocialButton({ icon, label, dark }) {
  const [pressed, setPressed] = useState(false);
  const bg     = dark ? '#3E4A6E'              : '#FBF4E6';
  const border  = dark ? '#2E3855'             : 'rgba(62,47,36,0.2)';
  const shadow  = dark ? '#1E2640'             : 'rgba(62,47,36,0.35)';
  const ink     = dark ? '#F4ECD8'             : '#3E2F24';
  return (
    <button
      type="button"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        flex: 1, padding: '12px 10px',
        background: bg, border: `2px solid ${border}`, borderRadius: 10,
        fontFamily: '"Silkscreen", monospace',
        fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: ink, cursor: 'pointer',
        boxShadow: pressed ? `0 0 0 ${shadow}` : `0 4px 0 ${shadow}`,
        transform: pressed ? 'translateY(4px)' : 'translateY(0)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'transform 0.08s ease, box-shadow 0.08s ease',
      }}
    >
      {icon}{label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 384 512">
      <path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
    </svg>
  );
}

function PixelButton({ label, accent, loading }) {
  const [pressed, setPressed] = useState(false);
  const shadowColor  = darken(accent, 0.35);
  const borderColor  = darken(accent, 0.2);
  return (
    <button
      type="submit"
      disabled={loading}
      onMouseDown={() => !loading && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        position: 'relative', display: 'block', width: '100%',
        padding: '16px 20px',
        background: accent,
        border: `2px solid ${borderColor}`,
        borderRadius: 10,
        fontFamily: '"Silkscreen", monospace',
        fontWeight: 700, fontSize: 13,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: '#FBF4E6',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        boxShadow: pressed ? `0 0 0 ${shadowColor}` : `0 5px 0 ${shadowColor}`,
        transform: pressed ? 'translateY(5px)' : 'translateY(0)',
        transition: 'transform 0.08s ease-out, box-shadow 0.08s ease-out',
      }}
    >
      {loading ? '···' : label}
    </button>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode]         = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [now, setNow]           = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const themeKey = getThemeForHour(now.getHours());
  const theme    = THEMES[themeKey];
  const dark     = themeKey === 'night';

  function switchMode(m) {
    setMode(m);
    setError('');
    setInfo('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');

    if (mode === 'signup') {
      const trimmed = username.trim();
      if (trimmed.length < 3) {
        setError('Username must be at least 3 characters.');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        setError('Username: letters, numbers & underscores only.');
        return;
      }
    }

    setLoading(true);

    if (mode === 'signup') {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username.trim() } },
      });
      if (err) {
        setError(err.message);
      } else {
        setInfo('Check your email for a confirmation link, then sign in.');
        switchMode('signin');
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
      } else {
        navigate('/');
      }
    }

    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) { setError('Enter your email above first.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (err) setError(err.message);
    else setInfo('Reset link sent — check your inbox.');
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.panel,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Quicksand", -apple-system, sans-serif',
      color: theme.textPrimary,
    }}>
      {/* ── Hero scene ───────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 280, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <HeroScene theme={theme} />
        </div>
        {/* Fade into form */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 60,
          background: `linear-gradient(180deg, transparent 0%, ${theme.panel} 100%)`,
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── Form area ────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '0 24px 40px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <h1 style={{
            margin: '0 0 6px',
            fontFamily: '"Silkscreen", monospace',
            fontSize: 20, fontWeight: 700,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            color: theme.textPrimary,
          }}>
            {mode === 'signin' ? 'Welcome back' : 'Join the duel'}
          </h1>
          <p style={{
            margin: 0, fontSize: 13,
            fontFamily: '"Silkscreen", monospace',
            letterSpacing: '0.05em',
            color: theme.textMuted,
          }}>
            {mode === 'signin' ? 'your grove is waiting' : 'first match begins monday'}
          </p>
        </div>

        <PixelSegmented
          value={mode}
          onChange={switchMode}
          accent={theme.accent}
          dark={dark}
          options={[
            { value: 'signin', label: 'Sign in' },
            { value: 'signup', label: 'Sign up' },
          ]}
        />

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <PixelInput
              label="Player name"
              placeholder="Pick a handle"
              value={username}
              onChange={setUsername}
              dark={dark}
              accent={theme.accent}
              required
              minLength={3}
              maxLength={30}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
          )}
          <PixelInput
            label="Email"
            type="email"
            placeholder="you@home.world"
            value={email}
            onChange={setEmail}
            dark={dark}
            accent={theme.accent}
            required
            autoComplete="email"
          />
          <PixelInput
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            dark={dark}
            accent={theme.accent}
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />

          {mode === 'signin' && (
            <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 16 }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer',
                  fontFamily: '"Silkscreen", monospace',
                  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: theme.accent,
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <p style={{
              fontFamily: '"Silkscreen", monospace',
              fontSize: 10, letterSpacing: '0.06em',
              color: '#C94040', textAlign: 'center', marginBottom: 12,
            }}>{error}</p>
          )}
          {info && (
            <p style={{
              fontFamily: '"Silkscreen", monospace',
              fontSize: 10, letterSpacing: '0.06em',
              color: theme.accent, textAlign: 'center', marginBottom: 12,
            }}>{info}</p>
          )}

          <div style={{ marginTop: 8 }}>
            <PixelButton
              label={mode === 'signin' ? 'Log in' : 'Create account'}
              accent={theme.accent}
              loading={loading}
            />
          </div>
        </form>

        <PixelDivider label="or" dark={dark} />

        <div style={{ display: 'flex', gap: 10 }}>
          <SocialButton icon={<GoogleIcon />} label="Google" dark={dark} />
          <SocialButton icon={<AppleIcon />} label="Apple" dark={dark} />
        </div>

        {mode === 'signup' && (
          <p style={{
            margin: '22px 0 0', textAlign: 'center',
            fontSize: 11.5, lineHeight: 1.5, color: theme.textMuted,
          }}>
            By signing up you agree to play fair, tend your grove, and read our{' '}
            <a href="#" style={{ color: theme.accent }}>terms</a>
            {' '}&amp;{' '}
            <a href="#" style={{ color: theme.accent }}>privacy</a>.
          </p>
        )}
      </div>
    </div>
  );
}
