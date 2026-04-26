export function darken(hex, amount) {
  if (!hex || !hex.startsWith('#')) return hex;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = Math.max(0, Math.round(parseInt(full.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(full.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(full.slice(4, 6), 16) * (1 - amount)));
  return `rgb(${r},${g},${b})`;
}
