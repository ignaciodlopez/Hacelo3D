// Superficie de las piezas de revolución con textura (pantallas de lámpara, mates): silueta (perfil) + relieve.
// Pura matemática, sin manifold: devuelve radios para armar los anillos de `rings.js`.
//
// Parámetros que lee (los comparten las herramientas): profile, bottomDiameterMm, midDiameterMm, midPosition,
// topDiameterMm, pattern, patternCount, patternDepthMm, patternPeriodMm, twistDeg.

/** Tope de vértices por vuelta (ondas muy finas, como las 100 estrías de Sophie, necesitan bastantes). */
const MAX_SEGMENTS = 1536;

/** Perfil "florero": hasta qué altura relativa llega el hombro de abajo y desde cuál empieza el de arriba. */
const VASE_LOW = 0.2;
const VASE_HIGH = 0.75;

/** Radio de la silueta (sin textura) a la altura relativa t ∈ [0, 1] del cuerpo. */
export function profileRadius(p, t) {
  const Rb = p.bottomDiameterMm / 2;
  const Rt = p.topDiameterMm / 2;
  if (p.profile === 'straight') return Rb + (Rt - Rb) * t;
  if (p.profile === 'vase') {
    // florero: hombro redondeado abajo, tramo recto en el medio y hombro que cierra arriba
    const Rv = p.midDiameterMm / 2;
    if (t <= VASE_LOW) return Rb + (Rv - Rb) * Math.sin(((t / VASE_LOW) * Math.PI) / 2);
    if (t < VASE_HIGH) return Rv;
    return Rv + (Rt - Rv) * (1 - Math.cos((((t - VASE_HIGH) / (1 - VASE_HIGH)) * Math.PI) / 2));
  }
  const Rm = p.midDiameterMm / 2;
  const m = p.midPosition;
  // dos cuartos de onda que se juntan con pendiente cero en la panza (o la cintura)
  if (t <= m) return Rb + (Rm - Rb) * Math.sin(((t / m) * Math.PI) / 2);
  return Rm + (Rt - Rm) * (1 - Math.cos((((t - m) / (1 - m)) * Math.PI) / 2));
}

/**
 * Radio de la superficie con textura. La textura solo SUMA hacia afuera: la silueta es el radio mínimo.
 * @param {number} zp  altura desde el inicio del cuerpo (mm), para las texturas que cambian con la altura
 */
export function surfaceRadius(p, R, angle, zp, t) {
  const n = p.patternCount;
  const A = p.patternDepthMm;
  const P = p.patternPeriodMm;
  const th = angle - ((p.twistDeg * Math.PI) / 180) * t;
  switch (p.pattern) {
    case 'waves':
      return R + A * 0.5 * (1 + Math.cos(n * th));
    case 'ribs':
      return R + A * Math.abs(Math.cos((n * th) / 2));
    case 'facets': {
      const sec = (2 * Math.PI) / n;
      const phi = (((th % sec) + sec) % sec) - sec / 2;
      return R / Math.cos(phi);
    }
    case 'rings':
      return R + A * 0.5 * (1 + Math.cos((2 * Math.PI * zp) / P));
    case 'bubbles':
      return R + A * 0.5 * (1 + Math.cos(n * th) * Math.cos((2 * Math.PI * zp) / P));
    case 'zigzag': {
      const f = zp / P + 0.25;
      const tri = 2 * Math.abs(2 * (f - Math.floor(f)) - 1) - 1;
      return R + A * 0.5 * (1 + Math.cos(n * (th + ((0.8 * Math.PI) / n) * tri)));
    }
    case 'star':
      // picos filosos y valles redondeados (al revés que los gajos)
      return R + A * (1 - Math.abs(Math.sin((n * th) / 2))) ** 1.5;
    case 'scales': {
      // hileras de escamas como tejas: cada una sube suave (sin voladizo) desde el borde de abajo y se afina hacia arriba;
      // las hileras impares van corridas media escama
      const f = zp / P;
      const row = Math.floor(f);
      const u = f - row;
      const s = u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6;
      const w = 0.5 * (1 + Math.cos(n * th + Math.PI * (row & 1)));
      return R + A * s * Math.sqrt(w);
    }
    case 'lattice': {
      // costillas finas en diagonal, en las dos direcciones, que se cruzan formando rombos
      const k = (2 * Math.PI * zp) / P;
      const g = (x) => (0.5 * (1 + Math.cos(x))) ** 5;
      return R + A * Math.max(g(n * th + k), g(n * th - k));
    }
    case 'diamonds': {
      // como el enrejado pero con costillas más anchas y valles en forma de rombo (ajustado a la pantalla "Diamonds")
      const k = (2 * Math.PI * zp) / P;
      const g = (x) => (0.5 * (1 + Math.cos(x))) ** 3;
      return R + A * Math.max(0, Math.max(g(n * th + k), g(n * th - k)) - 0.05);
    }
    case 'fluted': {
      // estrías finas verticales que nacen y se apagan suavemente en las puntas (como la pantalla "Sophie")
      const e = (a, b, x) => {
        const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return u * u * (3 - 2 * u);
      };
      return R + A * 0.5 * (1 + Math.cos(n * th)) * e(0, 0.2, t) * e(1, 0.85, t);
    }
    case 'honeycomb': {
      // paredes en forma de panal: n celdas alrededor y una hilera cada P mm (regular si P ≈ 0,87 × ancho de celda)
      const x = (n * th) / (2 * Math.PI);
      const y = (zp / P) * 0.866;
      const j0 = Math.floor(y / 0.866);
      let d1 = Infinity;
      let d2 = Infinity;
      for (let j = j0 - 1; j <= j0 + 2; j++) {
        const off = (j & 1) * 0.5;
        const i0 = Math.round(x - off);
        for (let i = i0 - 1; i <= i0 + 1; i++) {
          const d = Math.hypot(x - (i + off), y - j * 0.866);
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) d2 = d;
        }
      }
      const e = Math.min(1, (d2 - d1) / 0.5);
      return R + A * (1 - e * e * (3 - 2 * e));
    }
    default:
      return R;
  }
}

