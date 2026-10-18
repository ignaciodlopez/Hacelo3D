// Pantalla de la lámpara: perfil (silueta) + textura en la superficie + cuello roscado.
//
// Pared ("wall"): una sola pieza con la rosca macho integrada. Se imprime con perímetros normales.
// Modo vaso ("vase"): también una sola pieza con la rosca integrada, pero maciza (sin cara interna) para
// imprimir en modo espiral: el slicer deja una sola línea de pared siguiendo la cara de afuera.

import { THREAD, maleRadius, threadZs } from './thread.js';
import { polarRing, insetRing, ringRadii, tubeFromRings, solidFromRings } from '../../core/kernel/rings.js';

/** Alto mínimo del cuerpo (mm) por encima del cono del cuello: con menos, la forma deja de tener sentido. */
const MIN_BODY = 20;
/** Tope de triángulos de la pantalla: texturas finas en una pieza alta llegan a millones y cuelgan el visor y el slicer. */
const MAX_TRIS = 1_000_000;

/** Radio de la silueta (sin textura) a la altura relativa t ∈ [0, 1] del cuerpo. */
export function profileRadius(p, t) {
  const Rb = p.bottomDiameterMm / 2;
  const Rt = p.topDiameterMm / 2;
  if (p.profile === 'straight') return Rb + (Rt - Rb) * t;
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
    default:
      return R;
  }
}

/** Vértices por vuelta: los de la calidad elegida, con al menos 10 por período de la textura. */
export function shadeSegments(p, base) {
  const usesCount = ['waves', 'ribs', 'facets', 'bubbles', 'zigzag'].includes(p.pattern);
  const need = usesCount ? p.patternCount * (p.pattern === 'facets' ? 8 : 12) : 0;
  return Math.min(768, Math.max(base, Math.ceil(need / 8) * 8));
}

/** Alturas de los anillos del cuerpo; `reserved` son los anillos que ya gastó el cuello. */
function bodyZs(p, height, dz, S, reserved) {
  const periodic = ['rings', 'bubbles', 'zigzag'].includes(p.pattern);
  const step = periodic ? Math.min(dz, p.patternPeriodMm / 16) : dz;
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
