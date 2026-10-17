// PIN del "modo taller". Funciones puras de criptografía (WebCrypto: sirve en el navegador y en Node 20+).
//
// Qué se publica (public/config.json): { salt, iterations, check }. El PIN NO se guarda en ningún lado.
//
//   K     = PBKDF2-SHA256(PIN, salt, iterations)          lento a propósito: frena adivinar PIN por fuerza bruta
//   token = SHA-256("b3d-token:" + K)                     lo que el navegador guarda al entrar (prueba de que se sabía el PIN)
//   check = SHA-256("b3d-check:" + token)                 lo único público
//
// Como `check` es una función de un solo sentido de `token`, ver `check` no permite fabricar un `token`: hay que conocer el PIN.
// Por eso editar el almacenamiento del navegador no sirve para saltear el PIN.
//
// LÍMITES (no se pueden evitar en un sitio estático): quien tenga `check` y `salt` puede probar PINs offline (con 4 dígitos son
// solo 10.000 combinaciones: el costo por intento de PBKDF2 lo encarece, no lo impide), y quien edite el código de su propio
// navegador puede mostrar la interfaz igual. Lo que esto protege es la interfaz, no los archivos: para eso existe la
// compilación pública (`npm run build:public`), que no incluye el código del taller.

const enc = new TextEncoder();

export const DEFAULT_ITERATIONS = 600_000;
export const PIN_PATTERN = /^\d{4,12}$/;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16));

async function sha256Hex(text) {
  return hex(await globalThis.crypto.subtle.digest('SHA-256', enc.encode(text)));
}

/** Compara en tiempo constante (para no filtrar cuántos caracteres coinciden). */
function sameString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Forma válida de la configuración publicada. */
export function validPinConfig(cfg) {
  return (
    !!cfg &&
    typeof cfg === 'object' &&
    typeof cfg.salt === 'string' &&
    /^[0-9a-f]{16,128}$/.test(cfg.salt) &&
    cfg.salt.length % 2 === 0 &&
    Number.isInteger(cfg.iterations) &&
    cfg.iterations >= 1000 &&
    cfg.iterations <= 5_000_000 &&
    typeof cfg.check === 'string' &&
    /^[0-9a-f]{64}$/.test(cfg.check)
  );
}

/** token = lo que queda guardado cuando se ingresó el PIN correcto. */
export async function deriveToken(pin, saltHex, iterations) {
  const key = await globalThis.crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations }, key, 256);
  return sha256Hex(`b3d-token:${hex(bits)}`);
}

const checkOf = (token) => sha256Hex(`b3d-check:${token}`);

/**
 * Crea la configuración pública para un PIN nuevo (la usa `npm run pin`).
 * @param {string} pin  4 a 12 dígitos
 * @param {{ iterations?: number, salt?: string }} [o]
 * @returns {Promise<{ salt: string, iterations: number, check: string }>}
 */
export async function createPinConfig(pin, { iterations = DEFAULT_ITERATIONS, salt } = {}) {
  if (!PIN_PATTERN.test(String(pin))) throw new Error('El PIN debe tener entre 4 y 12 dígitos.');
  const saltHex = salt ?? hex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const cfg = { salt: saltHex, iterations, check: await checkOf(await deriveToken(pin, saltHex, iterations)) };
  if (!validPinConfig(cfg)) throw new Error('Configuración de PIN inválida.');
  return cfg;
}

/** @returns {Promise<string|null>} el token si el PIN es correcto, o null */
export async function verifyPin(pin, cfg) {
  if (!validPinConfig(cfg) || !PIN_PATTERN.test(String(pin))) return null;
  const token = await deriveToken(pin, cfg.salt, cfg.iterations);
  return sameString(await checkOf(token), cfg.check) ? token : null;
}

/** ¿El token guardado en el navegador corresponde a este PIN? */
export async function verifyToken(token, cfg) {
  if (!validPinConfig(cfg) || typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return false;
  return sameString(await checkOf(token), cfg.check);
}
