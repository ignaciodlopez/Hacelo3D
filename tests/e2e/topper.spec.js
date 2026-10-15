import { test, expect } from '@playwright/test';

test.describe('topper de torta', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('genera la pieza, cambia palitos y forma, y descarga el STL', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/#/tool/topper');
    await expect(page.locator('h1')).toHaveText('Topper de torta');
    const info = page.locator('.info-line');
    await expect(info).toContainText('triángulos', { timeout: 30000 });
    const withSticks = await info.textContent();

    // sin palitos la pieza es más baja
    await page.getByRole('button', { name: 'Ninguno' }).click();
    await expect.poll(async () => info.textContent(), { timeout: 15000 }).not.toBe(withSticks);

    // forma circular: se regenera sin errores
    await page.getByRole('button', { name: 'Círculo' }).click();
    await expect(page.locator('.messages .error')).toHaveCount(0);
    await expect(info).toContainText('triángulos', { timeout: 15000 });

    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'STL (un color)' }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^topper.*\.stl$/);
    expect(errors).toEqual([]);
  });
});
