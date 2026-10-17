import { test, expect } from './fixtures.js';

test('créditos: lista software, fuentes y fotos, y las secciones no quedan separadas por huecos enormes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/#/credits');
  await expect(page.locator('h1')).toHaveText('Créditos y licencias');
  await expect(page.getByRole('link', { name: 'three.js' })).toBeVisible();
  await expect(page.locator('.credits-fonts li').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /3D printing time-lapse 2026/ })).toBeVisible();

  // regresión: la página llegó a heredar el espaciado de 100+ px de la home entre cada bloque
  const gap = await page.evaluate(() => {
    const h1 = document.querySelector('.credits h1').getBoundingClientRect();
    const lead = document.querySelector('.credits-lead').getBoundingClientRect();
    return lead.top - h1.bottom;
  });
  expect(gap).toBeLessThan(60);
  expect(errors).toEqual([]);
});
