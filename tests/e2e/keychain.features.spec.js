import { test, expect } from './fixtures.js';
import { workshop, download } from './helpers.js';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { encodeShare } from '../../src/core/state/persistence.js';
import { defaults } from '../../src/tools/keychain/params.js';

const info = (page) => page.locator('.info-line');
const waitGen = (page) => expect(info(page)).toContainText('triángulos', { timeout: 30000 });
const sizeOf = async (page) => {
  const m = /Medida: ([\d.]+) × ([\d.]+) × ([\d.]+)/.exec((await info(page).textContent()) ?? '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await workshop(page);
});

test('cambiar la forma a corazón regenera la pieza', async ({ page }) => {
  await page.goto('/#/tool/keychain');
  await waitGen(page);
  const before = await sizeOf(page);
  await page.getByLabel('Forma', { exact: true }).selectOption('heart');
  await expect.poll(() => sizeOf(page).then((s) => s?.[1]), { timeout: 15000 }).not.toBe(before[1]);
  await expect(page.locator('.messages .error')).toHaveCount(0);
});

test('ícono: elegir un corazón agranda la pieza', async ({ page }) => {
  await page.goto('/#/tool/keychain');
  await waitGen(page);
  const before = await sizeOf(page);
  await page.getByRole('button', { name: /^Ícono:/ }).click();
  await page.getByRole('option', { name: 'Corazón' }).first().click();
  await expect.poll(() => sizeOf(page).then((s) => s?.[0]), { timeout: 20000 }).toBeGreaterThan(before[0] + 8);
});

test('lote: varios nombres → piezas, y descarga de STL (zip) y 3MF', async ({ page }) => {
  await page.goto('/#/tool/keychain');
  await waitGen(page);
  await page.getByRole('button', { name: 'Varios nombres' }).click();
  await expect(info(page)).toContainText('3 piezas', { timeout: 30000 });
  const stl = await download(page, 'STL');
  expect(stl.suggestedFilename()).toBe('llavero-lote.zip');
  const files = Object.keys(unzipSync(new Uint8Array(readFileSync(await stl.path()))));
  expect(files.sort()).toEqual(['llavero-mateo.stl', 'llavero-sofia.stl', 'llavero-valentina.stl']);
  const mf = await download(page, '3MF');
  expect(mf.suggestedFilename()).toBe('llavero-placa-1.3mf');
});

test('preset, deshacer y restablecer', async ({ page }) => {
  await page.goto('/#/tool/keychain');
  await waitGen(page);
  const before = await sizeOf(page);
  await page.getByLabel('Ejemplos para empezar').selectOption('bagtag');
  await expect.poll(() => sizeOf(page).then((s) => s?.join()), { timeout: 15000 }).not.toBe(before.join());
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByLabel('Texto del llavero')).toHaveValue('Valentina');
  await page.getByRole('button', { name: 'Restablecer' }).click();
  await waitGen(page);
});

test('enlace compartido restaura los parámetros (incluido un emoji)', async ({ page }) => {
  const p = encodeShare({ ...defaults, text: 'Lu 💛', fontId: 'lobster', sizeMm: 40 }, 1);
  await page.goto(`/#/tool/keychain?p=${p}`);
  await waitGen(page);
  await expect(page.getByLabel('Texto del llavero')).toHaveValue('Lu 💛');
  await expect(page.getByLabel('Tamaño', { exact: true })).toHaveValue('40');
  // el emoji no está en la fuente: se omite y se avisa
  await expect(page.locator('.messages')).toContainText('caracteres');
});

test('datos guardados corruptos no rompen la app', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('b3d.tool.keychain', '{no es json'));
  await page.goto('/#/tool/keychain');
  await waitGen(page);
});

test('cambiar idioma a inglés traduce la herramienta', async ({ page }) => {
  await page.goto('/#/tool/keychain');
  await waitGen(page);
  await page.getByRole('button', { name: 'Idioma' }).click();
  await expect(page.locator('h1')).toHaveText('Name keychain');
  await expect(info(page)).toContainText('triangles', { timeout: 30000 });
});

test('perfil de impresora: una cama chica avisa que la pieza no entra', async ({ page }) => {
  await page.goto('/#/tool/keychain');
  await waitGen(page);
  await page.getByRole('button', { name: 'Impresora' }).click();
  const dlg = page.locator('dialog');
  const bed = dlg.locator('input.num-input');
  await bed.nth(0).fill('50');
  await bed.nth(0).press('Tab');
  await bed.nth(1).fill('50');
  await bed.nth(1).press('Tab');
  await expect(page.locator('.messages')).toContainText('no entra en la cama', { timeout: 15000 });
});
