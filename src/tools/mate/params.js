// Parámetros del mate: valores por defecto y normalización.
// `normalizeParams` NUNCA tira excepción: clampea y completa lo que falte.

import { toNumber } from '../../core/util/number.js';
import { PATTERNS } from '../../core/kernel/surface.js';

export const PARAMS_VERSION = 1;

export const defaults = {
  // Interior de aluminio (el hueco del mate es su negativo). Medidas del "Interior para mate 3D" de Bat-Alu.
  insertHeightMm: 70,
  insertBaseDiameterMm: 50,
  insertBodyDiameterMm: 52,
  insertMouthDiameterMm: 80,
  insertFlareHeightMm: 15,
  insertBaseRadiusMm: 3,
  clearanceMm: 0.2,
  rimMode: 'flush',
  rimLipMm: 2.5,
  // Forma del mate
  heightMm: 90,
  profile: 'curve',
  bottomDiameterMm: 66,
  midDiameterMm: 98,
  midPosition: 0.45,
  topDiameterMm: 95,
  wallMm: 3,
  selfSupport: true,
  overhangDeg: 40,
  // Textura
  pattern: 'ribs',
  patternCount: 24,
  patternDepthMm: 3,
  patternPeriodMm: 20,
  twistDeg: 0,
  // Color
  colors: { body: '#4f7a5a' },
  // Calidad
  curveQuality: 'high',
};

const ENUMS = {
  rimMode: ['flush', 'rest'],
  profile: ['curve', 'straight', 'vase', 'follow'],
  pattern: PATTERNS,
  curveQuality: ['draft', 'normal', 'high'],
};

const clamp = (v, min, max, def) => Math.min(max, Math.max(min, toNumber(v, def)));
const pick = (v, list, def) => (list.includes(v) ? v : def);
const hex = (v, def) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : def);

/**
 * @param {any} raw
 * @returns {typeof defaults} parámetros válidos
 */
export function normalizeParams(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = defaults;
  const c = r.colors && typeof r.colors === 'object' ? r.colors : {};

  const insertHeightMm = clamp(r.insertHeightMm, 30, 150, d.insertHeightMm);
  const insertBodyDiameterMm = clamp(r.insertBodyDiameterMm, 20, 120, d.insertBodyDiameterMm);
  // la campana deja al menos 5 mm de cuerpo recto abajo
  const insertFlareHeightMm = Math.min(insertHeightMm - 5, clamp(r.insertFlareHeightMm, 2, 60, d.insertFlareHeightMm));
  return {
    insertHeightMm,
    insertBaseDiameterMm: clamp(r.insertBaseDiameterMm, 20, 120, d.insertBaseDiameterMm),
    insertBodyDiameterMm,
    // la boca nunca es más angosta que el cuerpo (si no, no hay "campana")
    insertMouthDiameterMm: Math.max(insertBodyDiameterMm, clamp(r.insertMouthDiameterMm, 20, 140, d.insertMouthDiameterMm)),
    insertFlareHeightMm,
    // el redondeo del fondo entra en el cuerpo recto
    insertBaseRadiusMm: Math.min(insertHeightMm - insertFlareHeightMm - 0.5, clamp(r.insertBaseRadiusMm, 0, 10, d.insertBaseRadiusMm)),
    clearanceMm: clamp(r.clearanceMm, 0, 1.5, d.clearanceMm),
    rimMode: pick(r.rimMode, ENUMS.rimMode, d.rimMode),
    rimLipMm: clamp(r.rimLipMm, 0.5, 8, d.rimLipMm),

    heightMm: clamp(r.heightMm, 40, 220, d.heightMm),
    profile: pick(r.profile, ENUMS.profile, d.profile),
    bottomDiameterMm: clamp(r.bottomDiameterMm, 30, 220, d.bottomDiameterMm),
    midDiameterMm: clamp(r.midDiameterMm, 30, 240, d.midDiameterMm),
    midPosition: clamp(r.midPosition, 0.15, 0.85, d.midPosition),
    topDiameterMm: clamp(r.topDiameterMm, 30, 240, d.topDiameterMm),
    wallMm: clamp(r.wallMm, 1.2, 10, d.wallMm),
    selfSupport: typeof r.selfSupport === 'boolean' ? r.selfSupport : d.selfSupport,
    overhangDeg: clamp(r.overhangDeg, 20, 55, d.overhangDeg),

    pattern: pick(r.pattern, ENUMS.pattern, d.pattern),
    patternCount: Math.round(clamp(r.patternCount, 3, 160, d.patternCount)),
    patternDepthMm: clamp(r.patternDepthMm, 0.5, 12, d.patternDepthMm),
    patternPeriodMm: clamp(r.patternPeriodMm, 6, 80, d.patternPeriodMm),
    twistDeg: clamp(r.twistDeg, -720, 720, d.twistDeg),

    colors: { body: hex(c.body, d.colors.body) },

    curveQuality: pick(r.curveQuality, ENUMS.curveQuality, d.curveQuality),
  };
}

/** Resolución de la malla por calidad: vértices por vuelta y paso vertical máximo (mm). */
export function meshDensity(q) {
  return q === 'draft' ? { segments: 144, dz: 2 } : q === 'high' ? { segments: 320, dz: 1 } : { segments: 256, dz: 1.2 };
}