/** Texturas que se repiten en vertical (necesitan anillos más juntos). */
export const VERTICAL_PATTERNS = ['rings', 'bubbles', 'zigzag', 'scales', 'lattice', 'diamonds', 'honeycomb'];
/** Texturas que se repiten alrededor (cantidad), con los vértices por repetición que necesitan. */
const AROUND_VERTS = { waves: 12, ribs: 12, facets: 8, bubbles: 12, zigzag: 12, star: 16, scales: 16, lattice: 32, diamonds: 32, fluted: 12, honeycomb: 16 };

/** Vértices por vuelta: los de la calidad elegida, con al menos 10 por período de la textura. */
export function patternSegments(p, base) {
  const need = (AROUND_VERTS[p.pattern] ?? 0) * p.patternCount;
  return Math.min(MAX_SEGMENTS, Math.max(base, Math.ceil(need / 8) * 8));
}

// ---- textura en el panel (la misma lista y los mismos valores iniciales para todas las herramientas)

export const COUNT_PATTERNS = ['waves', 'ribs', 'facets', 'bubbles', 'zigzag', 'star', 'scales', 'lattice', 'diamonds', 'fluted', 'honeycomb'];
export const usesCount = (p) => COUNT_PATTERNS.includes(p.pattern);
export const usesDepth = (p) => !['smooth', 'facets'].includes(p.pattern);
export const usesPeriod = (p) => ['rings', 'bubbles', 'zigzag', 'scales', 'lattice', 'diamonds', 'honeycomb'].includes(p.pattern);
export const usesTwist = usesCount;

export const PATTERNS = ['smooth', 'waves', 'ribs', 'facets', 'rings', 'bubbles', 'zigzag', 'star', 'scales', 'lattice', 'diamonds', 'fluted', 'honeycomb'];

/** Cantidad, profundidad, separación y giro con los que cada textura se ve bien; se aplican al elegirla. */
export const PATTERN_DEFAULTS = {
  waves: { patternCount: 18, patternDepthMm: 4, twistDeg: 120 },
  ribs: { patternCount: 24, patternDepthMm: 3, twistDeg: 0 },
  facets: { patternCount: 10, twistDeg: 72 },
  rings: { patternDepthMm: 2.5, patternPeriodMm: 16 },
  bubbles: { patternCount: 14, patternDepthMm: 4, patternPeriodMm: 22, twistDeg: 0 },
  zigzag: { patternCount: 16, patternDepthMm: 4, patternPeriodMm: 30, twistDeg: 0 },
  star: { patternCount: 8, patternDepthMm: 9, twistDeg: 180 },
  scales: { patternCount: 18, patternDepthMm: 3.5, patternPeriodMm: 16, twistDeg: 0 },
  lattice: { patternCount: 12, patternDepthMm: 3, patternPeriodMm: 40, twistDeg: 0 },
  honeycomb: { patternCount: 14, patternDepthMm: 3, patternPeriodMm: 20, twistDeg: 0 },
  diamonds: { patternCount: 6, patternDepthMm: 7.5, patternPeriodMm: 58, twistDeg: 0 },
  fluted: { patternCount: 100, patternDepthMm: 1.2, twistDeg: 0 },
};
