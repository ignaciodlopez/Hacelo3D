import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/stamp/build.js';
import { defaults, normalizeParams } from '../../src/tools/stamp/params.js';

let K;
const TRIANGLE = [[[0, 0], [10, 0], [5, 8]]]; // ícono mínimo (contorno sin normalizar)
const ctx = (extra = {}) => ({ getFont: (id) => fontStore.get(id), printer: {}, ...extra });
beforeAll(async () => {
  K = await initKernel();
});

const run = (over = {}, extra = {}) => build(K, { ...defaults, ...over }, ctx(extra));

function check(r, label) {
  expect(r.items.length, label).toBe(1);
  const it = r.items[0];
  expect(r.messages.filter((m) => m.level === 'error'), label).toEqual([]);
  expect(it.merged.status, label).toBe('NoError');
  expect(it.merged.genus, label).toBe(0);
  expect(it.parts.length, label).toBe(1);
  expect(it.parts[0].status, label).toBe('NoError');
  expect(it.parts[0].volumeMm3, label).toBeGreaterThan(0);
  // part y merged no comparten buffers (el worker transfiere cada ArrayBuffer una sola vez)
  expect(it.parts[0].positions.buffer).not.toBe(it.merged.positions.buffer);
  return it;
}

/** Centroide X (ponderado por área) de las caras de la tapa del relieve (todas a z = zTop). */
function topFaceCentroidX(it) {
  const { positions: P, indices: I } = it.merged;
  const zTop = it.reliefTopZ;
  let A = 0;
  let Cx = 0;
  for (let t = 0; t < I.length; t += 3) {
    const v = [0, 1, 2].map((k) => [P[I[t + k] * 3], P[I[t + k] * 3 + 1], P[I[t + k] * 3 + 2]]);
    if (!v.every((q) => Math.abs(q[2] - zTop) < 1e-4)) continue;
    const a = Math.abs((v[1][0] - v[0][0]) * (v[2][1] - v[0][1]) - (v[2][0] - v[0][0]) * (v[1][1] - v[0][1])) / 2;
    A += a;
    Cx += (a * (v[0][0] + v[1][0] + v[2][0])) / 3;
  }
  return Cx / A;
}

/** Pendiente máxima (Δ semiancho / Δz) entre niveles de z consecutivos por encima de `zFrom`. */
function maxSlope(it, zFrom) {
  const { positions: P } = it.merged;
  const levels = new Map();
  for (let i = 0; i < P.length; i += 3) {
    const z = Math.round(P[i + 2] * 1000) / 1000;
    const e = levels.get(z) ?? { min: Infinity, max: -Infinity };
    e.min = Math.min(e.min, P[i]);
    e.max = Math.max(e.max, P[i]);
    levels.set(z, e);
  }
  const zs = [...levels.keys()].sort((a, b) => a - b).filter((z) => z >= zFrom);
  let worst = 0;
  for (let i = 1; i < zs.length; i++) {
    const dz = zs[i] - zs[i - 1];
    if (dz < 0.05) continue; // láminas finas del casco: paredes verticales
    const grow = ((levels.get(zs[i]).max - levels.get(zs[i]).min) - (levels.get(zs[i - 1]).max - levels.get(zs[i - 1]).min)) / 2;
    worst = Math.max(worst, grow / dz);
  }
  return worst;
}

describe('sello', () => {
  it('por defecto: una pieza cerrada, de un color, con mango, placa y relieve', async () => {
    const it = check(await run(), 'default');
    expect(it.parts[0].colorKey).toBe('base');
    // mango 18 + cono + placa 3 + relieve 1,6: bastante más alto que la placa sola
    expect(it.sizeMm[2]).toBeGreaterThan(20);
  });

  it('el texto va ESPEJADO: la "F" tiene el trazo vertical a la derecha del centro', async () => {
    const over = { text: 'F', fontId: 'archivo-black', boldOffsetMm: 0, handle: 'none', sizeMm: 40 };
    expect(topFaceCentroidX(check(await run(over), 'F'))).toBeGreaterThan(0.5);
  });

  it('se imprime sin soportes: ninguna pendiente supera ~45° desde el mango', async () => {
    for (const over of [{}, { handle: 'knob' }, { shape: 'circle', handle: 'knob' }, { handleWidthMm: 15, handleHeightMm: 10 }]) {
      const it = check(await run(over), JSON.stringify(over));
      expect(maxSlope(it, over.handleHeightMm ?? 18), JSON.stringify(over)).toBeLessThan(1.05);
    }
  });

  it('perilla en placa ancha y baja: cono muy alto → avisa', async () => {
    const r = await run({ handle: 'knob', handleWidthMm: 14 });
    expect(r.messages.map((m) => m.code)).toContain('stamp.flare');
    const ok = await run({ handle: 'bar' });
    expect(ok.messages.map((m) => m.code)).not.toContain('stamp.flare');
  });

  it('sin mango: placa + relieve apoyados en la cama', async () => {
    const it = check(await run({ handle: 'none', plateThicknessMm: 3, reliefMm: 1.6 }), 'none');
    expect(it.sizeMm[2]).toBeLessThan(5);
    expect(it.sizeMm[2]).toBeGreaterThan(4);
  });

  it('formas de placa y mango de barra', async () => {
    for (const over of [{ shape: 'circle', handle: 'knob' }, { shape: 'ellipse' }, { handle: 'knob' }, { handle: 'bar', handleLengthMm: 40, handleWidthMm: 18 }, { shape: 'rounded', cornerRadiusMm: 0 }]) {
      check(await run(over), JSON.stringify(over));
    }
  });

  it('solo ícono (sin texto) y texto + ícono', async () => {
    const polys = { star: TRIANGLE };
    const only = check(await run({ text: '', icon: 'star', sizeMm: 30 }, { iconPolys: polys }), 'icon only');
    expect(only.name).toBe('star');
    const both = check(await run({ icon: 'star', iconPosition: 'both' }, { iconPolys: polys }), 'text+icon');
    const textOnly = check(await run(), 'text only');
    expect(both.sizeMm[0]).toBeGreaterThan(textOnly.sizeMm[0]);
  });

  it('sin texto ni ícono → error stamp.empty, sin geometría', async () => {
    const r = await run({ text: '  ' });
    expect(r.items).toEqual([]);
    expect(r.messages.some((m) => m.code === 'stamp.empty')).toBe(true);
    const r2 = await run({ text: '', icon: 'star' }); // ícono elegido pero sin polígonos cargados
    expect(r2.items).toEqual([]);
  });

  it('normalizeParams nunca lanza y clampea', () => {
    expect(() => normalizeParams(null)).not.toThrow();
    const p = normalizeParams({ handle: 'x', shape: 'y', sizeMm: 9999, reliefMm: -1, handleHeightMm: 'abc', colors: { base: 'zz' } });
    expect(p.handle).toBe('bar');
    expect(p.shape).toBe('rounded');
    expect(p.sizeMm).toBe(200);
    expect(p.reliefMm).toBe(0.4);
    expect(p.handleHeightMm).toBe(defaults.handleHeightMm);
    expect(p.colors.base).toBe(defaults.colors.base);
  });
});
