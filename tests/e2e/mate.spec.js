import { test, expect } from './fixtures.js';
import { workshop, download } from './helpers.js';

test.describe('mate', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await workshop(page);
  });

  test('genera el mate, cambia forma, textura y borde del interior, y descarga el STL', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/#/tool/mate');
    await expect(page.locator('h1')).toHaveText('Mate');
    const info = page.locator('.info-line');
    await expect(info).toContainText('triángulos', { timeout: 60000 });
    await expect(page.locator('.messages')).toContainText('Medí el tuyo con calibre');

    // un preset cambia la forma pero no pisa las medidas del interior
    const antes = await info.textContent();
    await page.getByLabel('Preset').selectOption('imperial');
    await expect.poll(async () => info.textContent(), { timeout: 30000 }).not.toBe(antes);
    await expect(page.getByLabel('Holgura')).toHaveValue('0,2');

    // otra textura y el borde apoyado encima: sin errores
    const before = await info.textContent();
    await page.getByLabel('Textura', { exact: true }).selectOption('facets');
    await expect.poll(async () => info.textContent(), { timeout: 30000 }).not.toBe(before);
    await page.getByRole('button', { name: 'Apoyado encima' }).click();
    await expect(info).toContainText('triángulos', { timeout: 30000 });
    await expect(page.locator('.messages .error')).toHaveCount(0);

    const dl = await download(page, 'STL');
    expect(dl.suggestedFilename()).toMatch(/^mate.*\.stl$/);
    expect(errors).toEqual([]);
  });
});
