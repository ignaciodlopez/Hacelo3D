// "Modo taller": muestra lo que necesita quien fabrica (descargar archivos, gramos, cambios de color, perfil de la
// impresora) y que a un cliente le sobra. Por defecto está apagado.
//
// Con un PIN configurado (npm run pin), solo se activa sabiéndolo. Lo que el navegador recuerda NO es un "sí/no" que se
// pueda editar, sino un token que solo sale de derivar el PIN (ver workshopPin.js): poner la bandera a mano no sirve.
// Sin PIN configurado, el interruptor activa el modo directamente (útil en desarrollo).
//
// Esto protege la interfaz de curiosos, no los archivos: quien edite el código de su navegador puede mostrarla igual.
// Para que el sitio público directamente no tenga el código del taller: npm run build:public.

import { loadShopConfig } from './shopConfig.js';

const FLAG_KEY = 'b3d.workshop'; // modo sin PIN
const TOKEN_KEY = 'b3d.workshop.token'; // modo con PIN
const FAILS_KEY = 'b3d.workshop.fails';
/** Intentos fallidos seguidos a partir de los cuales hay que esperar. */
const FREE_ATTEMPTS = 5;
const BASE_LOCK_S = 30;
const MAX_LOCK_S = 900;

const listeners = new Set();
let on = false;
let pinCfg = null;

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* sin storage */
  }
};
const notify = () => listeners.forEach((fn) => fn(on));

/** ¿Está activo el modo taller? Siempre false en la compilación pública. */
export function isWorkshop() {
  return __WORKSHOP__ && on;
}

/** ¿Hay un PIN configurado? (entonces activar el modo lo pide) */
export function hasPin() {
  return __WORKSHOP__ && !!pinCfg;
}

export function onWorkshopChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Lee la configuración y decide el estado inicial. Hay que esperarla antes de dibujar la primera pantalla. */
export async function initWorkshop() {
  if (!__WORKSHOP__) return;
  pinCfg = (await loadShopConfig()).workshopPin;
  if (pinCfg) {
    // con PIN la bandera vieja se ignora: solo vale un token que salga del PIN
    const { verifyToken } = await import('./workshopPin.js');
    const token = read(TOKEN_KEY);
    const ok = !!token && (await verifyToken(token, pinCfg));
    if (token && !ok) write(TOKEN_KEY, null);
    on = ok;
  } else {
    on = read(FLAG_KEY) === '1';
  }
  notify();
}

/** Segundos que faltan para poder reintentar el PIN (0 si se puede). */
export function lockoutSeconds() {
  try {
    const { until } = JSON.parse(read(FAILS_KEY) ?? '{}');
    return Math.max(0, Math.ceil(((until ?? 0) - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

function registerFailure() {
  let n = 0;
  try {
    n = JSON.parse(read(FAILS_KEY) ?? '{}').n ?? 0;
  } catch {
    /* datos rotos */
  }
  n += 1;
  const wait = n >= FREE_ATTEMPTS ? Math.min(MAX_LOCK_S, BASE_LOCK_S * 2 ** (n - FREE_ATTEMPTS)) : 0;
  write(FAILS_KEY, JSON.stringify({ n, until: wait ? Date.now() + wait * 1000 : 0 }));
  return wait;
}

/**
 * Intenta entrar con un PIN.
 * @returns {Promise<{ ok: boolean, lockedFor?: number }>}  `lockedFor`: segundos de espera (por demasiados intentos)
 */
export async function unlockWithPin(pin) {
  if (!__WORKSHOP__ || !pinCfg) return { ok: false };
  const locked = lockoutSeconds();
  if (locked) return { ok: false, lockedFor: locked };
  const { verifyPin } = await import('./workshopPin.js');
  const token = await verifyPin(pin, pinCfg);
  if (!token) {
    const wait = registerFailure();
    return { ok: false, lockedFor: wait || undefined };
  }
  write(FAILS_KEY, null);
  write(TOKEN_KEY, token);
  on = true;
  notify();
  return { ok: true };
}

/** Activa el modo sin pedir PIN (solo si no hay uno configurado). */
export function enableWithoutPin() {
  if (!__WORKSHOP__ || pinCfg) return false;
  write(FLAG_KEY, '1');
  on = true;
  notify();
  return true;
}

/** Apaga el modo y olvida el token: para volver a entrar hay que poner el PIN otra vez. */
export function lockWorkshop() {
  write(TOKEN_KEY, null);
  write(FLAG_KEY, null);
  on = false;
  notify();
}
