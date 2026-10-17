// localStorage por herramienta + URL compartible. Todo con try/catch: el storage
// puede no existir (modo privado) o tener datos corruptos.

import { deflateSync, inflateSync } from 'fflate';

const PREFIX = 'b3d.tool.';

export function loadSaved(toolId) {
  try {
    const raw = localStorage.getItem(PREFIX + toolId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function save(toolId, params, version) {
  try {
    localStorage.setItem(PREFIX + toolId, JSON.stringify({ v: version, params }));
  } catch {
    /* sin storage */
  }
}

export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin storage */
  }
}

// ---- URL compartible
//
// Formato nuevo (empieza con "~"): base64url(deflate(JSON({ v, p }))), donde `p` lleva SOLO lo que difiere de los
// valores por defecto de la herramienta. Un enlace típico mide unas decenas de caracteres en vez de ~1000.
// Formato viejo (sin "~"): base64url(JSON({ v, params })) con todos los parámetros. Se sigue pudiendo abrir.
//
// Ojo: el nuevo no guarda lo que vale igual que el default, así que si una actualización cambia un valor por defecto,
// un enlace viejo muestra el nuevo default en lo que el autor no había tocado.
// NO usar btoa directo sobre el texto (falla con emojis): se pasa por bytes UTF-8.

const NEW_FORMAT = '~';

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Lo de `cur` que difiere de `def` (objetos anidados incluidos); `undefined` si no difiere en nada. */
function diffFromDefaults(cur, def) {
  if (isPlain(cur) && isPlain(def)) {
    const out = {};
    for (const k of Object.keys(cur)) {
      const d = diffFromDefaults(cur[k], def[k]);
      if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (cur === undefined) return undefined;
  return JSON.stringify(cur) === JSON.stringify(def) ? undefined : cur;
}

/** `def` con `patch` encima, recursivo en objetos (un null o un valor del patch pisa al default). */
function applyPatch(def, patch) {
  if (isPlain(def) && isPlain(patch)) {
    const out = { ...def };
    for (const k of Object.keys(patch)) out[k] = applyPatch(def[k], patch[k]);
    return out;
  }
  return patch;
}

/**
 * @param {any} params
 * @param {number} version
 * @param {any} [defaults]  valores por defecto de la herramienta: si se pasan, el enlace lleva solo las diferencias
 */
export function encodeShare(params, version, defaults) {
  const p = defaults ? (diffFromDefaults(params, defaults) ?? {}) : params;
  const bytes = new TextEncoder().encode(JSON.stringify({ v: version, p, d: defaults ? 1 : 0 }));
  return NEW_FORMAT + toBase64Url(deflateSync(bytes, { level: 9 }));
}

/**
 * @param {string} str
 * @param {any} [defaults]  los defaults actuales de la herramienta (hacen falta para abrir enlaces nuevos con solo las diferencias)
 * @returns {{ v:number, params:any } | null}
 */
export function decodeShare(str, defaults) {
  try {
    if (str.startsWith(NEW_FORMAT)) {
      const obj = JSON.parse(new TextDecoder().decode(inflateSync(fromBase64Url(str.slice(1)))));
      if (!obj || typeof obj !== 'object' || !isPlain(obj.p)) return null;
      return { v: obj.v, params: obj.d ? applyPatch(defaults ?? {}, obj.p) : obj.p };
    }
    const obj = JSON.parse(new TextDecoder().decode(fromBase64Url(str)));
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}
