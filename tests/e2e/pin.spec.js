import { test, expect } from './fixtures.js';
import { createPinConfig } from '../../src/app/workshopPin.js';

// Modo taller protegido con PIN. Se sirve un config.json con el verificador de un PIN de prueba (pocas vueltas: rápido).
test.use({ viewport: { width: 1440, height: 900 } });

const PIN = '482915';
let pinCfg;
test.beforeAll(async () => {
  pinCfg = await createPinConfig(PIN, { iterations: 1000 });
});

const NAV = (page) => page.getByRole('navigation', { name: 'Herramientas' });
const DIALOG = (page) => page.getByRole('dialog', { name: 'Ingresá el PIN' });
const PIN_FIELD = (dialog) => dialog.getByLabel('PIN', { exact: true });

async function open(page, config) {
  await page.route('**/config.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(config ?? { whatsapp: '5493416686947', workshop: pinCfg }) }));
  await page.goto('/#/tool/tag');
  await expect(page.locator('.info-line')).toContainText('Medida', { timeout: 60000 });
}
const files = (page) => page.getByRole('button', { name: /^Archivos/ });
const storage = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);

test.describe('modo taller con PIN', () => {
  test('pide el PIN, rechaza uno incorrecto, recuerda el acceso y se puede volver a bloquear', async ({ page }) => {
    await open(page);
    await expect(files(page)).toBeHidden();
    await NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' }).click();
    const dialog = DIALOG(page);
    await expect(dialog).toBeVisible();

    // PIN incorrecto: avisa, vacía el campo y sigue en vista de cliente
    await PIN_FIELD(dialog).fill('111111');
    await dialog.getByRole('button', { name: 'Entrar' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('PIN incorrecto.');
    await expect(PIN_FIELD(dialog)).toHaveValue('');
    await expect(files(page)).toBeHidden();
    expect(await storage(page, 'b3d.workshop.token')).toBeNull();

    // PIN correcto
    await PIN_FIELD(dialog).fill(PIN);
    await dialog.getByRole('button', { name: 'Entrar' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(NAV(page).getByRole('button', { name: 'Modo taller: Activado' })).toBeVisible();
    await expect(files(page)).toBeVisible();
    // lo guardado es un token (hash), nunca el PIN
    const token = await storage(page, 'b3d.workshop.token');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(await page.evaluate(() => ({ ...localStorage })))).not.toContain(PIN);

    // recargar: sigue activo (el token se verifica contra el PIN publicado)
    await page.reload();
    await expect(files(page)).toBeVisible({ timeout: 60000 });

    // apagar olvida el token: volver a entrar pide el PIN otra vez
    await NAV(page).getByRole('button', { name: 'Modo taller: Activado' }).click();
    await expect(files(page)).toBeHidden();
    expect(await storage(page, 'b3d.workshop.token')).toBeNull();
    await NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' }).click();
    await expect(DIALOG(page)).toBeVisible();
  });

  test('no se puede saltear editando el almacenamiento del navegador', async ({ page }) => {
    await open(page);
    // los intentos más obvios: la bandera del modo sin PIN, el valor público de la configuración, ceros, "true"…
    for (const forged of ['1', 'true', pinCfg.check, pinCfg.salt, '0'.repeat(64), 'f'.repeat(64)]) {
      await page.evaluate(
        ([flag, token]) => {
          localStorage.setItem('b3d.workshop', flag);
          localStorage.setItem('b3d.workshop.token', token);
        },
        ['1', forged],
      );
      await page.reload();
      await expect(page.locator('.info-line')).toContainText('Medida', { timeout: 60000 });
      await expect(NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' })).toBeVisible();
      await expect(files(page)).toBeHidden();
      await expect(NAV(page).getByRole('button', { name: /^Impresora/ })).toHaveCount(0);
      await expect(page.locator('.info-line')).not.toContainText('triángulos');
      // el token falso se borra solo
      expect(await storage(page, 'b3d.workshop.token')).toBeNull();
    }
  });

  test('un token válido que después se adultera deja de servir', async ({ page }) => {
    await open(page);
    await NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' }).click();
    await PIN_FIELD(DIALOG(page)).fill(PIN);
    await DIALOG(page).getByRole('button', { name: 'Entrar' }).click();
    await expect(files(page)).toBeVisible();
    const token = await storage(page, 'b3d.workshop.token');
    await page.evaluate((t) => localStorage.setItem('b3d.workshop.token', t.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))), token);
    await page.reload();
    await expect(page.locator('.info-line')).toContainText('Medida', { timeout: 60000 });
    await expect(files(page)).toBeHidden();
  });

  test('tras 5 intentos fallidos se bloquea, y el bloqueo sobrevive a recargar', async ({ page }) => {
    await open(page);
    await NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' }).click();
    const dialog = DIALOG(page);
    for (let i = 0; i < 5; i++) {
      await PIN_FIELD(dialog).fill(`00000${i}`);
      await dialog.getByRole('button', { name: 'Entrar' }).click();
      // el aviso se borra al empezar cada intento, así que verlo aparecer confirma que ese intento terminó
      if (i < 4) await expect(dialog.getByRole('alert')).toHaveText('PIN incorrecto.');
    }
    await expect(dialog.getByRole('alert')).toContainText('Demasiados intentos');
    await expect(PIN_FIELD(dialog)).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Entrar' })).toBeDisabled();

    // recargar y volver a abrir: sigue bloqueado aunque se ponga el PIN bueno
    await page.reload();
    await expect(page.locator('.info-line')).toContainText('Medida', { timeout: 60000 });
    await NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' }).click();
    await expect(DIALOG(page).getByRole('alert')).toContainText('Demasiados intentos');
    await expect(PIN_FIELD(DIALOG(page))).toBeDisabled();
    await expect(files(page)).toBeHidden();
  });

  test('Escape y Cancelar cierran el diálogo sin activar nada', async ({ page }) => {
    await open(page);
    await NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' }).click();
    await expect(DIALOG(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(DIALOG(page)).toHaveCount(0);
    await NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' }).click();
    await DIALOG(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(DIALOG(page)).toHaveCount(0);
    await expect(files(page)).toBeHidden();
  });

  test('un PIN con formato inválido en la configuración se ignora: queda como sin PIN (no se rompe la página)', async ({ page }) => {
    await open(page, { whatsapp: '5493416686947', workshop: { salt: 'x', iterations: 3, check: 'y' } });
    await NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' }).click();
    await expect(DIALOG(page)).toHaveCount(0);
    await expect(NAV(page).getByRole('button', { name: 'Modo taller: Activado' })).toBeVisible();
    await expect(files(page)).toBeVisible();
  });

  test('el diálogo no explica qué hay detrás y su interfaz es clara', async ({ page }) => {
    await open(page);
    await NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' }).click();
    const dialog = DIALOG(page);
    await expect(dialog).toBeVisible();
    // solo pide el PIN: ninguna pista de qué se desbloquea
    const text = (await dialog.innerText()).toLowerCase();
    for (const word of ['descarg', 'archivo', 'impres', 'stl', '3mf', 'taller']) expect(text, word).not.toContain(word);
    await expect(dialog.getByRole('heading', { name: 'Ingresá el PIN' })).toBeVisible();
    await expect(PIN_FIELD(dialog)).toBeFocused();

    // mostrar / ocultar lo escrito
    await PIN_FIELD(dialog).fill('123456');
    await expect(PIN_FIELD(dialog)).toHaveAttribute('type', 'password');
    await dialog.getByRole('button', { name: 'Mostrar PIN' }).click();
    await expect(PIN_FIELD(dialog)).toHaveAttribute('type', 'text');
    await expect(PIN_FIELD(dialog)).toHaveValue('123456');
    await dialog.getByRole('button', { name: 'Ocultar PIN' }).click();
    await expect(PIN_FIELD(dialog)).toHaveAttribute('type', 'password');

    // un PIN malo marca el campo como inválido; al volver a escribir, la marca se va
    await dialog.getByRole('button', { name: 'Entrar' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('PIN incorrecto.');
    await expect(PIN_FIELD(dialog)).toHaveAttribute('aria-invalid', 'true');
    await PIN_FIELD(dialog).pressSequentially('1');
    await expect(PIN_FIELD(dialog)).toHaveAttribute('aria-invalid', 'false');
    await expect(dialog.getByRole('alert')).toHaveText('');

    // Enter en el campo envía; clic en el fondo oscuro cierra
    await PIN_FIELD(dialog).fill(PIN);
    await PIN_FIELD(dialog).press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(files(page)).toBeVisible();
    await NAV(page).getByRole('button', { name: 'Modo taller: Activado' }).click();
    await NAV(page).getByRole('button', { name: 'Modo taller: Desactivado' }).click();
    await expect(DIALOG(page)).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(DIALOG(page)).toHaveCount(0);
  });
});
