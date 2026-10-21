import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore, catalog } from './helpers.js';
import { build } from '../../src/tools/ornament/build.js';
import { defaults, normalizeParams } from '../../src/tools/ornament/params.js';
import { bridgeLoose } from '../../src/core/kernel/connect.js';
import { createScope } from '../../src/core/kernel/manifold.js';
import ornament from '../../src/tools/ornament/index.js';

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
  for (const p of it.parts) {
    expect(p.status, label).toBe('NoError');
    expect(p.volumeMm3, label).toBeGreaterThan(0);
  }
  // las partes no se solapan: la suma de volúmenes = volumen de la unión
  const sum = it.parts.reduce((s, p) => s + p.volumeMm3, 0);
  expect(Math.abs(sum - it.merged.volumeMm3) / it.merged.volumeMm3, label).toBeLessThan(0.002);
  return it;
}

describe('adorno navideño', () => {
  it('por defecto: esfera de Ø100 con argolla, aro + nombre, alto = nombre (4,3 mm)', async () => {
    const r = await run();
    const it = check(r, {});
    expect(it.parts.map((p) => p.colorKey).sort()).toEqual(['frame', 'name']);
    expect(it.sizeMm[0]).toBeCloseTo(100, 0);
    // la argolla sobresale por arriba
    expect(it.sizeMm[1]).toBeGreaterThan(103);
    expect(it.sizeMm[1]).toBeLessThan(110);
    expect(it.sizeMm[2]).toBeGreaterThan(4.2);
    expect(it.sizeMm[2]).toBeLessThan(4.6);
    const frame = it.parts.find((p) => p.colorKey === 'frame');
    const name = it.parts.find((p) => p.colorKey === 'name');
    expect(frame.zMax).toBeCloseTo(3, 1);
    expect(name.zMax).toBeGreaterThan(frame.zMax);
    expect(r.messages.some((m) => m.code === 'ornament.loose')).toBe(false);
  });

  it('adornos: copos, estrellas y ninguno; más adornos = más material', async () => {
    const frameVol = async (over) => check(await run(over), over).parts.find((p) => p.colorKey === 'frame').volumeMm3;
    const none = await frameVol({ decoration: 'none' });
    const zero = await frameVol({ decoration: 'snow', decoCount: 0 });
    const one = await frameVol({ decoration: 'snow', decoCount: 1 });
    const four = await frameVol({ decoration: 'snow', decoCount: 4 });
    for (const decoration of ['stars', 'hearts', 'trees', 'bells', 'snowmen']) {
      for (const decoCount of [1, 4]) {
        const v = await frameVol({ decoration, decoCount, decoSeed: decoCount === 4 ? 13 : 0 });
        expect(v, decoration).toBeGreaterThan(none);
      }
    }
    expect(none).toBeCloseTo(zero, 0);
    expect(one).toBeGreaterThan(none);
    expect(four).toBeGreaterThan(one);
  });

  it('estilos de copo y variación', async () => {
    for (const over of [{ decoStyle: 'classic' }, { decoStyle: 'fat' }, { decoStyle: 'fine' }, { decoSeed: 7 }, { decoSeed: 42, decoCount: 4 }]) {
      check(await run(over), over);
    }
  });

  it('sin argolla es más bajo; sin barras hay menos material en el aro (las barras son de su color)', async () => {
    const withLoop = check(await run(), {});
    const noLoop = check(await run({ loop: false }), { loop: false });
    expect(withLoop.sizeMm[1] - noLoop.sizeMm[1]).toBeGreaterThan(3);
    const it = check(await run({ bars: false }), { bars: false });
    const frameVol = (x) => x.parts.find((p) => p.colorKey === 'frame').volumeMm3;
    expect(frameVol(it)).toBeLessThan(frameVol(withLoop));
  });

  it('el nombre se monta sobre las barras (no las esquiva): pierde el volumen de abajo donde las cruza', async () => {
    const nameVol = async (over) => check(await run(over), over).parts.find((p) => p.colorKey === 'name').volumeMm3;
    const withBars = await nameVol({});
    const noBars = await nameVol({ bars: false });
    expect(withBars).toBeLessThan(noBars);
    // y sin embargo las letras siguen llegando a la cama en las zonas libres
    const it = check(await run(), {});
    expect(it.parts.find((p) => p.colorKey === 'name').zMin).toBeCloseTo(0, 3);
  });

  it('diámetros chico y grande, y otras fuentes', async () => {
    const cases = [
      { diameterMm: 60, nameWidthMm: 54, decoSizeMm: 10 },
      { diameterMm: 140, nameWidthMm: 130 },
      { fontId: 'archivo-black', name: 'Ana' },
      { fontId: 'great-vibes', name: 'Valentina' },
      { name: 'MARÍA', uppercase: true },
    ];
    for (const over of cases) {
      const it = check(await run(over), over);
      expect(it.sizeMm[0]).toBeCloseTo(over.diameterMm ?? 100, 0);
    }
  });

  it('el nombre corto no pasa del alto máximo (se limita)', async () => {
    const r = await run({ name: 'Al', fontId: 'archivo-black' });
    check(r, {});
    expect(r.messages.some((m) => m.code === 'ornament.nameShrunk')).toBe(true);
  });

  it('puntos de la i y tildes se unen: sin partes sueltas', async () => {
    for (const name of ['Sofía', 'Lucía', 'Íñigo', 'Mía', 'Jimena']) {
      const r = await run({ name, fontId: 'pacifico' });
      check(r, { name });
      expect(
        r.messages.some((m) => m.code === 'ornament.loose'),
        name,
      ).toBe(false);
    }
    // con la unión apagada los puntos quedarían sueltos y se avisa
    const off = await run({ name: 'Sofía', fontId: 'pacifico', bridgeLoose: false, decoration: 'none' });
    expect(off.messages.some((m) => m.code === 'ornament.loose')).toBe(true);
  });

  it('alturas: el nombre más bajo que el aro no lo pisa', async () => {
    const it = check(await run({ nameHeightMm: 2, thicknessMm: 3, barHeightMm: 1 }), {});
    expect(it.sizeMm[2]).toBeCloseTo(3, 0);
  });

  it('texto vacío → error ornament.empty sin geometría', async () => {
    const r = await run({ name: '   ' });
    expect(r.items).toEqual([]);
    expect(r.messages.some((m) => m.code === 'ornament.empty')).toBe(true);
  });

  it('presets y orderSummary funcionan', async () => {
    for (const preset of ornament.presets) {
      const over = { ...preset.params };
      check(await run(over), over);
    }
    const lines = ornament.orderSummary(defaults, { lang: 'es', color: (c) => c });
    expect(lines.map((l) => l[0])).toContain('Nombre');
  });

  it('normalizeParams nunca lanza y clampea', () => {
    expect(() => normalizeParams(null)).not.toThrow();
    const p = normalizeParams({ decoCount: 99, diameterMm: 'x', decoration: 'nope', nameWidthMm: -5, colors: { frame: 'zzz' } });
    expect(p.decoCount).toBe(4);
    expect(p.diameterMm).toBe(defaults.diameterMm);
    expect(p.decoration).toBe('snow');
    expect(p.nameWidthMm).toBe(20);
    expect(p.colors.frame).toBe(defaults.colors.frame);
  });

  it('todas las fuentes del catálogo generan una pieza válida', async () => {
    for (const f of catalog) {
      const over = { fontId: f.id, name: 'Sofía' };
      check(await run(over), over);
    }
  }, 60000);
});

