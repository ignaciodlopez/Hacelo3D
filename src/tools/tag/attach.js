// Sujeción de la chapita: orejita con agujero para la argolla, agujero dentro de la chapita,
// o dos ranuras para pasar el collar (chapita "pasante").
//
// Devuelve la silueta completa (`full`, con los agujeros ya restados) y los avisos que
// corresponden. El texto y el borde se calculan después sobre `full`, así que se alejan solos
// de los agujeros.

import { circle, roundedRect, rectFromBounds } from '../../core/kernel/shapes2d.js';

const DIR = { top: [0, 1], bottom: [0, -1], left: [-1, 0], right: [1, 0] };
/** Cuánto sobresale del borde el agujero de la orejita (mm). */
const EAR_GAP = 0.4;
/** Aire entre el collar y la ranura (mm). */
const COLLAR_AIR = 0.8;

/** Distancia desde el centro hasta el borde de `body` siguiendo la dirección `side`, a `off` mm del eje. */
function edgeAt(K, t, body, side, off) {
  const b = body.bounds();
  const L = 2 * Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]) + 10;
  const w = 0.2;
  const strip =
    side === 'top'
      ? rectFromBounds(K, t, off - w, 0, off + w, L)
      : side === 'bottom'
        ? rectFromBounds(K, t, off - w, -L, off + w, 0)
        : side === 'right'
          ? rectFromBounds(K, t, 0, off - w, L, off + w)
          : rectFromBounds(K, t, -L, off - w, 0, off + w);
  const hit = t(body.intersect(strip));
  if (hit.isEmpty()) return null;
  const hb = hit.bounds();
  return side === 'top' ? hb.max[1] : side === 'bottom' ? hb.min[1] : side === 'right' ? hb.max[0] : hb.min[0];
}

/**
 * @param {any} K
 * @param {(o:any)=>any} t
 * @param {ReturnType<import('./params.js').normalizeParams>} p
 * @param {any} body  silueta de la forma, centrada en el origen
 * @param {{ rimMm:number, quality:number }} o
 * @returns {{ full:any, warns:{level:string, code:string, params?:any}[] }}
 */
export function buildAttach(K, t, p, body, o) {
  const warns = [];
  if (p.attach === 'none') return { full: body, warns };
  const hr = p.ringHoleMm / 2;

  if (p.attach === 'ring' || p.attach === 'inside') {
    if ((p.attach === 'ring' && p.ringWallMm < 1.6) || (p.attach === 'inside' && o.rimMm < 0.8)) warns.push({ level: 'warn', code: 'ring.thinWall' });
    if (p.ringHoleMm < 3.5) warns.push({ level: 'warn', code: 'ring.smallHole' });
    const side = p.ringSide;
    const [dx, dy] = DIR[side];
    // la recta del agujero se corre a lo largo del borde; si cae fuera de la silueta, vuelve al centro
    const across = side === 'top' || side === 'bottom';
    let off = p.ringOffsetMm;
    let edge = edgeAt(K, t, body, side, off);
    if (edge == null) {
      off = 0;
      edge = edgeAt(K, t, body, side, 0);
    }
    if (edge == null) return { full: body, warns };
    const sign = dx + dy;
    const edgePos = edge; // coordenada del borde sobre el eje de la dirección
    if (p.attach === 'ring') {
      const dist = hr + EAR_GAP;
      const c = edgePos + sign * dist;
      const cx = across ? off : c;
      const cy = across ? c : off;
      const ear = circle(K, t, hr + p.ringWallMm, cx, cy, o.quality);
      const blended = t(K.CrossSection.union([body, ear]));
      // el cierre redondea el encuentro de la orejita con el cuerpo
      const joined = t(t(blended.offset(1, 'Round', 2, 32)).offset(-1, 'Round', 2, 32));
      return { full: t(joined.subtract(circle(K, t, hr, cx, cy, o.quality))), warns };
    }
    const c = edgePos - sign * (hr + o.rimMm + 1.6);
    const cx = across ? off : c;
    const cy = across ? c : off;
    return { full: t(body.subtract(circle(K, t, hr, cx, cy, o.quality))), warns };
  }

  // ranuras para el collar: en los dos extremos del lado más largo
  const b = body.bounds();
  const w = b.max[0] - b.min[0];
  const h = b.max[1] - b.min[1];
  const landscape = w >= h;
  const L = p.collarWidthMm + COLLAR_AIR;
  const S = p.slotThicknessMm;
  const span = landscape ? w : h;
  const inset = o.rimMm + 1.6 + S / 2; // del borde al centro de la ranura
  const room = t(body.offset(-(o.rimMm + 1.2), 'Round', 2, 32));
  const slots = [-1, 1].map((sgn) => {
    const c = sgn * (span / 2 - inset);
    return landscape ? roundedRect(K, t, S, L, S / 2, c, 0, o.quality) : roundedRect(K, t, L, S, S / 2, 0, c, o.quality);
  });
  const outside = slots.some((s) => t(s.subtract(room)).area() > 0.05);
  if (outside) {
    // cuánto collar entra como mucho: el largo útil del lugar donde van las ranuras
    const maxLen = Math.max(0, Math.floor(slotRoomLength(K, t, room, landscape, span / 2 - inset) - COLLAR_AIR));
    warns.push({ level: 'warn', code: 'tag.slotNoRoom', params: { mm: maxLen } });
    return { full: body, warns };
  }
  const cut = t(K.CrossSection.union(slots));
  return { full: t(body.subtract(cut)), warns };
}

/** Largo disponible (mm) para una ranura centrada en `c` sobre el eje corto: el mínimo de los dos extremos. */
function slotRoomLength(K, t, room, landscape, c) {
  const len = (pos) => {
    const strip = landscape ? rectFromBounds(K, t, pos - 0.1, -1e3, pos + 0.1, 1e3) : rectFromBounds(K, t, -1e3, pos - 0.1, 1e3, pos + 0.1);
    const hit = t(room.intersect(strip));
    if (hit.isEmpty()) return 0;
    const hb = hit.bounds();
    return landscape ? hb.max[1] - hb.min[1] : hb.max[0] - hb.min[0];
  };
  return Math.min(len(-c), len(c));
}
