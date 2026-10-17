// Parámetros de la chapita para mascotas: valores por defecto y normalización.
// `normalizeParams` NUNCA tira excepción: clampea y completa lo que falte.

import { toNumber } from '../../core/util/number.js';
import { SHAPES } from './shapes.js';

export const PARAMS_VERSION = 1;

export const defaults = {
  // Texto
  name: 'Boster',
  phone: '3416686947',
  extra: '',
  fontId: 'lato-bold',
  uppercase: true,
  boldOffsetMm: 0.1,
  letterSpacingMm: 0.4,
  textSizing: 'fixed',
  nameSizeMm: 9,
  phoneSizeMm: 6.2,
  extraSizeMm: 4.5,
  lineGapMm: 2,
  // Forma
  shape: 'bone',
  icon: null,
  widthMm: 55,
  heightMm: 31,
  cornerRadiusMm: 6,
  // Chapita
  plateThicknessMm: 3,
  rim: true,
  rimWidthMm: 1,
  rimHeightMm: 0.8,
  reliefMm: 1,
  textStyle: 'raised',
  engraveDepthMm: 0.8,
  textMarginMm: 1.2,
  textOffsetYMm: 0,
  // Sujeción
  attach: 'ring',
  ringSide: 'top',
  ringHoleMm: 4,
  ringWallMm: 1.8,
  ringOffsetMm: 0,
  collarWidthMm: 20,
  slotThicknessMm: 4,
  // Colores: placa celeste y letras blancas. El borde usa el color de las letras salvo que se elija otro; con la
  // placa y las letras de colores distintos es UN solo cambio de color (y con el mismo color, una sola pieza).
  colors: { base: '#4fb3f0', text: '#ffffff', border: null },
  // Calidad
  curveQuality: 'high',
  snapToLayers: true,
};

const ENUMS = {
  shape: SHAPES,
  textSizing: ['auto', 'fixed'],
  textStyle: ['raised', 'inlay', 'engraved'],
  attach: ['ring', 'inside', 'slots', 'none'],
  ringSide: ['top', 'bottom', 'left', 'right'],
  curveQuality: ['draft', 'normal', 'high'],
};

const clamp = (v, min, max, def) => Math.min(max, Math.max(min, toNumber(v, def)));
const pick = (v, list, def) => (list.includes(v) ? v : def);
const bool = (v, def) => (typeof v === 'boolean' ? v : def);
const str = (v, def, max) => (typeof v === 'string' ? v.slice(0, max) : def);
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
    name: str(r.name, d.name, 30),
    phone: str(r.phone, d.phone, 30),
    extra: str(r.extra, d.extra, 40),
    fontId: typeof r.fontId === 'string' && r.fontId ? r.fontId : d.fontId,
    uppercase: bool(r.uppercase, d.uppercase),
    boldOffsetMm: clamp(r.boldOffsetMm, 0, 0.6, d.boldOffsetMm),
    letterSpacingMm: clamp(r.letterSpacingMm, -1, 3, d.letterSpacingMm),
    textSizing: pick(r.textSizing, ENUMS.textSizing, d.textSizing),
    nameSizeMm: clamp(r.nameSizeMm, 2, 30, d.nameSizeMm),
    phoneSizeMm: clamp(r.phoneSizeMm, 2, 30, d.phoneSizeMm),
    extraSizeMm: clamp(r.extraSizeMm, 2, 30, d.extraSizeMm),
    lineGapMm: clamp(r.lineGapMm, 0.5, 8, d.lineGapMm),

    shape: pick(r.shape, ENUMS.shape, d.shape),
    icon: typeof r.icon === 'string' && r.icon ? r.icon : null,
    widthMm: clamp(r.widthMm, 20, 150, d.widthMm),
    heightMm: clamp(r.heightMm, 15, 100, d.heightMm),
    cornerRadiusMm: clamp(r.cornerRadiusMm, 0, 50, d.cornerRadiusMm),

    plateThicknessMm: clamp(r.plateThicknessMm, 1.2, 10, d.plateThicknessMm),
    rim: bool(r.rim, d.rim),
    rimWidthMm: clamp(r.rimWidthMm, 0.6, 5, d.rimWidthMm),
    rimHeightMm: clamp(r.rimHeightMm, 0.2, 4, d.rimHeightMm),
    reliefMm: clamp(r.reliefMm, 0.4, 4, d.reliefMm),
    textStyle: pick(r.textStyle, ENUMS.textStyle, d.textStyle),
    engraveDepthMm: clamp(r.engraveDepthMm, 0.3, 3, d.engraveDepthMm),
    textMarginMm: clamp(r.textMarginMm, 0.4, 6, d.textMarginMm),
    textOffsetYMm: clamp(r.textOffsetYMm, -30, 30, d.textOffsetYMm),

    attach: pick(r.attach, ENUMS.attach, d.attach),
    ringSide: pick(r.ringSide, ENUMS.ringSide, d.ringSide),
    ringHoleMm: clamp(r.ringHoleMm, 2, 12, d.ringHoleMm),
    ringWallMm: clamp(r.ringWallMm, 1, 6, d.ringWallMm),
    ringOffsetMm: clamp(r.ringOffsetMm, -60, 60, d.ringOffsetMm),
    collarWidthMm: clamp(r.collarWidthMm, 8, 60, d.collarWidthMm),
    slotThicknessMm: clamp(r.slotThicknessMm, 2, 10, d.slotThicknessMm),

    colors: {
      base: hex(c.base, d.colors.base),
      text: hex(c.text, d.colors.text),
      border: c.border == null ? null : hex(c.border, null),
    },

    curveQuality: pick(r.curveQuality, ENUMS.curveQuality, d.curveQuality),
    snapToLayers: bool(r.snapToLayers, d.snapToLayers),
  };
}

/** Calidad de las curvas (calcula el aplanado del texto, en mm) y de las circunferencias (multiplicador de segmentos). */
export function qualityOf(q) {
  return q === 'draft' ? { tol: 0.1, seg: 0.5 } : q === 'high' ? { tol: 0.015, seg: 1.6 } : { tol: 0.04, seg: 1 };
}
