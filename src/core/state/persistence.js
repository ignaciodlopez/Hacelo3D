// localStorage por herramienta + URL compartible. Todo con try/catch: el storage
// puede no existir (modo privado) o tener datos corruptos.

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

// ---- URL compartible: base64url(UTF-8(JSON)). NO usar btoa directo (falla con emojis).

export function encodeShare(params, version) {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: version, params }));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}
