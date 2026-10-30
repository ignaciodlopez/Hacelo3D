// Parámetros del organizador de escritorio: valores por defecto y normalización.
// `normalizeParams` NUNCA tira excepción: clampea y completa lo que falte.

import { toNumber } from '../../core/util/number.js';

export const PARAMS_VERSION = 1;

/** Tamaños de taco de notas adhesivas (ancho × fondo en planta, mm). */
export const NOTE_SIZES = { '76x76': [76, 76], '51x76': [51, 76], '38x51': [38, 51] };

export const defaults = {
  // Lapicero
  pens: true,
  penShape: 'round',
  penCols: 2,
  penRows: 2,
  penCellMm: 30,
  penHeightMm: 90,
  penStepMm: 15,
  // Celular
  phone: true,
  phoneWidthMm: 82,
  phoneThicknessMm: 12,
  phoneAngleDeg: 15,
  phoneLipMm: 12,
  phoneBackMm: 70,
  phoneCable: true,
  phoneSide: 'left',
  // Notas adhesivas
  notes: '76x76',
  notesWidthMm: 76,
  notesDepthMm: 76,
  notesClearanceMm: 1.5,
  notesHeightMm: 30,
  notesNotch: true,
  // Bandeja
  tray: false,
  trayDepthMm: 35,
  trayHeightMm: 20,
  trayDividers: 0,
  trayScoop: true,
  // Tarjetas
  cards: false,
  // Texto en el frente
  label: '',
  fontId: 'lato-black',
  labelStyle: 'engraved',
  labelSizeMm: 8,
  labelDepthMm: 0.6,
  // Medidas generales
  wallMm: 3,
  floorMm: 2.4,
  cornerRadiusMm: 10,
  edgeRadiusMm: 1.5,
  podGapMm: 4,
  // Colores
  colors: { base: '#2b2b2b', text: '#f2c14e' },
  // Calidad
  curveQuality: 'normal',
  snapToLayers: true,
};

const ENUMS = {
  penShape: ['round', 'square', 'hex'],
  phoneSide: ['left', 'right'],
  notes: ['none', '76x76', '51x76', '38x51', 'custom'],
  labelStyle: ['engraved', 'relief'],
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
    penShape: pick(r.penShape, ENUMS.penShape, d.penShape),
    penCols: int(r.penCols, 1, 6, d.penCols),
    penRows: int(r.penRows, 1, 3, d.penRows),
    penCellMm: clamp(r.penCellMm, 14, 70, d.penCellMm),
    penHeightMm: clamp(r.penHeightMm, 40, 150, d.penHeightMm),
    penStepMm: clamp(r.penStepMm, 0, 40, d.penStepMm),

    phone: bool(r.phone, d.phone),
    phoneWidthMm: clamp(r.phoneWidthMm, 60, 100, d.phoneWidthMm),
    phoneThicknessMm: clamp(r.phoneThicknessMm, 7, 22, d.phoneThicknessMm),
    // más de 30°: la cara de adelante de la ranura vuela y no se imprime sin soportes
    phoneAngleDeg: clamp(r.phoneAngleDeg, 0, 30, d.phoneAngleDeg),
    phoneLipMm: clamp(r.phoneLipMm, 8, 30, d.phoneLipMm),
    phoneBackMm: clamp(r.phoneBackMm, 40, 120, d.phoneBackMm),
    phoneCable: bool(r.phoneCable, d.phoneCable),
    phoneSide: pick(r.phoneSide, ENUMS.phoneSide, d.phoneSide),

    notes: pick(r.notes, ENUMS.notes, d.notes),
    notesWidthMm: clamp(r.notesWidthMm, 30, 130, d.notesWidthMm),
    notesDepthMm: clamp(r.notesDepthMm, 30, 130, d.notesDepthMm),
    notesClearanceMm: clamp(r.notesClearanceMm, 0.5, 4, d.notesClearanceMm),
    notesHeightMm: clamp(r.notesHeightMm, 15, 60, d.notesHeightMm),
    notesNotch: bool(r.notesNotch, d.notesNotch),

    tray: bool(r.tray, d.tray),
    trayDepthMm: clamp(r.trayDepthMm, 20, 80, d.trayDepthMm),
    trayHeightMm: clamp(r.trayHeightMm, 12, 40, d.trayHeightMm),
    trayDividers: int(r.trayDividers, 0, 4, d.trayDividers),
    trayScoop: bool(r.trayScoop, d.trayScoop),

    cards: bool(r.cards, d.cards),

    label: typeof r.label === 'string' ? r.label.slice(0, 30) : d.label,
    fontId: typeof r.fontId === 'string' && r.fontId ? r.fontId : d.fontId,
    labelStyle: pick(r.labelStyle, ENUMS.labelStyle, d.labelStyle),
    labelSizeMm: clamp(r.labelSizeMm, 4, 20, d.labelSizeMm),
    labelDepthMm: clamp(r.labelDepthMm, 0.4, 1.6, d.labelDepthMm),

    wallMm: clamp(r.wallMm, 1.6, 5, d.wallMm),
    floorMm: clamp(r.floorMm, 1.2, 5, d.floorMm),
    cornerRadiusMm: clamp(r.cornerRadiusMm, 0, 20, d.cornerRadiusMm),
    edgeRadiusMm: clamp(r.edgeRadiusMm, 0, 4, d.edgeRadiusMm),
    podGapMm: clamp(r.podGapMm, 0, 10, d.podGapMm),

    colors: { base: hex(c.base, d.colors.base), text: hex(c.text, d.colors.text) },

    curveQuality: pick(r.curveQuality, ENUMS.curveQuality, d.curveQuality),
    snapToLayers: bool(r.snapToLayers, d.snapToLayers),
  };
}

/** Calidad: segmentos de los círculos y aplanado de las curvas del texto (mm). */
export function qualityOf(q) {
  return q === 'draft' ? { seg: 0.5, tol: 0.1 } : q === 'high' ? { seg: 1.6, tol: 0.015 } : { seg: 1, tol: 0.04 };
}
