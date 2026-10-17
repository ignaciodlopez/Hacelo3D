import { describe, it, expect } from 'vitest';
import { createPinConfig, verifyPin, verifyToken, deriveToken, validPinConfig, PIN_PATTERN } from '../../src/app/workshopPin.js';
import { normalizeShopConfig } from '../../src/app/shopConfig.js';

// pocas vueltas de PBKDF2 para que los tests sean rápidos (en producción son 600.000)
const FAST = { iterations: 1000 };

describe('PIN del modo taller', () => {
  it('con el PIN correcto da un token; con uno incorrecto, nada', async () => {
    const cfg = await createPinConfig('483920', FAST);
    const token = await verifyPin('483920', cfg);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    for (const bad of ['483921', '000000', '48392', '4839200', '', 'abcdef', '48 3920']) expect(await verifyPin(bad, cfg), bad).toBeNull();
  });

  it('lo que se publica no contiene el PIN ni el token', async () => {
    const cfg = await createPinConfig('483920', FAST);
    const token = await verifyPin('483920', cfg);
    const published = JSON.stringify(cfg);
    expect(published).not.toContain('483920');
    expect(published).not.toContain(token);
    expect(Object.keys(cfg).sort()).toEqual(['check', 'iterations', 'salt']);
  });

  it('el token guardado en el navegador se reconoce; cualquier otra cosa no', async () => {
    const cfg = await createPinConfig('1234', FAST);
    const token = await verifyPin('1234', cfg);
    expect(await verifyToken(token, cfg)).toBe(true);
    // lo que un curioso podría intentar poner en el almacenamiento del navegador
    const attempts = ['1', 'true', '1234', cfg.check, cfg.salt, '0'.repeat(64), 'f'.repeat(64), token.toUpperCase(), token.slice(1), `${token}0`, null, undefined, 5, {}];
    for (const a of attempts) expect(await verifyToken(a, cfg), String(a)).toBe(false);
  });

  it('el valor público (check) NO sirve como token: ver la configuración no permite entrar', async () => {
    const cfg = await createPinConfig('1234', FAST);
    expect(await verifyToken(cfg.check, cfg)).toBe(false);
  });

  it('un token de otro PIN o de otra instalación no vale', async () => {
    const a = await createPinConfig('1234', FAST);
    const b = await createPinConfig('1234', FAST); // mismo PIN, otra sal
    expect(a.salt).not.toBe(b.salt);
    expect(a.check).not.toBe(b.check);
    const tokenA = await verifyPin('1234', a);
    expect(await verifyToken(tokenA, b)).toBe(false);
    expect(await verifyToken(await verifyPin('5678', await createPinConfig('5678', FAST)), a)).toBe(false);
  });

  it('el costo de probar un PIN depende de las vueltas configuradas', async () => {
    const t = async (iterations) => {
      const t0 = performance.now();
      await deriveToken('1234', 'ab'.repeat(16), iterations);
      return performance.now() - t0;
    };
    await t(1000); // calentamiento
    expect(await t(200000)).toBeGreaterThan((await t(2000)) * 5);
  });

  it('solo acepta PIN de 4 a 12 dígitos', async () => {
    expect(PIN_PATTERN.test('1234')).toBe(true);
    expect(PIN_PATTERN.test('123456789012')).toBe(true);
    for (const bad of ['123', '1234567890123', '12a4', ' 1234', '12.34', '']) {
      expect(PIN_PATTERN.test(bad), bad).toBe(false);
      await expect(createPinConfig(bad, FAST)).rejects.toThrow();
    }
  });

  it('la configuración con forma rara se descarta (y el sitio queda sin PIN, nunca roto)', async () => {
    const ok = await createPinConfig('1234', FAST);
    expect(validPinConfig(ok)).toBe(true);
    for (const bad of [null, {}, { ...ok, iterations: 5 }, { ...ok, iterations: 1e12 }, { ...ok, salt: 'xyz' }, { ...ok, check: 'abc' }, { ...ok, iterations: '1000' }, 'x']) expect(validPinConfig(bad)).toBe(false);
    expect(normalizeShopConfig({ workshop: ok }).workshopPin).toEqual(ok);
    expect(normalizeShopConfig({ workshop: { ...ok, check: 'x' } }).workshopPin).toBeNull();
    expect(normalizeShopConfig({}).workshopPin).toBeNull();
  });
});
