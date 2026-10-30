import { test, expect } from './fixtures.js';
import { workshop, download } from './helpers.js';

test.describe('llavero patente', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await workshop(page);
  });

  test('genera la Mercosur, cambia a la vieja con su propia patente y descarga', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/#/tool/plate');
    await expect(page.locator('h1')).toHaveText('Llavero patente');
    const info = page.locator('.info-line');
    await expect(info).toContainText('triángulos', { timeout: 60000 });
    await expect(page.locator('.messages')).toContainText('Alto de los caracteres');
    await expect(page.locator('.chip-color')).toHaveCount(4);
    // por defecto va por capas: se imprime sin AMS, cambiando el filamento en tres capas
    await expect(page.locator('.color-info li')).toHaveCount(3);
    await expect(page.locator('.foot-info')).not.toContainText('multimaterial');
    await page.getByRole('button', { name: 'Misma altura (AMS)' }).click();
    await expect(page.locator('.foot-info')).toContainText('multimaterial', { timeout: 30000 });
    await page.getByRole('button', { name: 'Por capas (sin AMS)' }).click();

    // la vieja tiene su propia patente y sus colores: placa, recuadro y leyenda
    await page.getByRole('button', { name: 'Vieja (1994)' }).click();
    await expect(page.getByRole('textbox', { name: 'Patente', exact: true })).toHaveValue('ABC 123');
    await expect(page.locator('.chip-color')).toHaveCount(3, { timeout: 30000 });
    const before = await info.textContent();
    await page.getByRole('textbox', { name: 'Patente', exact: true }).fill('XYZ 789');
    await expect.poll(async () => info.textContent(), { timeout: 30000 }).not.toBe(before);

    // un preset cambia la sujeción y conserva la patente
    await page.getByLabel('Ejemplos para empezar').selectOption('old-hole');
    await expect(page.getByLabel('Ejemplos para empezar')).toHaveValue('old-hole');
    await expect(page.getByRole('textbox', { name: 'Patente', exact: true })).toHaveValue('XYZ 789');
    await expect(page.locator('.messages .error')).toHaveCount(0);

    // patente vacía: avisa sin romper
    await page.getByRole('textbox', { name: 'Patente', exact: true }).fill('');
    await expect(page.locator('.messages')).toContainText('Escribí la patente', { timeout: 30000 });
    await page.getByRole('textbox', { name: 'Patente', exact: true }).fill('XYZ 789');
    await expect(page.locator('.messages .error')).toHaveCount(0, { timeout: 30000 });

    const stl = await download(page, 'STL');
    expect(stl.suggestedFilename()).toMatch(/^llavero-patente.*\.stl$/);
    expect(errors).toEqual([]);
  });
});
