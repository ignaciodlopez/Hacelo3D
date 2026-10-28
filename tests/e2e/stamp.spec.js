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
    await page.getByRole('button', { name: 'Clásico', exact: true }).click();
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

  test('selector visual: modelos, medidas, orientación y uso en celular', async ({ page }) => {
    await page.goto('/#/tool/stamp');
    const models = page.getByRole('group', { name: 'Modelo del mango' });
    await expect(models.getByRole('button')).toHaveCount(6);
    await expect(models.locator('svg')).toHaveCount(6);
    const info = page.locator('.info-line');
    await expect(info).toContainText('triángulos', { timeout: 30000 });
    for (const name of ['Clásico', 'Hongo', 'Ergonómico', 'Barra', 'Compacto']) {
      const previous = await info.textContent();
      await models.getByRole('button', { name, exact: true }).click();
      await expect(models.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => info.textContent()).not.toBe(previous);
      await expect(page.locator('.messages .error')).toHaveCount(0);
      if (['Barra', 'Compacto', 'Ergonómico'].includes(name)) await expect(page.getByLabel('Largo del mango')).toBeVisible();
      else await expect(page.getByLabel('Largo del mango')).toBeHidden();
    }
    await page.getByRole('button', { name: 'Para imprimir', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Para imprimir', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const dl = await download(page, 'STL');
    expect(dl.suggestedFilename()).toMatch(/\.stl$/);
    await page.setViewportSize({ width: 390, height: 844 });
    await models.scrollIntoViewIfNeeded();
    const box = await models.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await models.getByRole('button', { name: 'Sin mango', exact: true }).click();
    await expect(page.getByLabel('Alto del agarre')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Mango arriba', exact: true })).toBeHidden();
  });
});
