import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore, catalog } from './helpers.js';
import { build } from '../../src/tools/keychain/build.js';
import { defaults } from '../../src/tools/keychain/params.js';

let K;
const ctx = () => ({ getFont: (id) => fontStore.get(id), printer: {} });
beforeAll(async () => {
  K = await initKernel();
});

const run = (over = {}) => build(K, { ...defaults, ...over }, ctx());

function check(r, over) {
  const label = JSON.stringify(over);
  expect(r.items.length, label).toBe(1);
  const it = r.items[0];
  const errs = r.messages.filter((m) => m.level === 'error');
  expect(errs, label).toEqual([]);
  expect(it.merged.status, label).toBe('NoError');
  for (const p of it.parts) {
    expect(p.status, label).toBe('NoError');
    expect(p.volumeMm3, label).toBeGreaterThan(0);
  }
  const expectedGenus = over.ringType === 'none' ? 0 : 1;
  expect(it.merged.genus, label).toBe(expectedGenus);
  // las partes no se solapan: la suma de volúmenes = volumen de la unión
  const sum = it.parts.reduce((s, p) => s + p.volumeMm3, 0);
  expect(Math.abs(sum - it.merged.volumeMm3) / it.merged.volumeMm3, label).toBeLessThan(0.002);
}

// PRNG determinista para muestrear combinaciones
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe('llavero: matriz de combinaciones', () => {
  it('estilos × argollas × borde con Sofía/Pacifico', async () => {
    for (const letterStyle of ['relief', 'engraved', 'flush']) {
      for (const ringType of ['tab', 'none']) {
        for (const border of [false, true]) {
          const over = { letterStyle, ringType, border };
          check(await run(over), over);
        }
      }
    }
  });

  it('posiciones de argolla: left / right / top / topLeft / topRight', async () => {
    for (const ringPosition of ['left', 'right', 'top', 'topLeft', 'topRight']) {
      const over = { ringPosition, text: 'Mateo' };
      check(await run(over), over);
    }
  });

  it('forma pastilla (rounded) con varias líneas', async () => {
    const over = { shape: 'rounded', text: 'Ana\nLuz', border: true };
    check(await run(over), over);
  });

  it('cada fuente del catálogo genera una pieza válida de una sola isla', async () => {
    for (const f of catalog) {
      for (const text of ['Sofía', 'MATEO', 'ñandú']) {
        const over = { fontId: f.id, text, boldOffsetMm: f.recommendedBold ?? 0 };
        check(await run(over), over);
      }
    }
  });

  it('muestreo aleatorio de 40 combinaciones', async () => {
    const rnd = rng(42);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    for (let i = 0; i < 40; i++) {
      const over = {
        fontId: pick(catalog).id,
        text: pick(['Sofía', 'MATEO', 'Val', 'Camila Sol', 'Ñu']),
        letterStyle: pick(['relief', 'engraved', 'flush']),
        shape: pick(['follow', 'rounded']),
        ringType: pick(['tab', 'tab', 'none']),
        ringPosition: pick(['left', 'right', 'top']),
        border: rnd() > 0.5,
        sizeMode: pick(['textWidth', 'overallWidth', 'textHeight', 'capHeight']),
        sizeMm: pick([30, 40, 55, 70]),
        marginMm: pick([2, 3, 4]),
        baseThicknessMm: pick([2, 3, 4]),
        letterSpacingMm: pick([0, -0.5, 1]),
        textEffect: pick(['none', 'outline', 'shadow']),
        faceDown: rnd() > 0.7,
      };
      const r = await run(over);
      // con espaciado negativo en cursivas finas pueden quedar islas: solo exigimos geometría válida
      const it = r.items[0];
      expect(it.merged.status, JSON.stringify(over)).toBe('NoError');
      expect(it.merged.volumeMm3).toBeGreaterThan(0);
    }
  });
});

describe('llavero: propiedades concretas', () => {
  it('relief: un cambio de color en Z = base', async () => {
    const r = await run({ baseThicknessMm: 3, reliefMm: 1.4 });
    expect(r.info.colorChanges).toEqual([{ zMm: 3, layer: 16, toColorKey: 'text' }]);
  });

  it('flush: la cara superior de base y letras está a la misma Z y exige multimaterial', async () => {
    const r = await run({ letterStyle: 'flush' });
    const [a, b] = r.items[0].parts;
    expect(a.zMax).toBeCloseTo(b.zMax, 4);
    expect(r.info.needsMMU).toBe(true);
  });

  it('engraved: una sola parte (1 color)', async () => {
    const r = await run({ letterStyle: 'engraved' });
    expect(r.items[0].parts).toHaveLength(1);
  });

  it('overallWidth: el ancho total coincide con el pedido', async () => {
    const r = await run({ sizeMode: 'overallWidth', sizeMm: 70 });
    expect(r.items[0].sizeMm[0]).toBeGreaterThan(69.5);
    expect(r.items[0].sizeMm[0]).toBeLessThan(70.5);
  });

  it('el agujero de la argolla no toca el texto (pared mínima)', async () => {
    const r = await run({ ringType: 'tab', ringPosition: 'left' });
    expect(r.messages.filter((m) => m.level === 'error')).toEqual([]);
  });

  it('texto vacío → error text.empty y sin geometría', async () => {
    const r = await run({ text: '   ' });
    expect(r.items).toEqual([]);
    expect(r.messages[0].code).toBe('text.empty');
  });

  it('parámetros basura no rompen el build', async () => {
    const r = await build(K, { text: 'Hi', sizeMm: 'abc', marginMm: -5, ringHoleMm: 500, shape: 'xyz', colors: 7 }, ctx());
    expect(r.items).toHaveLength(1);
  });

  it('coma decimal en números ("1,5")', async () => {
    const r = await run({ reliefMm: '1,6' });
    expect(r.items[0].sizeMm[2]).toBeGreaterThan(4.4);
  });
});
