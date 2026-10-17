import { test, expect } from './fixtures.js';

test.describe('menú lateral', () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test('abierto muestra nombres y estado; se contrae a íconos y lo recuerda', async ({ page }) => {
    // se limpia una sola vez: el script de inicio también corre al recargar y borraría lo que se quiere comprobar
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__fresh')) return;
      localStorage.clear();
      localStorage.setItem('b3d.workshop', '1'); // el perfil de impresora es del modo taller
      sessionStorage.setItem('__fresh', '1');
    });
    await page.goto('/#/tool/qr');
    const nav = page.getByRole('navigation', { name: 'Herramientas' });

    // abierto por defecto en pantalla ancha: cada herramienta tiene su nombre a la vista
    await expect(nav.getByText('Llavero con nombre')).toBeVisible();
    await expect(nav.getByText('Código QR')).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Código QR' })).toHaveAttribute('aria-current', 'page');
    // el perfil de impresora y el idioma muestran su valor actual
    await expect(nav.getByRole('button', { name: /^Impresora: / })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Modo taller: Activado' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Idioma: Español' })).toBeVisible();
    const open = (await nav.boundingBox()).width;

    // contraer: queda solo la columna de íconos (con nombre accesible) y la elección se recuerda al recargar
    await nav.getByRole('button', { name: 'Contraer menú' }).click();
    await expect.poll(async () => (await nav.boundingBox()).width).toBeLessThan(open / 2);
    await expect(nav.getByText('Llavero con nombre')).toBeHidden();
    await expect(nav.getByRole('link', { name: 'Llavero con nombre' })).toBeVisible();
    await page.reload();
    await expect(nav.getByRole('button', { name: 'Expandir menú' })).toBeVisible();
  });

  test('en celular es una barra superior de íconos', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/#/tool/qr');
    const nav = page.getByRole('navigation', { name: 'Herramientas' });
    const box = await nav.boundingBox();
    expect(box.width).toBeGreaterThan(380);
    expect(box.height).toBeLessThan(70);
    await expect(nav.getByRole('button', { name: 'Contraer menú' })).toBeHidden();
  });
});
