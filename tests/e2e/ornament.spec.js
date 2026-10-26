import { test, expect } from './fixtures.js';
import { workshop, download } from './helpers.js';

test.describe('adorno navideño', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await workshop(page);
  });

  test('genera la esfera, cambia los adornos y el nombre, y descarga el STL', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/#/tool/ornament');
    await expect(page.locator('h1')).toHaveText('Adorno navideño');
    const info = page.locator('.info-line');
    await expect(info).toContainText('triángulos', { timeout: 30000 });
    const withFlakes = await info.textContent();

    // sin adornos la pieza tiene menos triángulos
    await page.getByRole('combobox', { name: 'Tipo de adorno' }).selectOption('none');
    await expect.poll(async () => info.textContent(), { timeout: 15000 }).not.toBe(withFlakes);

    // otro nombre: se regenera sin errores ni avisos de partes sueltas
    const name = page.getByRole('textbox', { name: 'Nombre', exact: true }).first();
    await name.fill('Sofía');
    await expect(info).toContainText('triángulos', { timeout: 15000 });
    await expect(page.locator('.messages .error')).toHaveCount(0);

    const dl = await download(page, 'STL');
    expect(dl.suggestedFilename()).toMatch(/^adorno.*\.stl$/);
    expect(errors).toEqual([]);
  });
});
