import { test, expect } from './fixtures.js';
import { workshop, download } from './helpers.js';

test.describe('lámpara', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await workshop(page);
  });

  test('genera pantalla y base, cambia textura y piezas, y descarga', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/#/tool/lamp');
    await expect(page.locator('h1')).toHaveText('Lámpara');
    const info = page.locator('.info-line');
    await expect(info).toContainText('2 piezas', { timeout: 60000 });
    await expect(page.locator('.messages')).toContainText('lamparitas LED');

    // con dos piezas distintas se informa la medida de cada una
    await expect(info).toContainText('Pantalla 157.7');
    await expect(info).toContainText('Base 116.0 × 116.0 × 40.0');

    // un preset cambia la forma pero no pisa las medidas de tu portalámparas ni los colores
    await page.getByLabel('Diámetro del portalámparas').fill('40');
    await expect(page.getByLabel('Diámetro del portalámparas')).toHaveValue('40');
    const antes = await info.textContent();
    await page.getByLabel('Preset').selectOption('hourglass');
    await expect.poll(async () => info.textContent(), { timeout: 30000 }).not.toBe(antes);
    await expect(page.getByLabel('Diámetro del portalámparas')).toHaveValue('40');
    await expect(page.getByLabel('Alto', { exact: true })).toHaveValue('200');
    // el selector muestra el preset activo, y vuelve a "Personalizado" apenas se toca otra cosa
    await expect(page.getByLabel('Preset')).toHaveValue('hourglass');
    await page.getByLabel('Alto', { exact: true }).fill('150');
    await expect(page.getByLabel('Preset')).toHaveValue('');

    // otra textura: cambian los triángulos y no hay errores
    const before = await info.textContent();
    await page.getByLabel('Textura', { exact: true }).selectOption('facets');
    await expect.poll(async () => info.textContent(), { timeout: 30000 }).not.toBe(before);
    await expect(page.locator('.messages .error')).toHaveCount(0);

    // modo vaso: sigue siendo pantalla + base (la rosca va en la misma pieza) y cambiar de preset no lo desarma
    await page.getByRole('button', { name: 'Modo vaso (espiral)' }).click();
    await expect(info).toContainText('2 piezas', { timeout: 30000 });
    await expect(page.locator('.messages')).toContainText('modo vaso');
    await page.getByLabel('Preset').selectOption('globe');
    await expect(page.getByLabel('Preset')).toHaveValue('globe');
    await expect(info).toContainText('2 piezas', { timeout: 30000 });

    // solo la base: una pieza de Ø116 × 40
    await page.getByRole('button', { name: 'Solo base' }).click();
    // (con una sola pieza ya no dice "N piezas": así no se confunde con el resultado anterior)
    await expect(info).not.toContainText('piezas', { timeout: 30000 });
    await expect(info).toContainText('116.0 × 116.0 × 40.0');
    await expect(page.getByLabel('Diámetro del portalámparas')).toBeVisible();
    const dl = await download(page, 'STL');
    expect(dl.suggestedFilename()).toBe('lampara-base.stl');

    // pantalla y base juntas: el STL baja un ZIP con las dos
    await page.getByRole('button', { name: 'Pantalla y base' }).click();
    await expect(info).toContainText('2 piezas', { timeout: 30000 });
    const zip = await download(page, 'STL');
    expect(zip.suggestedFilename()).toBe('lampara-lote.zip');
    expect(errors).toEqual([]);
  });
});
