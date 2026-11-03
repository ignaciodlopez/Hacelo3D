// Parámetros del organizador de escritorio: valores por defecto y normalización.
// `normalizeParams` NUNCA tira excepción: clampea y completa lo que falte.
// Los valores por defecto son los del modelo de referencia (un lapicero con soporte de celular de 6,5 × 3,25 × 3,2 pulgadas).

import { toNumber } from '../../core/util/number.js';

export const PARAMS_VERSION = 2;

export const defaults = {
  // Lapicero (la taza)
  pens: true,
  cupWidthMm: 76.2,
  cupDepthMm: 82.55,
  cupHeightMm: 81.28,
  cupDividers: 0,
  // Soporte de celular (placa inclinada hacia atrás con un labio adelante)
  phone: true,
  phoneWidthMm: 88.9,
  phoneSlotMm: 16,
  phoneAngleDeg: 15,
  phoneHeightMm: 81.28,
  phoneLipMm: 5.5,
  phoneSide: 'right',
  // Medidas generales
  wallMm: 3.81,
  baseMm: 5.08,
  cornerRadiusMm: 12.7,
  edgeRadiusMm: 1.5,
  // Colores
  colors: { base: '#4fb3f0' },
  // Calidad
  curveQuality: 'normal',
  snapToLayers: true,
};

const ENUMS = {
  phoneSide: ['left', 'right'],
  curveQuality: ['draft', 'normal', 'high'],
};

const clamp = (v, min, max, def) => Math.min(max, Math.max(min, toNumber(v, def)));
const int = (v, min, max, def) => Math.round(clamp(v, min, max, def));
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
    pens: bool(r.pens, d.pens),
    cupWidthMm: clamp(r.cupWidthMm, 40, 140, d.cupWidthMm),
    cupDepthMm: clamp(r.cupDepthMm, 40, 140, d.cupDepthMm),
    cupHeightMm: clamp(r.cupHeightMm, 30, 150, d.cupHeightMm),
    cupDividers: int(r.cupDividers, 0, 3, d.cupDividers),

    phone: bool(r.phone, d.phone),
    phoneWidthMm: clamp(r.phoneWidthMm, 60, 140, d.phoneWidthMm),
    phoneSlotMm: clamp(r.phoneSlotMm, 8, 30, d.phoneSlotMm),
    // más de 30°: la cara de atrás de la placa vuela demasiado y no se imprime sin soportes
    phoneAngleDeg: clamp(r.phoneAngleDeg, 0, 30, d.phoneAngleDeg),
    phoneHeightMm: clamp(r.phoneHeightMm, 40, 150, d.phoneHeightMm),
    phoneLipMm: clamp(r.phoneLipMm, 3, 20, d.phoneLipMm),
    phoneSide: pick(r.phoneSide, ENUMS.phoneSide, d.phoneSide),

    wallMm: clamp(r.wallMm, 1.6, 6, d.wallMm),
    baseMm: clamp(r.baseMm, 2, 8, d.baseMm),
    cornerRadiusMm: clamp(r.cornerRadiusMm, 0, 25, d.cornerRadiusMm),
    edgeRadiusMm: clamp(r.edgeRadiusMm, 0, 4, d.edgeRadiusMm),

    colors: { base: hex(c.base, d.colors.base) },

    curveQuality: pick(r.curveQuality, ENUMS.curveQuality, d.curveQuality),
    snapToLayers: bool(r.snapToLayers, d.snapToLayers),
  };
}

/** Calidad: segmentos de los círculos (multiplicador de `segmentsFor`). */
export function qualityOf(q) {
  return q === 'draft' ? { seg: 0.5 } : q === 'high' ? { seg: 1.6 } : { seg: 1 };
}
