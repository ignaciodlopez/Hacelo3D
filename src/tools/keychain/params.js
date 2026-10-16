// Parámetros del llavero: valores por defecto y normalización.
// `normalizeParams` NUNCA tira excepción: clampea y completa lo que falte.

import { toNumber } from '../../core/util/number.js';

export const PARAMS_VERSION = 1;

export const defaults = {
  // Texto
  mode: 'single',
  text: 'Valentina',
  batchText: 'Sofía\nMateo\nValentina',
  batchSeparator: 'line',
  fontId: 'pacifico',
  align: 'center',
  letterSpacingMm: 0,
  lineSpacing: 1,
  boldOffsetMm: 0,
  uppercase: false,
  icon: null,
  iconPosition: 'before',
  iconScale: 1,
  // Tamaño
  sizeMode: 'textWidth',
  sizeMm: 50,
  batchUniform: 'sameWidth',
  // Forma
  shape: 'follow',
  marginMm: 3,
  smoothMm: 1.5,
  fillCounters: true,
  cornerRadiusMm: 999,
  baseThicknessMm: 3,
  // Letras
  letterStyle: 'relief',
  reliefMm: 1.4,
  engraveDepthMm: 0.6,
  textEffect: 'none',
  textOutlineMm: 1.2,
  textOutlineHeightMm: 0.6,
  shadowDxMm: 1,
  shadowDyMm: -1,
  faceDown: false,
  // Borde
  border: false,
  borderWidthMm: 1.2,
  borderHeightMm: null,
  borderAroundHole: true,
  // Argolla
  ringType: 'tab',
  ringPosition: 'left',
  ringOuterMm: 9,
  ringHoleMm: 4.5,
  slotWidthMm: 12,
  slotHeightMm: 3.5,
  ringOffsetXMm: 0,
  ringOffsetYMm: 0,
  // Colores
  colors: { base: '#3a3a3a', text: '#f2e08a', accent: '#ffffff', border: null },
  // Calidad
  curveQuality: 'high',
  snapToLayers: true,
};

