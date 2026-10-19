// Parámetros del adorno navideño (esfera): valores por defecto y normalización.
// `normalizeParams` NUNCA tira excepción: clampea y completa lo que falte.

import { toNumber } from '../../core/util/number.js';

export const PARAMS_VERSION = 1;

export const defaults = {
  // Nombre
  name: 'Benja',
  fontId: 'kaushan-script',
  nameWidthMm: 92,
  nameOffsetYMm: 0,
  letterSpacingMm: 0,
  boldOffsetMm: 0,
  uppercase: false,
  bridgeLoose: true,
  nameHeightMm: 4.3,
  // Barras
  bars: true,
  barWidthMm: 3,
  barGapMm: -0.5,
  barHeightMm: 2,
  // Esfera
  diameterMm: 100,
  ringWidthMm: 5.3,
  thicknessMm: 3,
  // Argolla
  loop: true,
  loopHoleMm: 5,
  loopWallMm: 2.6,
  // Decoración
  decoration: 'snow',
  decoCount: 3,
  decoSizeMm: 18,
  decoStyle: 'mix',
  decoSeed: 0,
  // Colores
  colors: { frame: '#f4f4f4', name: '#c62828' },
  // Calidad
  curveQuality: 'high',
  snapToLayers: true,
};

const ENUMS = {
  decoration: ['snow', 'stars', 'none'],
  decoStyle: ['mix', 'classic', 'fat', 'fine'],
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
    name: typeof r.name === 'string' ? r.name : d.name,
    fontId: typeof r.fontId === 'string' && r.fontId ? r.fontId : d.fontId,
    nameWidthMm: clamp(r.nameWidthMm, 20, 140, d.nameWidthMm),
    nameOffsetYMm: clamp(r.nameOffsetYMm, -30, 30, d.nameOffsetYMm),
    letterSpacingMm: clamp(r.letterSpacingMm, -3, 5, d.letterSpacingMm),
    boldOffsetMm: clamp(r.boldOffsetMm, 0, 1, d.boldOffsetMm),
    uppercase: bool(r.uppercase, d.uppercase),
    bridgeLoose: bool(r.bridgeLoose, d.bridgeLoose),
    nameHeightMm: clamp(r.nameHeightMm, 1, 10, d.nameHeightMm),

    bars: bool(r.bars, d.bars),
    barWidthMm: clamp(r.barWidthMm, 1.2, 10, d.barWidthMm),
    barGapMm: clamp(r.barGapMm, -4, 10, d.barGapMm),
    barHeightMm: clamp(r.barHeightMm, 0.4, 10, d.barHeightMm),

    diameterMm: clamp(r.diameterMm, 50, 160, d.diameterMm),
    ringWidthMm: clamp(r.ringWidthMm, 2, 15, d.ringWidthMm),
    thicknessMm: clamp(r.thicknessMm, 1, 8, d.thicknessMm),

    loop: bool(r.loop, d.loop),
    loopHoleMm: clamp(r.loopHoleMm, 2, 12, d.loopHoleMm),
    loopWallMm: clamp(r.loopWallMm, 1, 6, d.loopWallMm),

    decoration: pick(r.decoration, ENUMS.decoration, d.decoration),
    decoCount: Math.round(clamp(r.decoCount, 0, 4, d.decoCount)),
    decoSizeMm: clamp(r.decoSizeMm, 8, 45, d.decoSizeMm),
    decoStyle: pick(r.decoStyle, ENUMS.decoStyle, d.decoStyle),
    decoSeed: Math.round(clamp(r.decoSeed, 0, 99, d.decoSeed)),

    colors: {
      frame: hex(c.frame, d.colors.frame),
      name: hex(c.name, d.colors.name),
    },

    curveQuality: pick(r.curveQuality, ENUMS.curveQuality, d.curveQuality),
    snapToLayers: bool(r.snapToLayers, d.snapToLayers),
  };
}

/** Tolerancia de aplanado de curvas (mm) por calidad. */
export function qualityTol(q) {
  return q === 'draft' ? 0.1 : q === 'high' ? 0.015 : 0.04;
}
