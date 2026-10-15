/** Acepta números o strings con coma decimal ("1,5"). Devuelve `fallback` si no es válido. */
export function toNumber(v, fallback) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.').trim());
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}
