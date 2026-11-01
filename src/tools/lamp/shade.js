// Pantalla de la lámpara: perfil (silueta) + textura en la superficie + cuello roscado.
//
// Pared ("wall"): una sola pieza con la rosca macho integrada. Se imprime con perímetros normales.
// Modo vaso ("vase"): también una sola pieza con la rosca integrada, pero maciza (sin cara interna) para
// imprimir en modo espiral: el slicer deja una sola línea de pared siguiendo la cara de afuera.

import { THREAD, maleRadius, threadZs } from './thread.js';
import { polarRing, insetRing, ringRadii, tubeFromRings, solidFromRings } from '../../core/kernel/rings.js';
import { profileRadius, surfaceRadius, VERTICAL_PATTERNS, patternSegments as shadeSegments, gridPhase, ringStep } from '../../core/kernel/surface.js';

export { profileRadius, surfaceRadius, VERTICAL_PATTERNS, shadeSegments };

/** Alto mínimo del cuerpo (mm) por encima del cono del cuello: con menos, la forma deja de tener sentido. */
const MIN_BODY = 20;


/**
 * Alturas de los anillos del cuerpo; `reserved` son los anillos que ya gastó el cuello y `maxTris` el tope de triángulos de
 * la pantalla (texturas finas en una pieza alta llegan a millones y cuelgan el visor y el slicer).
 * Las texturas que se repiten en vertical llevan los anillos sobre su grilla (`ringStep`); si el tope obliga a espaciarlos,
 * se espacian de a múltiplos de esa grilla. El resto va parejo.
 * @returns {{ zs:number[], capped:boolean }}  `capped`: el tope obligó a usar anillos mucho más separados que lo pedido
 */
function bodyZs(p, height, dz, S, reserved, maxTris = 1_000_000) {
  const step = ringStep(p, S, dz);
  // cada anillo cuesta ~4·S triángulos (pared de afuera y de adentro)
  const budget = Math.max(8, Math.floor(maxTris / (4 * S)) - reserved);
  const wanted = Math.max(4, Math.ceil(height / step - 1e-9));
  const n = Math.min(budget, wanted);
  // solo importa si la textura cambia con la altura: las estrías o los gajos rectos no pierden nada con anillos más separados
  if (!VERTICAL_PATTERNS.includes(p.pattern)) return { zs: Array.from({ length: n + 1 }, (_, i) => (height * i) / n), capped: false };
  const capped = n < wanted * 0.8;
  // sobre la grilla: un anillo cada `step · k`, con k lo bastante grande para entrar en el tope
  const k = Math.max(1, Math.ceil(wanted / n - 1e-9));
  const h = step * k;
  const zs = [];
  for (let i = 0; i * h < height - 0.25 * h; i++) zs.push(i * h);
  zs.push(height);
  return { zs, capped };
}

const circleRing = (S, r) => polarRing(S, () => r);
const minOf = (a) => a.reduce((m, v) => Math.min(m, v), Infinity);
const maxOf = (a) => a.reduce((m, v) => Math.max(m, v), -Infinity);

/**
 * @param {any} K
 * @param {ReturnType<import('./params.js').normalizeParams>} p
 * @param {{ segments:number, dz:number, maxTris:number }} density
 * @returns {{ shade:any, bodyZ0:number, heightMm:number, heightRaised:boolean, bodyInnerRadii:{z:number,r:number}[], segments:number, capped:boolean }}
 *   `bodyZ0`: altura donde arranca el cuerpo (encima del cuello).
 *   `heightMm`: alto real de la pantalla armada; es mayor que el pedido si este no deja ni `MIN_BODY` mm de cuerpo
 *   (con una base ancha el cuello gasta bastante alto abriéndose a 45°).
 */
export function buildShade(K, p, density) {
  const T = THREAD;
  const S = shadeSegments(p, density.segments);
  const vase = p.shadeMode === 'vase';
  // la grilla de vértices acompaña el giro de la textura (en t = 0 no gira, así que el cuello y el cono la comparten)
  const ringAt = (zp, t) => {
    const R = profileRadius(p, t);
    return polarRing(S, (a) => surfaceRadius(p, R, a, zp, t), gridPhase(p, t));
  };

  // ---- anillo de abajo del cuerpo: define cuánto sube el cuello a 45°
  const ring0 = ringAt(0, 0);
  const r0 = ringRadii(ring0);
  // en modo vaso la pantalla es maciza: no hay cara interna que calcular
  const in0 = vase ? null : insetRing(K, ring0, p.wallMm, gridPhase(p, 0));
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
    const { zs: bz, capped } = bodyZs(p, bodyH, density.dz, S, zs.length, density.maxTris);
    for (let i = 1; i < bz.length; i++) {
      const t = bz[i] / bodyH;
      const o = ringAt(bz[i], t);
      const inn = insetRing(K, o, p.wallMm, gridPhase(p, t));
      if (!inn) throw new Error('lamp.inset');
      zs.push(bodyZ0 + bz[i]);
      outer.push(o);
      inner.push(inn);
      bodyInnerRadii.push({ z: bodyZ0 + bz[i], r: minOf(ringRadii(inn)) });
    }
    return { shade: tubeFromRings(K, zs, outer, inner), bodyZ0, heightMm, heightRaised, bodyInnerRadii, segments: S, capped };
  }

  // ---- modo vaso: cuello roscado + cono + cuerpo, todo en un sólido (la rosca sigue pegada a la pantalla)
  const { zs: bz, capped } = bodyZs(p, bodyH, density.dz, S, zs.length, density.maxTris);
  for (let i = 1; i < bz.length; i++) {
    const o = ringAt(bz[i], bz[i] / bodyH);
    zs.push(bodyZ0 + bz[i]);
    outer.push(o);
    // la pared en espiral queda pegada a la cara de afuera (~0,8 mm)
    bodyInnerRadii.push({ z: bodyZ0 + bz[i], r: minOf(ringRadii(o)) - 0.8 });
  }
  return { shade: solidFromRings(K, zs, outer), bodyZ0, heightMm, heightRaised, bodyInnerRadii, segments: S, capped };
}
