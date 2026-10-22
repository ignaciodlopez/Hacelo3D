// Cuerpo del mate: silueta + textura por fuera y, por dentro, el NEGATIVO del interior de aluminio.
//
// Todo se arma "por anillos" (core/kernel/rings.js), sin booleanas: una sola cadena de contornos que sube por la cara
// de afuera, cruza el borde y baja por el hueco hasta el piso. Se imprime parado, con la boca hacia arriba.
//
// Ejes: z = 0 es la base del mate. El fondo del interior queda en z = zInsert; `y` es la altura medida desde ese fondo.

import { polarRing, solidFromRings } from '../../core/kernel/rings.js';
import { profileRadius, surfaceRadius, VERTICAL_PATTERNS, patternSegments } from '../../core/kernel/surface.js';

/** Grosor mínimo de la base bajo el interior (mm). */
export const MIN_FLOOR = 3;
/** Alto del chaflán del canto de abajo del mate (mm). */
const EDGE = 1.2;
/** Pendiente máxima (tan 65°) con la que se engrosa la pared: más tumbado que eso lo cubre el piso. */
const MAX_SLOPE = 2.14;
/** Pendiente (mm de radio por mm de alto) con la que se reparte un ensanche de la silueta: ~7°, apenas se nota. */
const FAIR = 0.12;
/** Tope de triángulos: texturas finas en una pieza alta llegan a millones y cuelgan el visor y el slicer. */
const MAX_TRIS = 1_000_000;
const ARC_STEPS = 8;

/**
 * Radio exterior del interior de aluminio a la altura `y` desde su fondo: cuerpo apenas cónico,
 * campana cóncava que termina abierta unos 40° sobre la horizontal y canto de abajo redondeado.
 */
export function insertRadius(p, y) {
  const Rb = p.insertBaseDiameterMm / 2;
  const Rc = p.insertBodyDiameterMm / 2;
  const Rm = p.insertMouthDiameterMm / 2;
  const H = p.insertHeightMm;
  const F = p.insertFlareHeightMm;
  const f = p.insertBaseRadiusMm;
  const y0 = H - F;
  let r;
  if (y <= y0) r = Rb + (Rc - Rb) * (y / y0);
  else r = Rc + (Rm - Rc) * (1 - Math.cos((Math.min(1, (y - y0) / F) * Math.PI) / 2));
  if (y < f) r -= f - Math.sqrt(Math.max(0, f * f - (f - y) ** 2));
  return r;
}

/** Cuánto sobresale el borde enrollado del interior por encima del mate (0 si queda al ras). */
export const lipAbove = (p) => (p.rimMode === 'rest' ? p.rimLipMm : 0);

/** Altura (desde el fondo del interior) hasta donde llega el hueco. */
export const pocketDepth = (p) => p.insertHeightMm - lipAbove(p);

/**
 * Cuánto hay que engrosar la pared en horizontal para que el grosor REAL (perpendicular a la cara) no baje de `wallMm`:
 * donde el hueco se abre en campana la pared en horizontal es más ancha que la real.
 */
function wallFactor(p, y) {
  const h = 0.25;
  const y0 = Math.max(p.insertBaseRadiusMm, y - h);
  const y1 = Math.min(p.insertHeightMm, Math.max(y0 + 1e-6, y + h));
  const slope = Math.abs(insertRadius(p, y1) - insertRadius(p, y0)) / (y1 - y0);
  return Math.sqrt(1 + Math.min(MAX_SLOPE, slope) ** 2);
}

/**
 * Alturas (y) de los anillos del hueco, de arriba hacia abajo: la campana con varios anillos (es curva),
 * el cuerpo recto con uno solo en cada punta y el canto redondeado del fondo.
 */
function pocketYs(p) {
  const top = pocketDepth(p);
  const y0 = p.insertHeightMm - p.insertFlareHeightMm;
  const f = p.insertBaseRadiusMm;
  const ys = [top];
  if (top > y0) for (let k = 1; k <= 14; k++) ys.push(top - ((top - y0) * k) / 14);
  if (f > 0.05) {
    ys.push(f);
    for (let k = ARC_STEPS - 1; k >= 0; k--) ys.push(f * (1 - Math.cos((k / ARC_STEPS) * (Math.PI / 2))));
  } else {
    ys.push(0);
  }
  // sin repetidos (el borde y el arranque de la campana pueden coincidir)
  return ys.filter((y, i) => i === 0 || Math.abs(y - ys[i - 1]) > 1e-6);
}

/**
 * @param {any} K  módulo manifold-3d
 * @param {ReturnType<import('./params.js').normalizeParams>} p
 * @param {{ segments:number, dz:number }} density
 * @returns {{ solid:any, heightMm:number, heightRaised:boolean, reshaped:boolean, supported:boolean, zFloor:number, zInsert:number, segments:number }}
 *   `heightMm`: alto real del mate (más que el pedido si el interior no entra con una base de al menos `MIN_FLOOR`).
 *   `zFloor`: piso del hueco; `zInsert`: donde queda el fondo del interior (`clearanceMm` más arriba).
 *   `supported`: hubo que rellenar por debajo (rampa) para que ninguna cara pase del ángulo de voladizo.
 *   `reshaped`: la silueta pedida quedaba demasiado cerca del hueco y se ensanchó para dejar la pared.
 */
