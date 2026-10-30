import { test, expect } from './fixtures.js';
import { workshop, download } from './helpers.js';

test.describe('organizador de escritorio', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await workshop(page);
  });

  test('lapicero, celular y notas: cambia los módulos, usa un ejemplo y descarga', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/#/tool/desk');
    await expect(page.locator('h1')).toHaveText('Organizador de escritorio');
    const info = page.locator('.info-line');
    await expect(info).toContainText('triángulos', { timeout: 30000 });
    await expect(page.locator('.messages .error')).toHaveCount(0);
    const full = await info.textContent();

    // sin el celular la pieza es más angosta: cambia la medida de la línea de info
    await page.getByLabel('Con soporte para el celular').uncheck();
    await expect(info).not.toHaveText(full ?? '', { timeout: 15000 });
    await expect(page.locator('.messages .error')).toHaveCount(0);
    await page.getByLabel('Con soporte para el celular').check();

    // un ejemplo: solo el lapicero
    await page.getByLabel('Ejemplos para empezar').selectOption('pens-only');
    await expect(page.getByLabel('Con soporte para el celular')).not.toBeChecked();
    await expect(info).toContainText('triángulos', { timeout: 15000 });
    await expect(page.locator('.messages .error')).toHaveCount(0);

    // todo apagado: error claro
    await page.getByLabel('Con lapicero').uncheck();
    await expect(page.locator('.messages .error')).toHaveCount(1, { timeout: 15000 });
    await page.getByLabel('Con lapicero').check();
    await expect(page.locator('.messages .error')).toHaveCount(0, { timeout: 15000 });

    const stl = await download(page, 'STL');
    expect(stl.suggestedFilename()).toMatch(/^organizador-escritorio\.stl$/);
    expect(errors).toEqual([]);
  });
});
