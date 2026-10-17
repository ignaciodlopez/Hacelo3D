import { test, expect } from './fixtures.js';

// Dos públicos en la misma pantalla: el cliente ve solo "Pedir por WhatsApp"; quien fabrica activa el "modo taller"
// y suma el menú de archivos, los datos técnicos y el perfil de la impresora.
test.use({ viewport: { width: 1440, height: 900 } });

const NAV = (page) => page.getByRole('navigation', { name: 'Herramientas' });

async function open(page, tool = 'tag') {
  await page.route('**/config.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ shopName: 'Mi Taller', whatsapp: '5493416686947' }) }));
  await page.goto(`/#/tool/${tool}`);
  await expect(page.locator('.info-line')).toContainText('Medida', { timeout: 60000 });
}

test.describe('cliente y taller', () => {
  test('por defecto (cliente): solo el botón de pedir, sin jerga ni datos técnicos', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('button', { name: 'Pedir por WhatsApp' })).toBeVisible();
    await expect(page.getByText('Se abre WhatsApp con tu diseño')).toBeVisible();
    // lleva el logo de WhatsApp (ícono relleno que hereda el color del botón)
    await expect(page.getByRole('button', { name: 'Pedir por WhatsApp' }).locator('svg[fill="currentColor"] path')).toHaveCount(1);
    // nada de archivos, triángulos, gramos ni instrucciones de cambio de color
    await expect(page.getByRole('button', { name: /^Archivos/ })).toBeHidden();
    await expect(page.locator('.info-line')).not.toContainText('triángulos');
    await expect(page.locator('.info-line')).not.toContainText(' g');
    await expect(page.locator('.color-info')).toBeEmpty();
    // el perfil de la impresora no aparece, pero sí el interruptor del modo taller
    await expect(NAV(page).getByRole('button', { name: /^Impresora/ })).toHaveCount(0);
    await expect(NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' })).toBeVisible();
    // lo que sí le sirve: la medida
    await expect(page.locator('.info-line')).toContainText('55.0 × 31.0 × 4.0 mm');
  });

  test('modo taller: aparece el menú de archivos, los datos técnicos y la impresora; se recuerda al recargar', async ({ page }) => {
    await open(page);
    await NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' }).click();
    await expect(NAV(page).getByRole('button', { name: 'Modo taller: Activado' })).toBeVisible();
    await expect(NAV(page).getByRole('button', { name: /^Impresora/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Archivos/ })).toBeVisible();
    await expect(page.locator('.info-line')).toContainText('triángulos');
    await expect(page.locator('.color-info')).toContainText('capa 16');
    // el botón de pedir sigue estando: un taller también vende
    await expect(page.getByRole('button', { name: 'Pedir por WhatsApp' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /^Archivos/ })).toBeVisible({ timeout: 60000 });
    await NAV(page).getByRole('button', { name: 'Modo taller: Activado' }).click();
    await expect(page.getByRole('button', { name: /^Archivos/ })).toBeHidden();
  });

  test('el menú de archivos: se abre, se navega con el teclado, se cierra y baja el archivo', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('b3d.workshop', '1'));
    await open(page);
    const files = page.getByRole('button', { name: /^Archivos/ });
    await expect(files).toHaveAttribute('aria-expanded', 'false');
    await files.click();
    await expect(files).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('menu', { name: 'Archivos' });
    await expect(menu.getByRole('menuitem')).toHaveCount(3); // la chapita por defecto tiene dos colores
    await expect(menu.getByRole('menuitem').first()).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem').nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(files).toBeFocused();

    // clic afuera también lo cierra
    await files.click();
    await expect(menu).toBeVisible();
    await page.locator('h1').click();
    await expect(menu).toBeHidden();

    await files.click();
    const pending = page.waitForEvent('download');
    await menu.getByRole('menuitem', { name: /STL/ }).click();
    expect((await pending).suggestedFilename()).toBe('chapita-boster.stl');
    await expect(menu).toBeHidden();
  });

  test('con un solo color no se ofrecen ZIP ni 3MF (no aportan nada)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('b3d.workshop', '1'));
    await open(page, 'stamp'); // el sello es de un solo color
    await page.getByRole('button', { name: /^Archivos/ }).click();
    const menu = page.getByRole('menu', { name: 'Archivos' });
    await expect(menu.getByRole('menuitem', { name: /STL/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /ZIP/ })).toBeHidden();
    await expect(menu.getByRole('menuitem', { name: /3MF/ })).toBeHidden();
  });

  test('al enviar el pedido avisa que se abrió WhatsApp', async ({ page }) => {
    await page.addInitScript(() => {
      window.open = () => ({});
    });
    await open(page);
    await page.getByRole('button', { name: 'Pedir por WhatsApp' }).click();
    await page.getByRole('button', { name: 'Abrir WhatsApp' }).click();
    await expect(page.getByText('Se abrió WhatsApp con tu pedido')).toBeVisible();
  });

  test('sin botón de pedido la herramienta queda en modo taller', async ({ page }) => {
    await page.route('**/config.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ showOrderButton: false }) }));
    await page.goto('/#/tool/tag');
    await expect(page.locator('.info-line')).toContainText('triángulos', { timeout: 60000 });
    await expect(page.getByRole('button', { name: /^Archivos/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pedir por WhatsApp' })).toBeHidden();
  });
});

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('el botón de pedir y "Archivos" caben en una sola fila, y el menú no se sale de la pantalla', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('b3d.workshop', '1'));
    await open(page);
    const order = await page.getByRole('button', { name: 'Pedir por WhatsApp' }).boundingBox();
    const files = page.getByRole('button', { name: /^Archivos/ });
    const fb = await files.boundingBox();
    expect(Math.abs(order.y - fb.y)).toBeLessThan(6); // misma fila
    expect(fb.x + fb.width).toBeLessThanOrEqual(390);
    await files.click();
    const mb = await page.getByRole('menu', { name: 'Archivos' }).boundingBox();
    expect(mb.x).toBeGreaterThanOrEqual(0);
    expect(mb.x + mb.width).toBeLessThanOrEqual(390);
    expect(mb.y).toBeGreaterThanOrEqual(0);
  });
});
