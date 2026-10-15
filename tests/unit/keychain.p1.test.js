import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/keychain/build.js';
import { defaults } from '../../src/tools/keychain/params.js';
import { layoutPlates } from '../../src/tools/keychain/layout.js';

let K;
const ctxOf = (extra = {}) => ({ getFont: (id) => fontStore.get(id), printer: {}, ...extra });
beforeAll(async () => {
  K = await initKernel();
});
const run = (over = {}, extra = {}) => build(K, { ...defaults, ...over }, ctxOf(extra));
const errors = (r) => r.messages.filter((m) => m.level === 'error').map((m) => m.code);

describe('formas decorativas', () => {
  it('todas contienen el texto completo (las letras no se recortan) y son manifold con 1 agujero', async () => {
    const ref = await run({ shape: 'rounded', ringType: 'none' });
    const refLetters = ref.items[0].parts.find((p) => p.colorKey === 'text').volumeMm3;
    for (const shape of ['ellipse', 'circle', 'heart', 'tag', 'hexagon', 'cloud', 'badge']) {
      const noRing = await run({ shape, ringType: 'none' });
      const letters = noRing.items[0].parts.find((p) => p.colorKey === 'text').volumeMm3;
      expect(letters, shape).toBeCloseTo(refLetters, 0);
      const r = await run({ shape, ringPosition: 'left' });
      expect(errors(r), shape).toEqual([]);
      expect(r.items[0].merged.status, shape).toBe('NoError');
      expect(r.items[0].merged.genus, shape).toBe(1);
    }
  });

  it('con varias líneas y fuente gruesa', async () => {
    for (const shape of ['heart', 'badge', 'cloud']) {
      const r = await run({ shape, text: 'Ana\nLuz', fontId: 'archivo-black', ringPosition: 'top' });
      expect(errors(r), shape).toEqual([]);
      expect(r.items[0].merged.status).toBe('NoError');
    }
  });
});

describe('argollas', () => {
  it('ranura (slot) en todas las posiciones: manifold, 1 agujero', async () => {
    for (const ringPosition of ['left', 'right', 'top']) {
      const r = await run({ ringType: 'slot', ringPosition, shape: 'rounded', cornerRadiusMm: 4 });
      expect(errors(r)).toEqual([]);
      expect(r.items[0].merged.status).toBe('NoError');
      expect(r.items[0].merged.genus).toBe(1);
    }
  });

  it('interna con margen grande cabe; con margen chico avisa ring.noRoom', async () => {
    const ok = await run({ ringType: 'internal', marginMm: 9, ringHoleMm: 4, ringOuterMm: 8 });
    expect(ok.messages.map((m) => m.code)).not.toContain('ring.noRoom');
    expect(ok.items[0].merged.genus).toBe(1);
    const bad = await run({ ringType: 'internal', marginMm: 2, ringHoleMm: 5, ringOuterMm: 9 });
    expect(bad.messages.map((m) => m.code)).toContain('ring.noRoom');
  });
});

describe('íconos', () => {
  const heart = [
    Array.from({ length: 60 }, (_, i) => {
      const a = (i / 60) * Math.PI * 2;
      return [16 * Math.sin(a) ** 3, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))];
    }),
  ];
  it('el ícono agranda la pieza y se integra al texto', async () => {
    const base = await run({ icon: null });
    const withIcon = await run({ icon: 'heart', iconPosition: 'both' }, { iconPolys: { heart } });
    expect(withIcon.items[0].sizeMm[0]).toBeGreaterThan(base.items[0].sizeMm[0] + 10);
    expect(withIcon.items[0].merged.status).toBe('NoError');
    expect(errors(withIcon)).toEqual([]);
  });
  it('sin polígonos disponibles se ignora', async () => {
    const r = await run({ icon: 'heart' });
    expect(r.items).toHaveLength(1);
  });
});

describe('lote', () => {
  it('layoutPlates: sin solapes, todo dentro de la cama y varias placas si no entra', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ bboxXY: [-30, -15, 30 + (i % 3) * 5, 15] }));
    const { plates, offsets } = layoutPlates(items, [180, 180]);
    expect(plates.length).toBeGreaterThan(1);
    expect(plates.flatMap((p) => p.items).sort((a, b) => a - b)).toEqual(items.map((_, i) => i));
    for (const pl of plates) {
      const boxes = pl.items.map((i) => {
        const [x0, y0, x1, y1] = items[i].bboxXY;
        return [x0 + offsets[i][0], y0 + offsets[i][1], x1 + offsets[i][0], y1 + offsets[i][1]];
      });
      for (const b of boxes) {
        expect(b[0]).toBeGreaterThanOrEqual(5 - 1e-6);
        expect(b[1]).toBeGreaterThanOrEqual(5 - 1e-6);
        expect(b[2]).toBeLessThanOrEqual(175 + 1e-6);
        expect(b[3]).toBeLessThanOrEqual(175 + 1e-6);
      }
      for (let a = 0; a < boxes.length; a++) {
        for (let b = a + 1; b < boxes.length; b++) {
          const A = boxes[a];
          const B = boxes[b];
          expect(A[2] <= B[0] || B[2] <= A[0] || A[3] <= B[1] || B[3] <= A[1]).toBe(true);
        }
      }
    }
  });

  it('lote de 6 nombres: placas, offsets y escala común con sameScale', async () => {
    const batchText = 'Ana\nMateo\nValentina\nSol\nBautista\nLu';
    const same = await run({ mode: 'batch', batchText, batchUniform: 'sameScale', sizeMm: 50 });
    expect(same.items).toHaveLength(6);
    expect(same.plates.length).toBeGreaterThanOrEqual(1);
    expect(same.bed).toEqual([256, 256]);
    const scales = new Set(same.items.map((i) => i.scale.toFixed(6)));
    expect(scales.size).toBe(1);
    const wide = await run({ mode: 'batch', batchText, batchUniform: 'sameWidth', sizeMm: 50 });
    const widths = wide.items.map((i) => i.sizeMm[0]);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(8);
    for (const it of same.items) expect(it.merged.status).toBe('NoError');
  });

  it('lote de 50 nombres se genera en menos de 10 s', async () => {
    const batchText = Array.from({ length: 50 }, (_, i) => ['Sofía', 'Mateo', 'Valentina', 'Joaquín', 'Camila'][i % 5] + (i % 7)).join('\n');
    const t0 = performance.now();
    const r = await run({ mode: 'batch', batchText, curveQuality: 'normal' });
    const ms = performance.now() - t0;
    console.log('batch 50:', Math.round(ms), 'ms,', r.plates.length, 'placas');
    expect(r.items).toHaveLength(50);
    expect(ms).toBeLessThan(10000);
  });
});