const ENUMS = {
  mode: ['single', 'batch'],
  batchSeparator: ['line', 'comma', 'semicolon'],
  align: ['left', 'center', 'right'],
  iconPosition: ['before', 'after', 'both'],
  sizeMode: ['textWidth', 'overallWidth', 'textHeight', 'capHeight'],
  batchUniform: ['sameWidth', 'sameScale'],
  shape: ['follow', 'rounded', 'ellipse', 'circle', 'heart', 'tag', 'hexagon', 'cloud', 'badge'],
  letterStyle: ['relief', 'engraved', 'flush'],
  textEffect: ['none', 'outline', 'shadow'],
  ringType: ['tab', 'internal', 'slot', 'none'],
  ringPosition: ['left', 'right', 'top', 'topLeft', 'topRight'],
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
  const p = {
    mode: pick(r.mode, ENUMS.mode, d.mode),
    text: typeof r.text === 'string' ? r.text : d.text,
    batchText: typeof r.batchText === 'string' ? r.batchText : d.batchText,
    batchSeparator: pick(r.batchSeparator, ENUMS.batchSeparator, d.batchSeparator),
    fontId: typeof r.fontId === 'string' && r.fontId ? r.fontId : d.fontId,
    align: pick(r.align, ENUMS.align, d.align),
    letterSpacingMm: clamp(r.letterSpacingMm, -3, 5, d.letterSpacingMm),
    lineSpacing: clamp(r.lineSpacing, 0.6, 2, d.lineSpacing),
    boldOffsetMm: clamp(r.boldOffsetMm, 0, 1, d.boldOffsetMm),
    uppercase: bool(r.uppercase, d.uppercase),
    icon: typeof r.icon === 'string' && r.icon ? r.icon : null,
    iconPosition: pick(r.iconPosition, ENUMS.iconPosition, d.iconPosition),
    iconScale: clamp(r.iconScale, 0.3, 3, d.iconScale),

    sizeMode: pick(r.sizeMode, ENUMS.sizeMode, d.sizeMode),
    sizeMm: clamp(r.sizeMm, 5, 250, d.sizeMm),
    batchUniform: pick(r.batchUniform, ENUMS.batchUniform, d.batchUniform),

    shape: pick(r.shape, ENUMS.shape, d.shape),
    marginMm: clamp(r.marginMm, 0.5, 15, d.marginMm),
    smoothMm: clamp(r.smoothMm, 0, 6, d.smoothMm),
    fillCounters: bool(r.fillCounters, d.fillCounters),
    cornerRadiusMm: clamp(r.cornerRadiusMm, 0, 999, d.cornerRadiusMm),
    baseThicknessMm: clamp(r.baseThicknessMm, 1.2, 10, d.baseThicknessMm),

    letterStyle: pick(r.letterStyle, ENUMS.letterStyle, d.letterStyle),
    reliefMm: clamp(r.reliefMm, 0.4, 5, d.reliefMm),
    engraveDepthMm: clamp(r.engraveDepthMm, 0.2, 5, d.engraveDepthMm),
    textEffect: pick(r.textEffect, ENUMS.textEffect, d.textEffect),
    textOutlineMm: clamp(r.textOutlineMm, 0.4, 4, d.textOutlineMm),
    textOutlineHeightMm: clamp(r.textOutlineHeightMm, 0.2, 3, d.textOutlineHeightMm),
    shadowDxMm: clamp(r.shadowDxMm, -5, 5, d.shadowDxMm),
    shadowDyMm: clamp(r.shadowDyMm, -5, 5, d.shadowDyMm),
    faceDown: bool(r.faceDown, d.faceDown),

    border: bool(r.border, d.border),
    borderWidthMm: clamp(r.borderWidthMm, 0.4, 5, d.borderWidthMm),
    borderHeightMm: r.borderHeightMm == null || r.borderHeightMm === '' ? null : clamp(r.borderHeightMm, 0.2, 5, 1.5),
    borderAroundHole: bool(r.borderAroundHole, d.borderAroundHole),

    ringType: pick(r.ringType, ENUMS.ringType, d.ringType),
    ringPosition: pick(r.ringPosition, ENUMS.ringPosition, d.ringPosition),
    ringOuterMm: clamp(r.ringOuterMm, 4, 30, d.ringOuterMm),
    ringHoleMm: clamp(r.ringHoleMm, 1.5, 20, d.ringHoleMm),
    slotWidthMm: clamp(r.slotWidthMm, 4, 40, d.slotWidthMm),
    slotHeightMm: clamp(r.slotHeightMm, 1.5, 12, d.slotHeightMm),
    ringOffsetXMm: clamp(r.ringOffsetXMm, -20, 20, d.ringOffsetXMm),
    ringOffsetYMm: clamp(r.ringOffsetYMm, -20, 20, d.ringOffsetYMm),

    colors: {
      base: hex(c.base, d.colors.base),
      text: hex(c.text, d.colors.text),
      accent: hex(c.accent, d.colors.accent),
      border: c.border == null ? null : hex(c.border, null),
    },

    curveQuality: pick(r.curveQuality, ENUMS.curveQuality, d.curveQuality),
    snapToLayers: bool(r.snapToLayers, d.snapToLayers),
  };
  // el agujero debe caber dentro de la oreja con al menos 0.8 mm de pared
  if (p.ringHoleMm > p.ringOuterMm - 1.6) p.ringHoleMm = Math.max(1.5, p.ringOuterMm - 1.6);
  return p;
}

/** Tolerancia de aplanado de curvas (mm) y factor de segmentos por calidad. */
export function qualityTol(q) {
  return q === 'draft' ? 0.08 : q === 'high' ? 0.01 : 0.03;
}

/** Divide el texto de lote en nombres según el separador. */
export function splitBatch(text, separator) {
  const sep = separator === 'comma' ? /,/ : separator === 'semicolon' ? /;/ : /\r?\n/;
  return text
    .split(sep)
    .map((s) => s.replace(/\|/g, '\n').trim())
    .filter(Boolean);
}
