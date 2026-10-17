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

  test('el nombre Bitcoin3D va grande arriba, con su leyenda, y lleva a la portada; los productos van bajo el título "Productos"', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#/tool/tag');
    const nav = page.getByRole('navigation', { name: 'Herramientas' });
    await expect(nav.locator('.logo .wordmark')).toHaveText('Bitcoin3D');
    await expect(nav.locator('.logo .tagline')).toBeVisible();
    await expect(nav.locator('.logo-b3')).toBeHidden();
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

test.describe('colores', () => {
  test('toda herramienta avisa que los colores están sujetos a disponibilidad', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    for (const id of ['keychain', 'topper', 'qr', 'stamp', 'lamp', 'tag']) {
      await page.goto(`/#/tool/${id}`);
      await expect(page.locator('h1')).toBeVisible({ timeout: 60000 });
      await expect(page.getByText('Los colores están sujetos a disponibilidad.'), id).toBeAttached();
    }
  });
});

test.describe('textos para el cliente', () => {
  test('la portada no ofrece descargas ni habla de imprimir: eso es del taller', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    for (const lang of ['es', 'en']) {
      await page.addInitScript((l) => localStorage.setItem('b3d.lang', l), lang);
      await page.goto('/#/');
      await expect(page.locator('h1')).toBeVisible({ timeout: 60000 });
      const text = await page.locator('main').innerText();
      expect(text, lang).not.toMatch(/descarg|download|imprimir|print-ready|ready to print/i);
    }
  });
});

test.describe('pie de la portada', () => {
  test('bitcoin3d.com.ar del pie es un enlace a la tienda', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/#/');
    const link = page.locator('.home-foot').getByRole('link', { name: 'www.Bitcoin3D.com.ar', exact: true });
    await expect(link).toHaveAttribute('href', 'https://www.bitcoin3d.com.ar/');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(page.locator('.home-foot .foot-line span').first()).toContainText('Impresión 3D a medida ·');
  });
});

test.describe('créditos', () => {
  test('el pie de la portada no repite las fotos: están en Créditos y licencias', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/#/');
    await expect(page.locator('.home-foot')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.home-foot')).not.toContainText('Svitlana');
    await page.locator('.home-foot').getByRole('link', { name: 'Créditos y licencias' }).click();
    await expect(page.getByText('Svitlana Lozova').first()).toBeVisible();
  });
});
