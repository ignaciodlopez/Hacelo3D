import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/stamp/build.js';
import { defaults, normalizeParams } from '../../src/tools/stamp/params.js';
import { HANDLE_MODELS, handleProfile } from '../../src/tools/stamp/handles.js';
import { exportStl } from '../../src/core/export/exports.js';

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

/** Pendiente real de caras descendentes, también en Y y diagonales.
 * Comparar solo los vértices por nivel falla cuando una transición se ensancha en X y se estrecha en Y:
 * los vértices intermedios no representan una sección completa del sólido.
 */
function maxSlope(it, zFrom) {
  const { positions: P, indices: I } = it.merged;
  let worst = 0;
  for (let i = 0; i < I.length; i += 3) {
    const [a, b, c] = [I[i], I[i + 1], I[i + 2]].map((v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
    const zMin = Math.min(a[2], b[2], c[2]);
    if (zMin < zFrom || Math.max(a[2], b[2], c[2]) - zMin < 0.05) continue;
    const u = b.map((v, j) => v - a[j]);
    const v = c.map((v, j) => v - a[j]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...normal) < 0.0001) continue; // microcaras de la unión, por debajo de la resolución de impresión
    if (normal[2] < 0) worst = Math.max(worst, -normal[2] / Math.hypot(normal[0], normal[1]));
  }
  return worst;
}

/**
 * Mayor ángulo (°) entre caras vecinas del mango y el ensanche, sin contar la cara sobre la cama ni la placa: en una
 * superficie lisa bien muestreada es chico; una arista, un pliegue o un escalón lo disparan.
 */
function maxCrease(it) {
  const { positions: P, indices: I } = it.merged;
  const zPlate = it.handleHeightMm + it.transitionHeightMm;
  const faces = [];
  for (let i = 0; i < I.length; i += 3) {
    const [a, b, c] = [I[i], I[i + 1], I[i + 2]].map((v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
    const u = b.map((x, j) => x - a[j]);
    const w = c.map((x, j) => x - a[j]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(...n);
    const zs = [a[2], b[2], c[2]];
    faces.push(len < 1e-9 || Math.min(...zs) < 0.01 || Math.max(...zs) > zPlate - 0.01 ? null : n.map((x) => x / len));
  }
  const edges = new Map();
  for (let f = 0; f < faces.length; f++) for (let k = 0; k < 3; k++) {
    const [a, b] = [I[f * 3 + k], I[f * 3 + (k + 1) % 3]];
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    edges.set(key, [...(edges.get(key) ?? []), f]);
  }
  let worst = 0;
  for (const [f, g] of edges.values()) {
    if (!faces[f] || !faces[g]) continue;
    const dot = faces[f].reduce((sum, x, j) => sum + x * faces[g][j], 0);
    worst = Math.max(worst, (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI);
  }
  return worst;
}

describe('sello', () => {
  for (const handle of Object.keys(HANDLE_MODELS).filter((id) => id !== 'none')) {
    it(`${handle}: cuerpo unido, base plana, pendiente imprimible y superficie sin aristas ni pliegues`, async () => {
      for (const shape of ['rounded', 'circle', 'ellipse']) {
        const result = await run({ handle, shape, ...HANDLE_MODELS[handle].dimensions });
        const item = check(result, `${handle} ${shape}`);
        expect(item.parts[0].zMin).toBeCloseTo(0, 5);
        expect(maxSlope(item, 0), `${handle} ${shape}`).toBeLessThan(1);
        expect(maxCrease(item), `${handle} ${shape}`).toBeLessThan(16);
      }
    });
  }

  it('en placas grandes no recorta la transición a 30 mm ni deja voladizos sin avisar', async () => {
    const result = await run({ text: 'F', fontId: 'archivo-black', sizeMm: 100, handle: 'knob', handleWidthMm: 8, handleHeightMm: 5, curveQuality: 'draft' });
    const item = check(result, 'placa grande');
    expect(item.transitionHeightMm).toBeGreaterThan(30);
    expect(maxSlope(item, 0)).toBeLessThan(1.05);
    expect(result.messages.some((m) => m.code === 'stamp.flare')).toBe(true);
  });

  it('mango ancho y bajo: ajusta la altura y mantiene la pieza conectada', async () => {
    const result = await run({ text: 'F', fontId: 'archivo-black', sizeMm: 70, shape: 'circle', handle: 'mushroom', handleWidthMm: 80, handleHeightMm: 5, curveQuality: 'draft' });
    const item = check(result, 'mango ancho');
    expect(item.handleHeightMm).toBeGreaterThan(5);
    expect(result.messages.some((m) => m.code === 'stamp.handleHeight')).toBe(true);
    expect(maxSlope(item, 0)).toBeLessThan(1.05);
  });

  it('la vista del mango no gira el STL: siempre exporta apoyado en la cama', async () => {
    const params = { text: 'F', handle: 'ergonomic', curveQuality: 'draft' };
    const use = check(await run({ ...params, stampView: 'use' }), 'vista uso');
    const print = check(await run({ ...params, stampView: 'print' }), 'vista impresión');
    expect(use.viewTransform).toHaveLength(12);
    expect(print.viewTransform).toBeUndefined();
    expect(exportStl({ items: [use] }).data).toEqual(exportStl({ items: [print] }).data);
  });

  it('el perfil del mango pasa por los nodos, sin pasarse de sus radios ni terrazas en cada nodo', () => {
    for (const [id, model] of Object.entries(HANDLE_MODELS).filter(([id]) => id !== 'none')) {
      const profile = handleProfile(id, 8);
      model.profile.forEach(([z, r], i) => {
        const [pz, pr] = profile[i * 8];
        expect([id, pz]).toEqual([id, expect.closeTo(z, 9)]);
        expect(pr).toBeCloseTo(r, 9);
      });
      for (let i = 1; i < model.profile.length; i++) {
        const [lo, hi] = [model.profile[i - 1][1], model.profile[i][1]].sort((x, y) => x - y);
        for (const [, r] of profile.slice((i - 1) * 8, i * 8 + 1)) expect(r, id).toBeGreaterThanOrEqual(lo - 1e-9), expect(r, id).toBeLessThanOrEqual(hi + 1e-9);
      }
      // pendiente continua: ningún nodo interior deja el radio "plano" con tramos vecinos que sí cambian
      for (let i = 1; i < model.profile.length - 1; i++) {
        const before = model.profile[i][1] - model.profile[i - 1][1];
        const after = model.profile[i + 1][1] - model.profile[i][1];
        if (before * after <= 0) continue;
        const k = i * 8;
        expect(Math.abs(profile[k + 1][1] - profile[k - 1][1]), id).toBeGreaterThan(0);
      }
    }
  });

  it('admite los nuevos modelos y mantiene los ids de diseños anteriores', () => {
    for (const handle of Object.keys(HANDLE_MODELS)) expect(normalizeParams({ handle }).handle).toBe(handle);
    expect(normalizeParams({ stampView: 'invalid' }).stampView).toBe('use');
  });

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
    const r = await run({ handle: 'knob', handleWidthMm: 8 });
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
