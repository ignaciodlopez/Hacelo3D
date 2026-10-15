import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';

test.describe('llavero', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('abre la herramienta, genera la pieza y descarga STL / 3MF / ZIP', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/#/tool/keychain');
    await expect(page.locator('h1')).toHaveText('Llavero con nombre');
    await expect(page.locator('.info-line')).toContainText('triángulos', { timeout: 30000 });
    await expect(page.locator('.info-line')).toContainText('Medida: 6');

    // cambiar el texto regenera la pieza
    const before = await page.locator('.info-line').textContent();
    await page.getByLabel('Texto del llavero').fill('Mateo');
    await expect.poll(async () => page.locator('.info-line').textContent(), { timeout: 15000 }).not.toBe(before);

    for (const [btn, ext] of [['STL (un color)', '.stl'], ['ZIP por color', '.zip'], ['3MF multicolor', '.3mf']]) {
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: btn }).click()]);
      expect(dl.suggestedFilename()).toBe(`llavero-mateo${ext === '.zip' ? '_colores.zip' : ext}`);
      const path = await dl.path();
      const bytes = readFileSync(path);
      expect(bytes.length).toBeGreaterThan(1000);
      if (ext === '.zip' || ext === '.3mf') expect(Object.keys(unzipSync(new Uint8Array(bytes))).length).toBeGreaterThan(1);
    }
    expect(errors.filter((e) => !/WebGL|GPU|swiftshader/i.test(e))).toEqual([]);
  });

  test('cambiar de ruta y volver no deja errores y se puede reabrir', async ({ page }) => {
    await page.goto('/#/tool/keychain');
    await expect(page.locator('.info-line')).toContainText('triángulos', { timeout: 30000 });
    for (let i = 0; i < 5; i++) {
      await page.goto('/#/');
      await expect(page.locator('h1')).toHaveText('Herramientas para impresión 3D');
      await page.goto('/#/tool/keychain');
      await expect(page.locator('.info-line')).toContainText('triángulos', { timeout: 30000 });
    }
  });
});
