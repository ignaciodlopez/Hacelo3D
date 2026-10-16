import { test, expect } from '@playwright/test';

test.describe('home', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('el escenario muestra la pieza de cada herramienta y el nombre abre el llavero', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/#/');
    await expect(page.locator('h1')).toHaveText('Herramientas para impresión 3D');
    const bar = page.locator('.stage-bar');
    await expect(bar).toContainText('Llavero con nombre');
    await expect(bar).toContainText('mm', { timeout: 30000 });

    // pasar por otra herramienta cambia la pieza y su medida
    await page.locator('.tool-row', { hasText: 'Topper de torta' }).hover();
    await expect(bar).toContainText('Topper de torta');
    await expect(bar).toContainText('156', { timeout: 30000 });

    // escribir un nombre regenera el llavero y "Hacelo en 3D" lo abre con ese texto
    await page.getByLabel('Probá con un nombre').fill('Mateo');
    await expect(bar).toContainText('Llavero con nombre', { timeout: 15000 });
    await page.getByRole('link', { name: 'Hacelo en 3D' }).click();
    await expect(page.locator('h1')).toHaveText('Llavero con nombre');
    await expect(page.getByLabel('Texto del llavero')).toHaveValue('Mateo');
    expect(errors).toEqual([]);
  });
});
