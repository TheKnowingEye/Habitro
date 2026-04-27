// Returns YYYY-MM-DD in the user's LOCAL timezone (not UTC).
// Use this everywhere instead of d.toISOString().split('T')[0], which gives UTC date
// and causes off-by-one errors for users in negative UTC offsets.
export function toLocalDateStr(d = new Date()) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
