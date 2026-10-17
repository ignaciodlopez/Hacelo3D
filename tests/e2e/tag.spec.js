import { test, expect } from '@playwright/test';

test.describe('chapita para mascota', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('genera el huesito, cambia de modelo y sujeción, usa una silueta de ícono y descarga', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/#/tool/tag');
    await expect(page.locator('h1')).toHaveText('Chapita para mascota');
    const info = page.locator('.info-line');
    await expect(info).toContainText('triángulos', { timeout: 60000 });
    await expect(info).toContainText('55.0 ×');
    // por defecto placa celeste y letras blancas: UN solo cambio de color (sin AMS), al terminar la placa
    await expect(page.locator('.color-info')).toContainText('capa 16');
    await expect(page.locator('.chip-color').first()).toContainText('Letras');

    // el tamaño del nombre se puede cambiar: con letras más altas, la pieza cambia
    const sized = await info.textContent();
    await page.getByLabel('Tamaño del nombre').fill('6');
    await expect.poll(async () => info.textContent(), { timeout: 30000 }).not.toBe(sized);

    // un preset cambia la forma, conserva el nombre y el selector muestra cuál es
    const before = await info.textContent();
    await page.getByLabel('Preset').selectOption('heart');
    await expect.poll(async () => info.textContent(), { timeout: 30000 }).not.toBe(before);
    await expect(page.getByLabel('Preset')).toHaveValue('heart');
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Boster');

    // pasante: ranuras para el collar
    await page.getByLabel('Preset').selectOption('collar');
    await expect(info).toContainText('50.0 × 30.0', { timeout: 30000 });
    await expect(page.getByLabel('Ancho del collar')).toBeVisible();
    await expect(page.locator('.messages .error')).toHaveCount(0);

    // un collar más ancho que la chapita: avisa en vez de romper
    await page.getByLabel('Ancho del collar').fill('45');
    await expect(page.locator('.messages')).toContainText('no entran en esta forma', { timeout: 30000 });

    // tamaño fijo con un nombre larguísimo: se achica y avisa
    await page.getByRole('button', { name: 'Argolla', exact: true }).click();
    await page.getByRole('button', { name: 'Tamaño fijo' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Maximiliano Alejandro');
    await expect(page.locator('.messages')).toContainText('se achicaron', { timeout: 30000 });
    await page.getByLabel('Nombre', { exact: true }).fill('Luna');

    // silueta de un ícono: sin ícono pide elegir uno; con uno genera la pieza
    await page.getByLabel('Modelo', { exact: true }).selectOption('icon');
    await expect(page.locator('.messages')).toContainText('Elegí un ícono', { timeout: 30000 });
    await page.getByRole('button', { name: /^Ícono:/ }).click();
    await page.getByRole('option', { name: 'Mariposa' }).first().click();
    await expect(page.locator('.messages .error')).toHaveCount(0, { timeout: 30000 });
    await expect(info).toContainText('triángulos');
    // el selector solo ofrece íconos que funcionan como silueta (el sol se parte en piezas sueltas)
    await page.getByRole('button', { name: /^Ícono:/ }).click();
    await expect(page.locator('.icon-grid').getByRole('option', { name: 'Sol', exact: true })).toHaveCount(0);
    await expect(page.locator('.icon-grid').getByRole('option', { name: 'Huella', exact: true })).toHaveCount(1);
    await page.keyboard.press('Escape');

    const [stl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'STL (un color)' }).click()]);
    expect(stl.suggestedFilename()).toBe('chapita-luna.stl');
    const [zip] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'ZIP por color' }).click()]);
    expect(zip.suggestedFilename()).toBe('chapita-luna_colores.zip');
    expect(errors).toEqual([]);
  });

  test('copiar enlace: es corto y al abrirlo se restaura todo', async ({ page, browser }) => {
    // el portapapeles real no se puede leer igual en todos los navegadores: se captura lo que se copia
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copied = t; } }, configurable: true });
    });
    await page.goto('/#/tool/tag');
    await expect(page.locator('.info-line')).toContainText('triángulos', { timeout: 60000 });
    await page.getByLabel('Nombre', { exact: true }).fill('Luna 💛');
    await page.getByLabel('Preset').selectOption('heart');
    await expect(page.getByLabel('Preset')).toHaveValue('heart');
    await page.getByRole('button', { name: 'Copiar enlace' }).click();
    const url = await page.evaluate(() => window.__copied);
    expect(url).toContain('#/tool/tag?p=~');
    expect(url.split('?p=')[1].length).toBeLessThan(160); // antes: ~900 caracteres

    const other = await browser.newPage();
    await other.goto(url);
    await expect(other.locator('.info-line')).toContainText('triángulos', { timeout: 60000 });
    await expect(other.getByLabel('Nombre', { exact: true })).toHaveValue('Luna 💛');
    await expect(other.getByLabel('Preset')).toHaveValue('heart');
    await other.close();
  });
});
