// Parámetros del sello: valores por defecto y normalización.
// `normalizeParams` NUNCA tira excepción: clampea y completa lo que falte.

import { toNumber } from '../../core/util/number.js';

export const PARAMS_VERSION = 1;

export const defaults = {
  // Diseño
  text: 'Hecho a mano',
  fontId: 'lobster',
  align: 'center',
  lineSpacing: 1,
  sizeMm: 50,
  letterSpacingMm: 0,
  boldOffsetMm: 0.15,
  uppercase: false,
  icon: null,
  iconPosition: 'before',
  iconScale: 1.2,
  // Placa
  shape: 'rounded',
  marginMm: 4,
  cornerRadiusMm: 4,
  plateThicknessMm: 3,
  reliefMm: 1.6,
  // Mango
  handle: 'bar',
  handleWidthMm: 22,
  handleLengthMm: 50,
  handleHeightMm: 18,
  // Color
  colors: { base: '#3b82f6' },
  // Calidad
  curveQuality: 'high',
  snapToLayers: true,
};

const ENUMS = {
  align: ['left', 'center', 'right'],
  iconPosition: ['before', 'after', 'both'],
  shape: ['rounded', 'circle', 'ellipse'],
  handle: ['knob', 'bar', 'none'],
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
    sizeMm: clamp(r.sizeMm, 10, 200, d.sizeMm),
    letterSpacingMm: clamp(r.letterSpacingMm, -3, 5, d.letterSpacingMm),
    boldOffsetMm: clamp(r.boldOffsetMm, 0, 1, d.boldOffsetMm),
    uppercase: bool(r.uppercase, d.uppercase),
    icon: typeof r.icon === 'string' && r.icon ? r.icon : null,
    iconPosition: pick(r.iconPosition, ENUMS.iconPosition, d.iconPosition),
    iconScale: clamp(r.iconScale, 0.3, 3, d.iconScale),

    shape: pick(r.shape, ENUMS.shape, d.shape),
    marginMm: clamp(r.marginMm, 1, 20, d.marginMm),
    cornerRadiusMm: clamp(r.cornerRadiusMm, 0, 30, d.cornerRadiusMm),
    plateThicknessMm: clamp(r.plateThicknessMm, 1.2, 10, d.plateThicknessMm),
    reliefMm: clamp(r.reliefMm, 0.4, 4, d.reliefMm),

    handle: pick(r.handle, ENUMS.handle, d.handle),
    handleWidthMm: clamp(r.handleWidthMm, 8, 80, d.handleWidthMm),
    handleLengthMm: clamp(r.handleLengthMm, 15, 150, d.handleLengthMm),
    handleHeightMm: clamp(r.handleHeightMm, 5, 80, d.handleHeightMm),

    colors: { base: hex(c.base, d.colors.base) },

    curveQuality: pick(r.curveQuality, ENUMS.curveQuality, d.curveQuality),
    snapToLayers: bool(r.snapToLayers, d.snapToLayers),
  };
}

/** Tolerancia de aplanado de curvas (mm) por calidad. */
export function qualityTol(q) {
  return q === 'draft' ? 0.1 : q === 'high' ? 0.015 : 0.04;
}
