import { test, expect } from './fixtures.js';
import { workshop, download } from './helpers.js';

test.describe('sello', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await workshop(page);
  });

  test('genera el sello, cambia mango y forma, y descarga el STL', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/#/tool/stamp');
    await expect(page.locator('h1')).toHaveText('Sello');
    const info = page.locator('.info-line');
    await expect(info).toContainText('triángulos', { timeout: 30000 });
    const withHandle = await info.textContent();

    // sin mango la pieza es mucho más baja
    await page.getByRole('button', { name: 'Sin mango' }).click();
    await expect.poll(async () => info.textContent(), { timeout: 15000 }).not.toBe(withHandle);

    // perilla en una placa ancha y baja: avisa; con círculo, no hay errores
    await page.getByRole('button', { name: 'Círculo' }).click();
    await page.getByRole('button', { name: 'Perilla' }).click();
    await expect(page.locator('.messages .error')).toHaveCount(0);
    await expect(info).toContainText('triángulos', { timeout: 15000 });

    // solo ícono: se puede vaciar el texto
    await page.getByLabel('Texto del sello').fill('');
    await expect(page.locator('.messages')).toContainText('Escribí un texto o elegí un ícono');

    await page.getByLabel('Texto del sello').fill('Hola');
    await expect(info).toContainText('triángulos', { timeout: 15000 });
    const dl = await download(page, 'STL');
    expect(dl.suggestedFilename()).toMatch(/^sello-hola\.stl$/);
    expect(errors).toEqual([]);
  });
});
