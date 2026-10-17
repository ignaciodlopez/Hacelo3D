import { test as base, expect } from '@playwright/test';

// El config.json real del sitio puede tener un PIN de verdad (npm run pin) y el número de WhatsApp de la tienda: los tests
// no deben depender de eso. Por defecto cada página recibe una tienda de prueba SIN PIN; un test que necesite otra
// configuración registra su propio `page.route('**/config.json', …)`, que tiene prioridad (la última ruta gana).
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/config.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ shopName: 'Bitcoin3D', whatsapp: '5493416686947' }) }));
    await use(page);
  },
});

export { expect };
