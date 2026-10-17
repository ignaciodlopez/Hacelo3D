// Parámetros de la lámpara: valores por defecto y normalización.
// `normalizeParams` NUNCA tira excepción: clampea y completa lo que falte.

import { toNumber } from '../../core/util/number.js';

export const PARAMS_VERSION = 1;

export const defaults = {
  // Piezas
  parts: 'both',
  view: 'assembled',
  // Pantalla: forma
  heightMm: 180,
  profile: 'curve',
  bottomDiameterMm: 116,
  midDiameterMm: 150,
  midPosition: 0.45,
  topDiameterMm: 96,
  // Pantalla: textura
  pattern: 'waves',
  patternCount: 18,
  patternDepthMm: 4,
  patternPeriodMm: 20,
  twistDeg: 120,
  // Pantalla: impresión
  shadeMode: 'wall',
  wallMm: 1.2,
  threadFitMm: 0,
  // Base
  socketDiameterMm: 37,
  socketHeightMm: 40,
  clampScrew: true,
  // Colores
  colors: { shade: '#f4ede1', base: '#ffbd59' },
  // Calidad
  curveQuality: 'high',
};

const ENUMS = {
  parts: ['both', 'shade', 'base'],
  view: ['assembled', 'parts'],
  profile: ['straight', 'curve'],
  pattern: ['smooth', 'waves', 'ribs', 'facets', 'rings', 'bubbles', 'zigzag'],
  shadeMode: ['wall', 'vase'],
  curveQuality: ['draft', 'normal', 'high'],
};

const clamp = (v, min, max, def) => Math.min(max, Math.max(min, toNumber(v, def)));
const pick = (v, list, def) => (list.includes(v) ? v : def);
const bool = (v, def) => (typeof v === 'boolean' ? v : def);
const hex = (v, def) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : def);

/**
 * @param {any} raw
 * @returns {typeof defaults} parámetros válidos
 */
export function normalizeParams(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = defaults;
  const c = r.colors && typeof r.colors === 'object' ? r.colors : {};
  return {
    parts: pick(r.parts, ENUMS.parts, d.parts),
    view: pick(r.view, ENUMS.view, d.view),

    heightMm: clamp(r.heightMm, 60, 320, d.heightMm),
    profile: pick(r.profile, ENUMS.profile, d.profile),
    bottomDiameterMm: clamp(r.bottomDiameterMm, 112, 240, d.bottomDiameterMm),
    midDiameterMm: clamp(r.midDiameterMm, 50, 260, d.midDiameterMm),
    midPosition: clamp(r.midPosition, 0.15, 0.85, d.midPosition),
    topDiameterMm: clamp(r.topDiameterMm, 30, 260, d.topDiameterMm),

    pattern: pick(r.pattern, ENUMS.pattern, d.pattern),
    patternCount: Math.round(clamp(r.patternCount, 3, 64, d.patternCount)),
    patternDepthMm: clamp(r.patternDepthMm, 0.5, 15, d.patternDepthMm),
    patternPeriodMm: clamp(r.patternPeriodMm, 6, 80, d.patternPeriodMm),
    twistDeg: clamp(r.twistDeg, -720, 720, d.twistDeg),

    shadeMode: pick(r.shadeMode, ENUMS.shadeMode, d.shadeMode),
    wallMm: clamp(r.wallMm, 0.6, 3, d.wallMm),
    threadFitMm: clamp(r.threadFitMm, -0.2, 0.6, d.threadFitMm),

    socketDiameterMm: clamp(r.socketDiameterMm, 25, 45, d.socketDiameterMm),
    socketHeightMm: clamp(r.socketHeightMm, 30, 70, d.socketHeightMm),
    clampScrew: bool(r.clampScrew, d.clampScrew),

    colors: { shade: hex(c.shade, d.colors.shade), base: hex(c.base, d.colors.base) },

    curveQuality: pick(r.curveQuality, ENUMS.curveQuality, d.curveQuality),
  };
}

/** Resolución de la malla por calidad: vértices por vuelta y paso vertical máximo (mm). */
export function meshDensity(q) {
  return q === 'draft' ? { segments: 144, dz: 2 } : q === 'high' ? { segments: 320, dz: 1 } : { segments: 256, dz: 1.2 };
}
