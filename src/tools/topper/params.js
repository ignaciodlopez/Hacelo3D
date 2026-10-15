// Parámetros del topper de torta: valores por defecto y normalización.
// `normalizeParams` NUNCA tira excepción: clampea y completa lo que falte.

import { toNumber } from '../../core/util/number.js';

export const PARAMS_VERSION = 1;

export const defaults = {
  // Texto
  text: 'Feliz\nCumple',
  fontId: 'pacifico',
  align: 'center',
  lineSpacing: 0.95,
  sizeMm: 150,
  letterSpacingMm: 0,
  boldOffsetMm: 0,
  uppercase: false,
  // Forma
  shape: 'silhouette',
  fill: 'filled',
  marginMm: 3,
  baseThicknessMm: 3,
  relief: true,
  reliefMm: 1.5,
  // Palitos
  sticks: 2,
  stickLengthMm: 60,
  stickWidthMm: 5,
  // Colores
  colors: { base: '#f2f2f2', text: '#e8c547' },
  // Calidad
  curveQuality: 'normal',
  snapToLayers: true,
};

const ENUMS = {
  align: ['left', 'center', 'right'],
  shape: ['silhouette', 'circle', 'ellipse'],
  fill: ['filled', 'tight'],
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
    text: typeof r.text === 'string' ? r.text : d.text,
    fontId: typeof r.fontId === 'string' && r.fontId ? r.fontId : d.fontId,
    align: pick(r.align, ENUMS.align, d.align),
    lineSpacing: clamp(r.lineSpacing, 0.6, 2, d.lineSpacing),
    sizeMm: clamp(r.sizeMm, 20, 250, d.sizeMm),
    letterSpacingMm: clamp(r.letterSpacingMm, -3, 5, d.letterSpacingMm),
    boldOffsetMm: clamp(r.boldOffsetMm, 0, 1, d.boldOffsetMm),
    uppercase: bool(r.uppercase, d.uppercase),

    shape: pick(r.shape, ENUMS.shape, d.shape),
    fill: pick(r.fill, ENUMS.fill, d.fill),
    marginMm: clamp(r.marginMm, 1, 15, d.marginMm),
    baseThicknessMm: clamp(r.baseThicknessMm, 1.2, 10, d.baseThicknessMm),
    relief: bool(r.relief, d.relief),
    reliefMm: clamp(r.reliefMm, 0.4, 5, d.reliefMm),

    sticks: Math.round(clamp(r.sticks, 0, 3, d.sticks)),
    stickLengthMm: clamp(r.stickLengthMm, 20, 200, d.stickLengthMm),
    stickWidthMm: clamp(r.stickWidthMm, 2, 12, d.stickWidthMm),

    colors: {
      base: hex(c.base, d.colors.base),
      text: hex(c.text, d.colors.text),
    },

    curveQuality: pick(r.curveQuality, ENUMS.curveQuality, d.curveQuality),
    snapToLayers: bool(r.snapToLayers, d.snapToLayers),
  };
}

/** Tolerancia de aplanado de curvas (mm) por calidad. */
export function qualityTol(q) {
  return q === 'draft' ? 0.1 : q === 'high' ? 0.015 : 0.04;
}
