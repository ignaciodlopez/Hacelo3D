import { test, expect } from './fixtures.js';

// El sitio es de Bitcoin3D (bitcoin3d.com.ar): ninguna pantalla debe mostrar la marca anterior.
const PAGES = ['/#/', '/#/tool/tag', '/#/tool/keychain', '/#/tool/lamp', '/#/credits'];

test.describe('marca', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('el título de la pestaña y la barra lateral dicen Bitcoin3D, y no queda la marca anterior en ninguna pantalla', async ({ page }) => {
    for (const lang of ['es', 'en']) {
      await page.addInitScript((l) => localStorage.setItem('b3d.lang', l), lang);
      for (const route of PAGES) {
        await page.goto(route);
        await expect(page.locator('h1')).toBeVisible({ timeout: 60000 });
        await expect(page).toHaveTitle(/^Bitcoin3D/);
        const text = await page.locator('body').innerText();
        expect(text, `${lang} ${route}`).not.toMatch(/hacelo/i);
        expect(await page.getByRole('link', { name: 'Bitcoin3D' }).first().isVisible(), `${lang} ${route}`).toBe(true);
      }
    }
  });

  test('el logo es B3 y lleva a la portada; los productos van bajo el título "Productos"', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#/tool/tag');
    const nav = page.getByRole('navigation', { name: 'Herramientas' });
    await expect(nav.locator('.logo')).toHaveText('B3');
    await expect(nav.getByText('Productos', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Productos' }).first()).toBeVisible(); // volver desde la herramienta
    await nav.locator('.logo').click();
    await expect(page.locator('h1')).toHaveText('Diseñá tu producto en 3D');
    // la portada habla del pedido, no de archivos para el laminador
    const home = await page.locator('main').innerText();
    for (const word of ['slicer', 'laminador', 'STL', '3MF', 'AMS']) expect(home, word).not.toContain(word);
    await expect(page.getByText('Lo pedís por WhatsApp.')).toBeAttached();
  });

  test('el menú se abre solo en pantallas de notebook (desde 1100 px), no en las más chicas', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/#/');
    await expect(page.getByRole('navigation', { name: 'Herramientas' }).getByText('Chapita para mascota')).toBeVisible();
    await page.context().clearCookies();
    const small = await page.context().newPage();
    await small.setViewportSize({ width: 1024, height: 720 });
    await small.goto('/#/');
    await expect(small.getByRole('navigation', { name: 'Herramientas' }).getByText('Chapita para mascota')).toBeHidden();
    await small.close();
  });

  test('en el celular cada ícono del menú tiene su nombre corto debajo', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/#/');
    const nav = page.getByRole('navigation', { name: 'Herramientas' });
    for (const label of ['Inicio', 'Llavero', 'Topper', 'QR', 'Sello', 'Lámpara', 'Chapita']) {
      await expect(nav.locator('.nav-short', { hasText: new RegExp(`^${label}$`) }).first(), label).toBeAttached();
    }
    await expect(nav.locator('.nav-short', { hasText: /^Llavero$/ })).toBeVisible();
    // el texto corto es visual: el nombre accesible sigue siendo el completo
    await expect(nav.getByRole('link', { name: 'Llavero con nombre' })).toBeVisible();
    // la barra tiene lugar para ícono + texto y no tapa el visor al hacer scroll
    const bar = await nav.boundingBox();
    expect(bar.height).toBeGreaterThanOrEqual(60);
    await page.goto('/#/tool/tag');
    await expect(page.locator('h1')).toBeVisible({ timeout: 60000 });
    const viewer = await page.locator('.viewer-box').boundingBox();
    expect(viewer.y).toBeGreaterThanOrEqual(bar.height - 2);
  });
});
