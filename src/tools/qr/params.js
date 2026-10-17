// Parámetros de la herramienta de códigos QR: valores por defecto y normalización.
// `normalizeParams` NUNCA tira excepción: clampea y completa lo que falte.

import { toNumber } from '../../core/util/number.js';

export const PARAMS_VERSION = 1;

/** Claves que no se guardan en el navegador ni viajan en el enlace compartido (datos sensibles). */
export const VOLATILE_KEYS = ['wifiPassword'];

export const defaults = {
  // Contenido
  contentType: 'text',
  text: 'https://bitcoin3d.com.ar',
  wifiSsid: '',
  wifiPassword: '',
  wifiSecurity: 'WPA',
  wifiHidden: false,
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  contactOrg: '',
  ecc: 'M',
  // Tamaño y forma
  sizeMm: 40,
  marginMm: 4,
  cornerRadiusMm: 4,
  baseThicknessMm: 2.4,
  // Código
  style: 'relief',
  reliefMm: 0.8,
  // Texto debajo
  label: '',
  fontId: 'lato-bold',
  labelSizeMm: 5,
  // Imanes en la cara de atrás
  magnets: 0,
  magnetDiameterMm: 10,
  magnetThicknessMm: 2,
  magnetClearanceMm: 0.2,
  // Argolla
  ring: 'none',
  ringOuterMm: 9,
  ringHoleMm: 4.5,
  // Colores
  colors: { base: '#ffffff', code: '#111111' },
  // Calidad
  curveQuality: 'high',
  snapToLayers: true,
};

const ENUMS = {
  contentType: ['text', 'wifi', 'contact'],
  wifiSecurity: ['WPA', 'WEP', 'nopass'],
  ecc: ['L', 'M', 'Q', 'H'],
  style: ['relief', 'flush'],
  ring: ['none', 'top', 'left'],
  curveQuality: ['draft', 'normal', 'high'],
};

export const LIMITS = { text: 300, wifi: 64, contact: 80 };

const clamp = (v, min, max, def) => Math.min(max, Math.max(min, toNumber(v, def)));
const pick = (v, list, def) => (list.includes(v) ? v : def);
const bool = (v, def) => (typeof v === 'boolean' ? v : def);
const str = (v, max, def) => (typeof v === 'string' ? v.slice(0, max) : def);
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
    contentType: pick(r.contentType, ENUMS.contentType, d.contentType),
    text: str(r.text, LIMITS.text, d.text),
    wifiSsid: str(r.wifiSsid, LIMITS.wifi, d.wifiSsid),
    wifiPassword: str(r.wifiPassword, LIMITS.wifi, d.wifiPassword),
    wifiSecurity: pick(r.wifiSecurity, ENUMS.wifiSecurity, d.wifiSecurity),
    wifiHidden: bool(r.wifiHidden, d.wifiHidden),
    contactName: str(r.contactName, LIMITS.contact, d.contactName),
    contactPhone: str(r.contactPhone, LIMITS.contact, d.contactPhone),
    contactEmail: str(r.contactEmail, LIMITS.contact, d.contactEmail),
    contactOrg: str(r.contactOrg, LIMITS.contact, d.contactOrg),
    ecc: pick(r.ecc, ENUMS.ecc, d.ecc),

    sizeMm: clamp(r.sizeMm, 15, 150, d.sizeMm),
    marginMm: clamp(r.marginMm, 1, 20, d.marginMm),
    cornerRadiusMm: clamp(r.cornerRadiusMm, 0, 30, d.cornerRadiusMm),
    baseThicknessMm: clamp(r.baseThicknessMm, 1.2, 10, d.baseThicknessMm),

    style: pick(r.style, ENUMS.style, d.style),
    reliefMm: clamp(r.reliefMm, 0.4, 3, d.reliefMm),

    label: str(r.label, 40, d.label),
    fontId: typeof r.fontId === 'string' && r.fontId ? r.fontId : d.fontId,
    labelSizeMm: clamp(r.labelSizeMm, 2, 20, d.labelSizeMm),

    magnets: [0, 1, 2, 4].includes(Math.round(toNumber(r.magnets, d.magnets))) ? Math.round(toNumber(r.magnets, d.magnets)) : d.magnets,
    magnetDiameterMm: clamp(r.magnetDiameterMm, 3, 30, d.magnetDiameterMm),
    magnetThicknessMm: clamp(r.magnetThicknessMm, 0.5, 10, d.magnetThicknessMm),
    magnetClearanceMm: clamp(r.magnetClearanceMm, 0, 1, d.magnetClearanceMm),

    ring: pick(r.ring, ENUMS.ring, d.ring),
    ringOuterMm: clamp(r.ringOuterMm, 6, 30, d.ringOuterMm),
    ringHoleMm: clamp(r.ringHoleMm, 1.5, 20, d.ringHoleMm),

    colors: {
      base: hex(c.base, d.colors.base),
      code: hex(c.code, d.colors.code),
    },

    curveQuality: pick(r.curveQuality, ENUMS.curveQuality, d.curveQuality),
    snapToLayers: bool(r.snapToLayers, d.snapToLayers),
  };
  // el agujero debe caber en la oreja con al menos 1,2 mm de pared
  if (p.ringHoleMm > p.ringOuterMm - 2.4) p.ringHoleMm = Math.max(1.5, p.ringOuterMm - 2.4);
  return p;
}

/** Quita de los params las claves sensibles (para guardarlos o compartirlos). */
export function stripVolatile(params) {
  const out = { ...params };
  for (const k of VOLATILE_KEYS) delete out[k];
  return out;
}

/** Tolerancia de aplanado de curvas (mm) por calidad (solo afecta al texto de debajo). */
export function qualityTol(q) {
  return q === 'draft' ? 0.1 : q === 'high' ? 0.015 : 0.04;
}
