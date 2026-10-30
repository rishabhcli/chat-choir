/** Stable FNV-1a hash on UTF-16 code units. */
export function hash(value) {
  let h = 2166136261;
  for (const c of String(value)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function userPan(id) { return ((hash(id) % 181) - 90) / 100; }
export function userColor(id) { return `hsl(${hash(id) % 360} 75% 65%)`; }
