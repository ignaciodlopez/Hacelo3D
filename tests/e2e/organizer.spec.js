import { test, expect } from './fixtures.js';
import { workshop, download } from './helpers.js';

test.describe('organizadores de taller', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await workshop(page);
  });

  test('estuche porta mechas con el logo de la marca, soporte de mechas y porta puntas, y descarga', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/#/tool/organizer');
    await expect(page.locator('h1')).toHaveText('Para tus herramientas');
    const info = page.locator('.info-line');
    await expect(info).toContainText('triángulos', { timeout: 30000 });
    // estuche cerrado: cuerpo, logo (SVG real de public/logos/) y trabas
    await expect(page.locator('.color-chips .chip-color')).toHaveCount(3);
    await expect(info).toContainText('4 piezas');
    await expect(info).toContainText('220.0 × 70.0 × 80.0');
    await expect(page.locator('.messages .error')).toHaveCount(0);

    // otra marca: aplica sus colores (Makita: trabas blancas)
    await page.getByRole('button', { name: /^Marca:/ }).click();
    await page.getByRole('option', { name: 'Makita' }).click();
    await expect(page.getByRole('button', { name: /^Marca: Makita/ })).toBeVisible();
    await expect(page.locator('.color-chips .dot').first()).toHaveCSS('background-color', 'rgb(0, 144, 158)');

    // para imprimir: las mismas cuatro piezas sobre la cama
    await page.getByRole('button', { name: 'Para imprimir' }).click();
    await expect(info).toContainText('4 piezas');
    const zip = await download(page, 'ZIP');
    expect(zip.suggestedFilename()).toMatch(/^organizador-lote_colores\.zip$/);

    // soporte de mechas
    await page.getByRole('combobox', { name: 'Tipo' }).selectOption('drills');
    await page.getByLabel('Medidas (mm)').fill('3 4 5 6');
    await expect(info).not.toContainText('piezas', { timeout: 15000 });
    await expect(info).toContainText('triángulos');
    await expect(page.locator('.messages .error')).toHaveCount(0);

    // porta puntas, sin logo: una sola pieza
    await page.getByRole('combobox', { name: 'Tipo' }).selectOption('bits');
    await page.getByRole('button', { name: /^Marca:/ }).click();
    await page.getByRole('option', { name: 'Sin logo' }).click();
    await expect(page.locator('.color-chips .chip-color')).toHaveCount(0);
    const stl = await download(page, 'STL');
    expect(stl.suggestedFilename()).toMatch(/^organizador-porta-puntas\.stl$/);
    expect(errors).toEqual([]);
  });
});
