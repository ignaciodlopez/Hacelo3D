// Datos de la tienda que ven los clientes (a quién llegan los pedidos) y, si se configuró, el verificador del PIN del
// modo taller. Viven en public/config.json, que se edita sin recompilar: es un sitio estático, así que se lee al abrir.

import { validPinConfig } from './workshopPin.js';

const BASE = import.meta.env.BASE_URL;
const TIMEOUT_MS = 4000;
let promise = null;

/**
 * Normaliza lo que haya en config.json (nunca tira).
 * @param {any} raw
 * @returns {{ shopName: string, whatsapp: string, showOrderButton: boolean, workshopPin: { salt: string, iterations: number, check: string } | null }}
 */
export function normalizeShopConfig(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  let digits = String(r.whatsapp ?? '').replace(/\D/g, '').replace(/^00/, '');
  // 10 dígitos sin código de país: celular argentino (cód. de área + número) → 549…
  if (digits.length === 10) digits = `549${digits}`;
  if (digits.length < 8 || digits.length > 15) digits = '';
  const pin = r.workshop;
  return {
    shopName: typeof r.shopName === 'string' ? r.shopName.trim().slice(0, 40) : '',
    whatsapp: digits,
    showOrderButton: r.showOrderButton !== false,
    workshopPin: validPinConfig(pin) ? { salt: pin.salt, iterations: pin.iterations, check: pin.check } : null,
  };
}

export function loadShopConfig() {
  if (!promise) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    promise = fetch(`${BASE}config.json`, { cache: 'no-cache', signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}))
      .finally(() => clearTimeout(timer))
      .then(normalizeShopConfig);
  }
  return promise;
}
