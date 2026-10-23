// Parámetros del llavero patente: valores por defecto y normalización.
// `normalizeParams` NUNCA tira excepción: clampea y completa lo que falte.

import { toNumber } from '../../core/util/number.js';

export const PARAMS_VERSION = 1;

export const defaults = {
  // Patente
  style: 'mercosur',
  plateNew: 'AB 123 CD',
  plateOld: 'ABC 123',
  topText: 'REPÚBLICA ARGENTINA',
  topTextOld: 'ARGENTINA',
  fontId: 'bebas-neue',
  charFill: 80,
  charWidth: 115,
  letterSpacingMm: 0.6,
  boldOffsetMm: 0,
  showFlag: true,
  showStars: true,
  showShield: true,
  showSlots: true,
  // Llavero
  widthMm: 70,
  plateThicknessMm: 3,
  // Por capas: cada color en su propia altura, se imprime sin AMS cambiando el filamento. Misma altura: necesita AMS.
  colorMode: 'layers',
  layerStepMm: 0.4,
  textStyle: 'raised',
  reliefMm: 0.8,
  border: true,
  borderWidthMm: 0.8,
  // Sujeción
  attach: 'ring',
  ringSide: 'left',
  ringHoleMm: 4,
  ringWallMm: 1.8,
  // Colores: los de la Mercosur (placa blanca, letras negras, franja azul, bandera celeste) y los de la vieja
  // (placa blanca, recuadro negro, leyenda y escudo celestes) por separado, así cambiar de estilo no los cruza.
  colors: { base: '#ffffff', text: '#111111', band: '#1d4fa3', flag: '#74acdf', oldBase: '#ffffff', oldPanel: '#111111', oldLegend: '#2b9fd3' },
  // Calidad
  curveQuality: 'high',
  snapToLayers: true,
};

const ENUMS = {
  style: ['mercosur', 'old'],
  colorMode: ['layers', 'mmu'],
  textStyle: ['raised', 'inlay'],
  attach: ['ring', 'inside', 'none'],
  ringSide: ['left', 'right', 'top'],
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
    style: pick(r.style, ENUMS.style, d.style),
    plateNew: str(r.plateNew, d.plateNew, 12),
    plateOld: str(r.plateOld, d.plateOld, 12),
    topText: str(r.topText, d.topText, 30),
    topTextOld: str(r.topTextOld, d.topTextOld, 30),
    fontId: typeof r.fontId === 'string' && r.fontId ? r.fontId : d.fontId,
    charFill: clamp(r.charFill, 40, 100, d.charFill),
    charWidth: clamp(r.charWidth, 60, 160, d.charWidth),
    letterSpacingMm: clamp(r.letterSpacingMm, -1, 4, d.letterSpacingMm),
    boldOffsetMm: clamp(r.boldOffsetMm, 0, 0.6, d.boldOffsetMm),
    showFlag: bool(r.showFlag, d.showFlag),
    showStars: bool(r.showStars, d.showStars),
    showShield: bool(r.showShield, d.showShield),
    showSlots: bool(r.showSlots, d.showSlots),

    widthMm: clamp(r.widthMm, 40, 150, d.widthMm),
    plateThicknessMm: clamp(r.plateThicknessMm, 1.2, 8, d.plateThicknessMm),
    colorMode: pick(r.colorMode, ENUMS.colorMode, d.colorMode),
    layerStepMm: clamp(r.layerStepMm, 0.2, 2, d.layerStepMm),
    textStyle: pick(r.textStyle, ENUMS.textStyle, d.textStyle),
    reliefMm: clamp(r.reliefMm, 0.4, 3, d.reliefMm),
    border: bool(r.border, d.border),
    borderWidthMm: clamp(r.borderWidthMm, 0.6, 4, d.borderWidthMm),

    attach: pick(r.attach, ENUMS.attach, d.attach),
    ringSide: pick(r.ringSide, ENUMS.ringSide, d.ringSide),
    ringHoleMm: clamp(r.ringHoleMm, 2, 10, d.ringHoleMm),
    ringWallMm: clamp(r.ringWallMm, 1, 5, d.ringWallMm),

    colors: {
      base: hex(c.base, d.colors.base),
      text: hex(c.text, d.colors.text),
      band: hex(c.band, d.colors.band),
      flag: hex(c.flag, d.colors.flag),
      oldBase: hex(c.oldBase, d.colors.oldBase),
      oldPanel: hex(c.oldPanel, d.colors.oldPanel),
      oldLegend: hex(c.oldLegend, d.colors.oldLegend),
    },

    curveQuality: pick(r.curveQuality, ENUMS.curveQuality, d.curveQuality),
    snapToLayers: bool(r.snapToLayers, d.snapToLayers),
  };
}

/** Calidad de las curvas (aplanado del texto, en mm) y de las circunferencias (multiplicador de segmentos). */
export function qualityOf(q) {
  return q === 'draft' ? { tol: 0.1, seg: 0.5 } : q === 'high' ? { tol: 0.015, seg: 1.6 } : { tol: 0.04, seg: 1 };
}
