import { test, expect } from './fixtures.js';

/** Sirve un config.json de prueba y captura la URL que se abriría en WhatsApp (sin abrir nada de verdad). */
async function setup(page, config) {
  await page.addInitScript(() => {
    localStorage.clear();
    window.open = (url) => {
      window.__wa = url;
      return {};
    };
  });
  await page.route('**/config.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(config) }));
}

test.describe('pedir por WhatsApp', () => {
  test('arma el mensaje con el diseño, la cantidad y el enlace, y abre WhatsApp con el número de la tienda', async ({ page }) => {
    await setup(page, { shopName: 'Mi Taller', whatsapp: '+54 9 341 668-6947' });
    await page.goto('/#/tool/tag');
    await expect(page.locator('.info-line')).toContainText('Medida', { timeout: 60000 });
    await page.getByLabel('Nombre', { exact: true }).fill('Luna');
    await page.getByLabel('Preset').selectOption('heart');
    await expect(page.getByLabel('Preset')).toHaveValue('heart');

    await page.getByRole('button', { name: 'Pedir por WhatsApp' }).click();
    const dialog = page.getByRole('dialog', { name: 'Pedir por WhatsApp' });
    await expect(dialog).toBeVisible();
    const preview = dialog.getByLabel('Mensaje que se va a enviar');
    await expect(preview).toHaveValue(/¡Hola, Mi Taller!/);
    await expect(preview).toHaveValue(/Quiero pedir:\* Chapita para mascota/);
    await expect(preview).toHaveValue(/- Nombre: Luna/);
    await expect(preview).toHaveValue(/- Modelo: Corazón/);
    await expect(preview).toHaveValue(/- Colores: celeste con letras blanco/);
    await expect(preview).toHaveValue(/#\/tool\/tag\?p=~/);
    await expect(dialog.getByText('Todavía no hay un número')).toHaveCount(0);

    // la vista previa sigue lo que escribe el cliente
    await dialog.getByLabel('Tu nombre (opcional)').fill('Ana');
    await dialog.getByLabel('Cantidad').fill('3');
    await dialog.getByLabel('Comentarios (opcional)').fill('Lo necesito para el viernes');
    await expect(preview).toHaveValue(/Cantidad: 3/);
    await expect(preview).toHaveValue(/Comentarios: Lo necesito para el viernes/);
    await expect(preview).toHaveValue(/¡Gracias! Soy Ana\./);

    await dialog.getByRole('button', { name: 'Abrir WhatsApp' }).click();
    await expect(dialog).toHaveCount(0);
    const url = await page.evaluate(() => window.__wa);
    expect(url.startsWith('https://wa.me/5493416686947?text=')).toBe(true);
    const text = decodeURIComponent(url.split('?text=')[1]);
    expect(text).toContain('Cantidad: 3');
    expect(text).toContain('Soy Ana.');
    // el enlace del mensaje reproduce el diseño: abrirlo restaura el nombre y el modelo
    const link = text.match(/https?:\/\/\S+/)[0];
    const other = await page.context().newPage();
    await other.goto(link);
    await expect(other.getByLabel('Nombre', { exact: true })).toHaveValue('Luna', { timeout: 60000 });
    await expect(other.getByLabel('Preset')).toHaveValue('heart');
    await other.close();

    // recuerda el nombre del cliente para la próxima
    await page.getByRole('button', { name: 'Pedir por WhatsApp' }).click();
    await expect(page.getByLabel('Tu nombre (opcional)')).toHaveValue('Ana');
  });

  test('sin número configurado avisa y deja elegir el contacto', async ({ page }) => {
    await setup(page, { whatsapp: '' });
    await page.goto('/#/tool/keychain');
    await expect(page.locator('.info-line')).toContainText('Medida', { timeout: 60000 });
    await page.getByRole('button', { name: 'Pedir por WhatsApp' }).click();
    const dialog = page.getByRole('dialog', { name: 'Pedir por WhatsApp' });
    await expect(dialog.getByText('Todavía no hay un número')).toBeVisible();
    await dialog.getByRole('button', { name: 'Abrir WhatsApp' }).click();
    const url = await page.evaluate(() => window.__wa);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
  });

  test('un número de 10 dígitos se toma como celular argentino', async ({ page }) => {
    await setup(page, { whatsapp: '3416686947' });
    await page.goto('/#/tool/stamp');
    await expect(page.locator('.info-line')).toContainText('Medida', { timeout: 60000 });
    await page.getByRole('button', { name: 'Pedir por WhatsApp' }).click();
    await page.getByRole('button', { name: 'Abrir WhatsApp' }).click();
    expect((await page.evaluate(() => window.__wa)).startsWith('https://wa.me/5493416686947?text=')).toBe(true);
  });

  test('showOrderButton: false oculta el botón', async ({ page }) => {
    await setup(page, { whatsapp: '5493416686947', showOrderButton: false });
    await page.goto('/#/tool/tag');
    await expect(page.locator('.info-line')).toContainText('Medida', { timeout: 60000 });
    await expect(page.getByRole('button', { name: /^Archivos/ })).toBeVisible(); // sin botón de pedido, queda en modo taller
    await expect(page.getByRole('button', { name: 'Pedir por WhatsApp' })).toBeHidden();
  });
});