describe('bridgeLoose (kernel)', () => {
  const sq = (x, y, w, h) => [
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
  ];
  it('une una isla chica con la pieza firme y no toca lo que ya está unido', () => {
    const sc = createScope();
    const t = sc.track;
    try {
      const base = t(new K.CrossSection(sq(0, 0, 20, 4), 'NonZero'));
      const dot = t(new K.CrossSection(sq(8, 14, 2, 2), 'NonZero'));
      const touching = t(new K.CrossSection(sq(2, 3, 10, 8), 'NonZero'));
      const shape = t(K.CrossSection.union([dot, touching]));
      const { bridges, count } = bridgeLoose(K, t, shape, base, { widthMm: 2 });
      expect(count).toBe(1);
      const joined = t(K.CrossSection.union([base, shape, bridges]));
      expect(joined.decompose().map(t).length).toBe(1);
      // sin islas sueltas no hace nada
      expect(bridgeLoose(K, t, touching, base).count).toBe(0);
    } finally {
      sc.dispose();
    }
  });
  it('no puentea una isla grande', () => {
    const sc = createScope();
    const t = sc.track;
    try {
      const base = t(new K.CrossSection(sq(0, 0, 20, 4), 'NonZero'));
      const big = t(new K.CrossSection(sq(30, 10, 20, 20), 'NonZero'));
      expect(bridgeLoose(K, t, big, base).count).toBe(0);
    } finally {
      sc.dispose();
    }
  });
});
