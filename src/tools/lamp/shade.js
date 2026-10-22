// Pantalla de la lámpara: perfil (silueta) + textura en la superficie + cuello roscado.
//
// Pared ("wall"): una sola pieza con la rosca macho integrada. Se imprime con perímetros normales.
// Modo vaso ("vase"): también una sola pieza con la rosca integrada, pero maciza (sin cara interna) para
// imprimir en modo espiral: el slicer deja una sola línea de pared siguiendo la cara de afuera.

import { THREAD, maleRadius, threadZs } from './thread.js';
import { polarRing, insetRing, ringRadii, tubeFromRings, solidFromRings } from '../../core/kernel/rings.js';
import { profileRadius, surfaceRadius, VERTICAL_PATTERNS, patternSegments as shadeSegments } from '../../core/kernel/surface.js';

export { profileRadius, surfaceRadius, VERTICAL_PATTERNS, shadeSegments };

/** Alto mínimo del cuerpo (mm) por encima del cono del cuello: con menos, la forma deja de tener sentido. */
const MIN_BODY = 20;
/** Tope de triángulos de la pantalla: texturas finas en una pieza alta llegan a millones y cuelgan el visor y el slicer. */
const MAX_TRIS = 1_000_000;


/** Alturas de los anillos del cuerpo; `reserved` son los anillos que ya gastó el cuello. */
function bodyZs(p, height, dz, S, reserved) {
  const periodic = VERTICAL_PATTERNS.includes(p.pattern);
  // el enrejado tiene costillas finas en diagonal: pide anillos más juntos para no verse escalonado
  const step = periodic ? Math.min(dz, p.patternPeriodMm / (['lattice', 'diamonds'].includes(p.pattern) ? 40 : 16)) : dz;
  // cada anillo cuesta ~4·S triángulos (pared de afuera y de adentro)
  const budget = Math.max(8, Math.floor(MAX_TRIS / (4 * S)) - reserved);
  const n = Math.min(budget, Math.max(4, Math.ceil(height / step)));
  return Array.from({ length: n + 1 }, (_, i) => (height * i) / n);
}

const circleRing = (S, r) => polarRing(S, () => r);
const minOf = (a) => a.reduce((m, v) => Math.min(m, v), Infinity);
const maxOf = (a) => a.reduce((m, v) => Math.max(m, v), -Infinity);

/**
 * @param {any} K
 * @param {ReturnType<import('./params.js').normalizeParams>} p
 * @param {{ segments:number, dz:number }} density
 * @returns {{ shade:any, bodyZ0:number, heightMm:number, heightRaised:boolean, bodyInnerRadii:{z:number,r:number}[], segments:number }}
 *   `bodyZ0`: altura donde arranca el cuerpo (encima del cuello).
 *   `heightMm`: alto real de la pantalla armada; es mayor que el pedido si este no deja ni `MIN_BODY` mm de cuerpo
 *   (con una base ancha el cuello gasta bastante alto abriéndose a 45°).
 */
export function buildShade(K, p, density) {
  const T = THREAD;
  const S = shadeSegments(p, density.segments);
  const vase = p.shadeMode === 'vase';
  const ringAt = (zp, t) => {
    const R = profileRadius(p, t);
    return polarRing(S, (a) => surfaceRadius(p, R, a, zp, t));
  };

  // ---- anillo de abajo del cuerpo: define cuánto sube el cuello a 45°
  const ring0 = ringAt(0, 0);
  const r0 = ringRadii(ring0);
  // en modo vaso la pantalla es maciza: no hay cara interna que calcular
  const in0 = vase ? null : insetRing(K, ring0, p.wallMm);
  if (!vase && !in0) throw new Error('lamp.inset');
  const ri0 = in0 ? ringRadii(in0) : null;
  // (la silueta mínima es Ø112, así que el cuerpo siempre queda por fuera del cuello)
  const hT = Math.max(1.2, maxOf(r0) - T.coreR, ri0 ? maxOf(ri0) - T.neckInnerR : 0) + 0.4;
  const bodyZ0 = T.neckTopZ + hT;
  const heightMm = Math.max(p.heightMm, bodyZ0 + MIN_BODY);
  const heightRaised = heightMm > p.heightMm + 1e-9;
  const bodyH = heightMm - bodyZ0;

  // ---- cuello roscado + cono de transición (común a los dos modos)
  const zs = [];
  const outer = [];
  const inner = [];
  const neckIn = circleRing(S, T.neckInnerR);
  for (const z of threadZs(0, T.neckTopZ)) {
    zs.push(z);
    outer.push(polarRing(S, (a) => maleRadius(a, z, p.threadFitMm)));
    inner.push(neckIn);
  }
  // cono a 45° exactos (crece 1 mm por mm de altura hasta llegar al cuerpo): es lo que apoya en el
  // canto del aro de la base, así que la altura de asiento (SEAT_Z) no depende de la forma
  const nT = Math.max(3, Math.ceil(hT / 0.4));
  for (let k = 1; k <= nT; k++) {
    const dz = (hT * k) / nT;
    zs.push(T.neckTopZ + dz);
    outer.push(polarRing(S, (a, j) => Math.min(r0[j], T.coreR + dz)));
    if (ri0) inner.push(polarRing(S, (a, j) => Math.min(ri0[j], T.neckInnerR + dz)));
  }

  /** Radios internos del cuerpo por altura (para chequear que entre la lamparita). */
  const bodyInnerRadii = [];

  if (!vase) {
    const bz = bodyZs(p, bodyH, density.dz, S, zs.length);
    for (let i = 1; i < bz.length; i++) {
      const t = bz[i] / bodyH;
      const o = ringAt(bz[i], t);
      const inn = insetRing(K, o, p.wallMm);
      if (!inn) throw new Error('lamp.inset');
      zs.push(bodyZ0 + bz[i]);
      outer.push(o);
      inner.push(inn);
      bodyInnerRadii.push({ z: bodyZ0 + bz[i], r: minOf(ringRadii(inn)) });
    }
    return { shade: tubeFromRings(K, zs, outer, inner), bodyZ0, heightMm, heightRaised, bodyInnerRadii, segments: S };
  }

  // ---- modo vaso: cuello roscado + cono + cuerpo, todo en un sólido (la rosca sigue pegada a la pantalla)
  const bz = bodyZs(p, bodyH, density.dz, S, zs.length);
  for (let i = 1; i < bz.length; i++) {
    const o = ringAt(bz[i], bz[i] / bodyH);
    zs.push(bodyZ0 + bz[i]);
    outer.push(o);
    // la pared en espiral queda pegada a la cara de afuera (~0,8 mm)
    bodyInnerRadii.push({ z: bodyZ0 + bz[i], r: minOf(ringRadii(o)) - 0.8 });
  }
  return { shade: solidFromRings(K, zs, outer), bodyZ0, heightMm, heightRaised, bodyInnerRadii, segments: S };
}
