import { test, expect } from '@playwright/test';

test.describe('código QR', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('genera el enlace, pasa a Wi-Fi sin guardar la contraseña y descarga el STL', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/#/tool/qr');
    await expect(page.locator('h1')).toHaveText('Código QR');
    const info = page.locator('.info-line');
    await expect(info).toContainText('triángulos', { timeout: 30000 });
    const link = await info.textContent();

    // Wi-Fi: sin nombre de red no hay pieza; al completarlo se genera
    await page.getByRole('button', { name: 'Wi-Fi', exact: true }).click();
    await expect(page.locator('.messages')).toContainText('Completá el contenido');
    await page.getByLabel('Nombre de la red').fill('Casa Nacho');
    await page.getByLabel('Contraseña').fill('clave-super-secreta');
    await expect.poll(async () => info.textContent(), { timeout: 15000 }).not.toBe(link);
    await expect(page.locator('.messages .error')).toHaveCount(0);

    // la contraseña no queda en el almacenamiento del navegador
    await page.waitForTimeout(400);
    const stored = await page.evaluate(() => localStorage.getItem('b3d.tool.qr') ?? '');
    expect(stored).toContain('Casa Nacho');
    expect(stored).not.toContain('clave-super-secreta');

    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'STL (un color)' }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^qr-wifi-casa-nacho\.stl$/);
    expect(errors).toEqual([]);
  });
  test('imanes: aparecen los controles, se regenera sin errores y hay vista inferior', async ({ page }) => {
    await page.goto('/#/tool/qr');
    const info = page.locator('.info-line');
    await expect(info).toContainText('triángulos', { timeout: 30000 });
    const before = await info.textContent();
    // la sección de imanes viene plegada: se abre y se elige 2
    await expect(page.getByLabel('Diámetro del imán')).toBeHidden();
    await page.locator('summary', { hasText: 'Imanes' }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await expect(page.getByLabel('Diámetro del imán')).toBeVisible();
    // el hueco engrosa la base (2,4 → 3 mm): cambia la medida y avisa
    await expect.poll(async () => info.textContent(), { timeout: 15000 }).not.toBe(before);
    await expect(page.locator('.messages .error')).toHaveCount(0);
    await expect(page.locator('.messages')).toContainText('la base se subió');
    await page.getByRole('button', { name: 'Vista inferior (cara de atrás)' }).click();
  });
});