export function buildMate(K, p, density) {
  const S = patternSegments(p, density.segments);
  const top = pocketDepth(p);
  const c = p.clearanceMm;
  // el fondo del interior queda a `c` mm del piso del hueco: así no hay que clavarlo, y si apoya por el borde cuelga bien
  const heightMm = Math.max(p.heightMm, top + c + MIN_FLOOR);
  const heightRaised = heightMm > p.heightMm + 1e-9;
  const zFloor = heightMm - top - c;
  const zInsert = zFloor + c;

  /**
   * Radio mínimo de la silueta a la altura z: el hueco más la pared. Debajo del piso y en el redondeo del fondo se usa el
   * radio del cuerpo sin redondear (el redondeo es del hueco, no de la pieza), y en las curvas se engrosa por la pendiente.
   */
  const shellR = (z) => {
    const y = Math.min(top, Math.max(p.insertBaseRadiusMm, z - zInsert));
    return insertRadius(p, y) + c + p.wallMm * wallFactor(p, y);
  };

  // ---- hueco: anillos circulares de arriba hacia abajo
  const ys = pocketYs(p);
  const inner = ys.map((y) => ({ z: zInsert + y, ring: polarRing(S, () => insertRadius(p, y) + c) }));
  // el piso del hueco, `c` mm más abajo que el fondo del interior
  if (c > 1e-6) inner.push({ z: zFloor, ring: inner[inner.length - 1].ring });

  // ---- cara de afuera: de abajo hacia arriba
  const periodic = VERTICAL_PATTERNS.includes(p.pattern);
  const step = periodic ? Math.min(density.dz, p.patternPeriodMm / (['lattice', 'diamonds'].includes(p.pattern) ? 40 : 16)) : density.dz;
  const budget = Math.max(8, Math.floor(MAX_TRIS / (2 * S)) - inner.length - 2);
  const nBody = Math.min(budget - 2, Math.max(4, Math.ceil((heightMm - EDGE) / step)));
  // chaflán de abajo (z de 0 a EDGE) y después el resto con pasos parejos
  const zs = [0, EDGE];
  for (let i = 1; i <= nBody; i++) zs.push(EDGE + ((heightMm - EDGE) * i) / nBody);

  // Silueta: la forma pedida o, donde queda a menos de la pared del hueco, la pared. Cuando la pared pide más, el ensanche
  // se reparte hacia abajo con una pendiente suave (`FAIR`): si no, queda un reborde finito justo en el borde de arriba.
  const want = zs.map((z) => (p.profile === 'follow' ? 0 : profileRadius(p, z / heightMm)));
  const need = zs.map((z, i) => Math.max(0, shellR(z) - want[i]));
  const sil = want.map((w, i) => w + need[i]);
  let reshaped = false;
  if (p.profile !== 'follow') {
    let extra = 0;
    for (let i = zs.length - 1; i >= 0; i--) {
      extra = i === zs.length - 1 ? need[i] : Math.max(need[i], extra - FAIR * (zs[i + 1] - zs[i]));
      sil[i] = want[i] + extra;
      if (extra > 0.3) reshaped = true;
    }
  }

  // radios de cada anillo (silueta + textura)
  const radii = zs.map((z, i) => {
    const R = sil[i];
    const r = new Float64Array(S);
    for (let j = 0; j < S; j++) r[j] = surfaceRadius(p, R, (2 * Math.PI * j) / S, z, z / heightMm);
    return r;
  });

  // Autoportante: en cada meridiano el radio no puede crecer hacia arriba más de `slope` mm por mm de altura. Donde lo
  // pedía la silueta o la textura (campana, panza, burbujas), se rellena DEBAJO con una rampa de ese ángulo: sin soportes
  // y con más material justo donde la pieza cuelga. El ángulo de la cara con la vertical nunca pasa de `atan(slope)`.
  const slope = p.selfSupport ? Math.tan((p.overhangDeg * Math.PI) / 180) : Infinity;
  let lifted = 0;
  if (Number.isFinite(slope)) {
    for (let i = zs.length - 2; i >= 1; i--) {
      const dz = zs[i + 1] - zs[i];
      for (let j = 0; j < S; j++) {
        const need = radii[i + 1][j] - slope * dz;
        if (need > radii[i][j]) {
          lifted = Math.max(lifted, need - radii[i][j]);
          radii[i][j] = need;
        }
      }
    }
  }
  radii[0] = Float64Array.from(radii[1]); // el chaflán arranca desde el radio de la primera capa pareja
  // el chaflán de abajo respeta el mismo ángulo (como mucho 45°): la primera capa apoya y las siguientes no vuelan
  const chamfer = EDGE * Math.min(1, slope);
  const outer = zs.map((z, i) => ({
    z,
    ring: polarRing(S, (a, j) => radii[i][j] - (z < EDGE ? chamfer * (1 - z / EDGE) : 0)),
  }));

  const chain = [...outer, ...inner];
  const solid = solidFromRings(
    K,
    chain.map((e) => e.z),
    chain.map((e) => e.ring),
  );
  return { solid, heightMm, heightRaised, reshaped, supported: lifted > 0.3, zFloor, zInsert, segments: S };
}
