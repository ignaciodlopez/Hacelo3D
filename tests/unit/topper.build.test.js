import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/topper/build.js';
import { defaults, normalizeParams } from '../../src/tools/topper/params.js';

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
  expect(r.messages.filter((m) => m.level === 'error'), label).toEqual([]);
  expect(it.merged.status, label).toBe('NoError');
  expect(it.merged.genus, label).toBeGreaterThanOrEqual(0);
  for (const p of it.parts) {
    expect(p.status, label).toBe('NoError');
    expect(p.volumeMm3, label).toBeGreaterThan(0);
  }
  // las partes no se solapan: la suma de volúmenes = volumen de la unión
  const sum = it.parts.reduce((s, p) => s + p.volumeMm3, 0);
  expect(Math.abs(sum - it.merged.volumeMm3) / it.merged.volumeMm3, label).toBeLessThan(0.002);
  return it;
}

describe('topper de torta', () => {
  it('por defecto: Feliz Cumple, 2 palitos, base + letras', async () => {
    const it = check(await run(), {});
    expect(it.parts.map((p) => p.colorKey).sort()).toEqual(['base', 'text']);
    expect(it.sizeMm[2]).toBeGreaterThan(4); // base 3 + relieve 1,5 (alineado a capas)
  });

  it('los palitos alargan la pieza hacia abajo y 0 palitos la acortan', async () => {
    const none = check(await run({ sticks: 0 }), { sticks: 0 });
    const two = check(await run({ sticks: 2, stickLengthMm: 60 }), { sticks: 2 });
    // el largo se mide desde el borde de la base en el punto del palito (no desde su punto más bajo)
    expect(two.sizeMm[1] - none.sizeMm[1]).toBeGreaterThan(25);
    expect(two.sizeMm[1] - none.sizeMm[1]).toBeLessThan(65);
  });

  it('1, 2 y 3 palitos', async () => {
    const vols = [];
    for (const sticks of [1, 2, 3]) {
      const it = check(await run({ sticks }), { sticks });
      vols.push(it.merged.volumeMm3);
    }
    expect(vols[0]).toBeLessThan(vols[1]);
    expect(vols[1]).toBeLessThan(vols[2]);
  });

  it('formas: silueta (rellena / ajustada), círculo y óvalo', async () => {
    for (const over of [{ shape: 'silhouette', fill: 'filled' }, { shape: 'silhouette', fill: 'tight' }, { shape: 'circle' }, { shape: 'ellipse' }]) {
      check(await run(over), over);
    }
  });

  it('líneas de distinto ancho quedan unidas con un puente ancho (una sola pieza)', async () => {
    const over = { text: 'Mi\nComunión', fill: 'filled' };
    const it = check(await run(over), over);
    expect(it.merged.genus).toBe(0);
  });

  it('letras al ras: la cara superior queda plana', async () => {
    const it = check(await run({ relief: false, baseThicknessMm: 3 }), { relief: false });
    expect(it.sizeMm[2]).toBeLessThan(3.3);
  });

  it('una sola línea, mayúsculas y alineación a la izquierda', async () => {
    const over = { text: 'Papá', uppercase: true, align: 'left', fontId: 'archivo-black', sizeMm: 100 };
    check(await run(over), over);
  });

  it('texto vacío → error text.empty sin geometría', async () => {
    const r = await run({ text: '  \n ' });
    expect(r.items).toEqual([]);
    expect(r.messages.some((m) => m.code === 'text.empty')).toBe(true);
  });

  it('normalizeParams nunca lanza y clampea', () => {
    expect(() => normalizeParams(null)).not.toThrow();
    const p = normalizeParams({ sticks: 9, stickLengthMm: 'x', shape: 'nope', sizeMm: -5, colors: { base: 'zzz' } });
    expect(p.sticks).toBe(3);
    expect(p.stickLengthMm).toBe(defaults.stickLengthMm);
    expect(p.shape).toBe('silhouette');
    expect(p.sizeMm).toBe(20);
    expect(p.colors.base).toBe(defaults.colors.base);
  });
});
