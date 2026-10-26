// Parámetros de los organizadores de taller: valores por defecto y normalización.
// `normalizeParams` NUNCA tira excepción: clampea y completa lo que falte.

import { toNumber } from '../../core/util/number.js';
import { BRANDS } from './brands.js';

export const PARAMS_VERSION = 1;

/** Punta de atornillador estándar: hexágono de 1/4" entre caras. */
export const BIT_HEX_MM = 6.35;
/** Medidas de mecha aceptadas (mm) y máximo de mechas. */
export const DRILL_MIN = 1;
export const DRILL_MAX = 25;
export const MAX_DRILLS = 40;

export const defaults = {
  kind: 'case',
  // Estuche porta mechas (caja con tapa, bisagras y trabas que encastran a presión, sin metal)
  caseLengthMm: 220,
  caseWidthMm: 70,
  caseHeightMm: 60,
  lidHeightMm: 20,
  caseWallMm: 2.4,
  pinMm: 3.2,
  pinClearanceMm: 0.3,
  latchSnapMm: 0.2,
  caseView: 'closed',
  // Caja con divisiones
  boxWidthMm: 120,
  boxDepthMm: 80,
  boxHeightMm: 40,
  boxCols: 3,
  boxRows: 2,
  wallMm: 1.6,
  floorMm: 1.2,
  dividerMm: 1.2,
  dividerHeightPct: 100,
  cornerRadiusMm: 4,
  scoop: true,
  scoopRadiusMm: 12,
  // Porta mechas
  drillSizes: '3 4 5 6 7 8 10',
  drillRows: 1,
  drillClearanceMm: 0.4,
  drillDepthMm: 22,
  drillLabels: true,
  // Porta puntas
  bitCols: 10,
  bitRows: 2,
  bitClearanceMm: 0.25,
  bitDepthMm: 12,
  // Porta mechas y puntas
  gapMm: 4,
  stepMm: 8,
  // Logo (en la tapa del estuche; en el frente de lo demás)
  logo: 'milwaukee',
  logoStyle: 'flush',
  logoDepthMm: 0.8,
  logoSizePct: 85,
  // Colores
  colors: { base: '#c8102e', logo: '#ffffff', latch: '#1a1a1a' },
  // Calidad
  curveQuality: 'normal',
  snapToLayers: true,
};

const ENUMS = {
  kind: ['case', 'box', 'drills', 'bits'],
  caseView: ['closed', 'print'],
  logoStyle: ['relief', 'flush', 'engraved'],
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
    kind: pick(r.kind, ENUMS.kind, d.kind),

    caseLengthMm: clamp(r.caseLengthMm, 80, 350, d.caseLengthMm),
    caseWidthMm: clamp(r.caseWidthMm, 40, 160, d.caseWidthMm),
    caseHeightMm: clamp(r.caseHeightMm, 20, 120, d.caseHeightMm),
    lidHeightMm: clamp(r.lidHeightMm, 12, 60, d.lidHeightMm),
    caseWallMm: clamp(r.caseWallMm, 1.6, 4, d.caseWallMm),
    pinMm: clamp(r.pinMm, 2.4, 5, d.pinMm),
    pinClearanceMm: clamp(r.pinClearanceMm, 0, 1, d.pinClearanceMm),
    latchSnapMm: clamp(r.latchSnapMm, 0, 1, d.latchSnapMm),
    caseView: pick(r.caseView, ENUMS.caseView, d.caseView),

    boxWidthMm: clamp(r.boxWidthMm, 30, 300, d.boxWidthMm),
    boxDepthMm: clamp(r.boxDepthMm, 30, 300, d.boxDepthMm),
    boxHeightMm: clamp(r.boxHeightMm, 10, 150, d.boxHeightMm),
    boxCols: int(r.boxCols, 1, 12, d.boxCols),
    boxRows: int(r.boxRows, 1, 12, d.boxRows),
    wallMm: clamp(r.wallMm, 0.8, 5, d.wallMm),
    floorMm: clamp(r.floorMm, 0.6, 5, d.floorMm),
    dividerMm: clamp(r.dividerMm, 0.8, 5, d.dividerMm),
    dividerHeightPct: clamp(r.dividerHeightPct, 30, 100, d.dividerHeightPct),
    cornerRadiusMm: clamp(r.cornerRadiusMm, 0, 20, d.cornerRadiusMm),
    scoop: bool(r.scoop, d.scoop),
    scoopRadiusMm: clamp(r.scoopRadiusMm, 3, 40, d.scoopRadiusMm),

    drillSizes: typeof r.drillSizes === 'string' ? r.drillSizes.slice(0, 200) : d.drillSizes,
    drillRows: int(r.drillRows, 1, 4, d.drillRows),
    drillClearanceMm: clamp(r.drillClearanceMm, 0, 1.5, d.drillClearanceMm),
    drillDepthMm: clamp(r.drillDepthMm, 5, 80, d.drillDepthMm),
    drillLabels: bool(r.drillLabels, d.drillLabels),

    bitCols: int(r.bitCols, 1, 30, d.bitCols),
    bitRows: int(r.bitRows, 1, 6, d.bitRows),
    bitClearanceMm: clamp(r.bitClearanceMm, 0, 1, d.bitClearanceMm),
    bitDepthMm: clamp(r.bitDepthMm, 4, 30, d.bitDepthMm),

    gapMm: clamp(r.gapMm, 1.5, 15, d.gapMm),
    stepMm: clamp(r.stepMm, 0, 40, d.stepMm),

    logo: typeof r.logo === 'string' && r.logo ? r.logo : null,
    logoStyle: pick(r.logoStyle, ENUMS.logoStyle, d.logoStyle),
    logoDepthMm: clamp(r.logoDepthMm, 0.4, 3, d.logoDepthMm),
    logoSizePct: clamp(r.logoSizePct, 20, 100, d.logoSizePct),

    colors: { base: hex(c.base, d.colors.base), logo: hex(c.logo, d.colors.logo), latch: hex(c.latch, d.colors.latch) },

    curveQuality: pick(r.curveQuality, ENUMS.curveQuality, d.curveQuality),
    snapToLayers: bool(r.snapToLayers, d.snapToLayers),
  };
}

/**
 * Medidas de mecha escritas a mano → números (mm). Acepta coma decimal ("4,5") y separa por espacios, punto y coma,
 * barras o comas entre números ("3, 4, 5"). Devuelve también lo que no se entendió o quedó fuera de rango.
 * @returns {{ sizes:number[], bad:string[] }}
 */
export function parseDrillSizes(text) {
  const tokens = String(text ?? '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .split(/[\s;,/]+/)
    .filter(Boolean);
  const sizes = [];
  const bad = [];
  for (const tok of tokens) {
    const n = Number(tok.replace(/mm$/i, ''));
    if (Number.isFinite(n) && n >= DRILL_MIN && n <= DRILL_MAX && sizes.length < MAX_DRILLS) sizes.push(n);
    else bad.push(tok);
  }
  return { sizes, bad };
}

/** Colores de una marca (al elegir su logo) sobre los actuales; sin marca, los actuales. */
export function brandColors(id, current = {}) {
  const b = BRANDS.find((x) => x.id === id);
  return b ? { ...current, ...b.colors } : current;
}

/** Calidad: segmentos de los círculos y aplanado de las curvas del texto (mm). */
export function qualityOf(q) {
  return q === 'draft' ? { seg: 0.5, tol: 0.1 } : q === 'high' ? { seg: 1.6, tol: 0.015 } : { seg: 1, tol: 0.04 };
}
