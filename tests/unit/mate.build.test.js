import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel } from './helpers.js';
import { build } from '../../src/tools/mate/build.js';
import { buildMate, insertRadius, pocketDepth } from '../../src/tools/mate/mate.js';
import { defaults, normalizeParams } from '../../src/tools/mate/params.js';
import mate from '../../src/tools/mate/index.js';
import { PATTERNS, PATTERN_DEFAULTS } from '../../src/core/kernel/surface.js';
import { scanOverhangs } from '../../src/core/kernel/analysis.js';

let K;
beforeAll(async () => {
  K = await initKernel();
});

const DRAFT = { curveQuality: 'draft' };
const run = (over = {}) => build(K, { ...defaults, ...DRAFT, ...over }, { printer: {} });
const codes = (r) => r.messages.map((m) => m.code);

function check(r, label) {
  expect(r.messages.filter((m) => m.level === 'error'), label).toEqual([]);
  const it = r.items[0];
  expect(it.merged.status, label).toBe('NoError');
  expect(it.merged.genus, `${label}: una sola cavidad, sin agujeros pasantes`).toBe(0);
  expect(it.parts[0].volumeMm3, label).toBeGreaterThan(0);
  expect(it.parts[0].positions.buffer).not.toBe(it.merged.positions.buffer);
  expect(it.parts[0].zMin, `${label} apoya en la cama`).toBeCloseTo(0, 3);
  return it;
}

/** El interior de aluminio como sólido de revolución, con el fondo a la altura `zBottom`. */
function insertSolid(p, zBottom) {
  const pts = [[0, 0]];
  const n = 200;
  for (let i = 0; i <= n; i++) {
    const y = (p.insertHeightMm * i) / n;
    pts.push([insertRadius(p, y), y]);
  }
  pts.push([0, p.insertHeightMm]);
  const cs = new K.CrossSection([pts], 'Positive');
  const m = K.Manifold.revolve(cs, 256).translate([0, 0, zBottom]);
  cs.delete();
  return m;
}

/** Grosor mínimo real de la pared de una pieza lisa de revolución: contorno del hueco contra el de afuera, cortes cada 0,5 mm. */
function minWall(solid, height) {
  const outer = [];
  const inner = [];
  for (let z = 0.25; z < height; z += 0.5) {
    const cs = solid.slice(z);
    const polys = cs.toPolygons();
    cs.delete();
    const rad = polys.map((q) => q.map(([x, y]) => Math.hypot(x, y)));
    outer.push([Math.max(...rad.flat()), z]);
    if (polys.length > 1) inner.push([Math.min(...rad.map((r) => Math.min(...r))), z]);
  }
  let min = Infinity;
  for (const [ri, zi] of inner) for (const [ro, zo] of outer) min = Math.min(min, Math.hypot(ro - ri, zo - zi));
  return min;
}

describe('mate', () => {
  it('por defecto: una pieza cerrada, con el alto pedido y sin avisos de error', async () => {
    const r = await run();
    const it = check(r, 'default');
    expect(r.items).toHaveLength(1);
    expect(it.sizeMm[2]).toBeCloseTo(defaults.heightMm, 1);
    expect(codes(r)).not.toContain('mate.overhang');
    expect(codes(r)).not.toContain('mate.reshaped');
    expect(codes(r)).toContain('mate.measure');
  });

  it('todas las texturas y las cuatro formas dan mallas cerradas', async () => {
    for (const pattern of PATTERNS) {
      for (const profile of ['curve', 'straight', 'vase', 'follow']) check(await run({ pattern, profile }), `${pattern}/${profile}`);
    }
  });

  it('el hueco es el negativo del interior: radio justo, juego vertical y pared mínima', () => {
    const p = normalizeParams({ ...defaults, pattern: 'smooth', clearanceMm: 0.2 });
    const { solid, zFloor, zInsert, heightMm } = buildMate(K, p, { segments: 256, dz: 1 });
    for (let y = 0.5; y < p.insertHeightMm; y += 3.5) {
      const cut = solid.slice(zInsert + y);
      const bb = cut.bounds();
      // el contorno más chico es el del hueco: su radio no puede ser menor que el del interior ni pasarse de la holgura
      const inner = cut
        .toPolygons()
        .map((q) => Math.min(...q.map(([x, yy]) => Math.hypot(x, yy))))
        .reduce((m, v) => Math.min(m, v), Infinity);
      expect(inner, `y=${y}`).toBeGreaterThanOrEqual(insertRadius(p, y) - 0.05);
      expect(inner, `y=${y}`).toBeLessThan(insertRadius(p, y) + p.clearanceMm + 0.2);
      const outer = Math.max(Math.abs(bb.min[0]), Math.abs(bb.max[0]));
      expect(outer - inner, `pared horizontal a y=${y}`).toBeGreaterThanOrEqual(p.wallMm - 0.15);
      cut.delete();
    }
    expect(zInsert).toBeCloseTo(heightMm - p.insertHeightMm, 6);
    expect(zInsert - zFloor, 'juego vertical bajo el fondo').toBeCloseTo(p.clearanceMm, 6);
    solid.delete();
  });

  it('el interior virtual entra sin chocar y la pared real se respeta, en todos los presets y los dos bordes', () => {
    for (const preset of [{ id: 'default', params: {} }, ...mate.presets]) {
      for (const rimMode of ['flush', 'rest']) {
        const p = normalizeParams({ ...defaults, ...preset.params, rimMode, pattern: 'smooth' });
        const label = `${preset.id}/${rimMode}`;
        const m = buildMate(K, p, { segments: 256, dz: 1 });
        const insert = insertSolid(p, m.zInsert);
        const hit = m.solid.intersect(insert);
        expect(hit.volume(), `${label}: el interior no puede pisar el mate`).toBeLessThan(0.5);
        // sobresale del mate solo lo que dice el modo
        expect(insert.boundingBox().max[2] - m.heightMm, label).toBeCloseTo(rimMode === 'rest' ? p.rimLipMm : 0, 3);
        expect(pocketDepth(p) + p.clearanceMm + m.zFloor, label).toBeCloseTo(m.heightMm, 6);
        // con las formas de fábrica nunca hace falta ensanchar la silueta
        expect(m.reshaped, label).toBe(false);
        // pared REAL (perpendicular, no solo horizontal): distancia mínima entre la cara del hueco y la de afuera
        expect(minWall(m.solid, m.heightMm), `${label}: pared real`).toBeGreaterThanOrEqual(p.wallMm - 0.3);
        hit.delete();
        insert.delete();
        m.solid.delete();
      }
    }
  });

  it('sin soportes: ninguna cara pasa del ángulo elegido, con cualquier forma y textura', async () => {
    for (const overhangDeg of [40, 30]) {
      const limit = -Math.sin(((overhangDeg + 0.5) * Math.PI) / 180);
      for (const pattern of PATTERNS) {
        for (const profile of ['curve', 'straight', 'vase', 'follow']) {
          const over = { ...PATTERN_DEFAULTS[pattern], pattern, profile, overhangDeg, heightMm: 120 };
          const r = await run(over);
          const it = check(r, JSON.stringify(over));
          const { fraction, worstDeg } = scanOverhangs(it.merged.positions, it.merged.indices, 1.3, limit);
          expect(fraction, `${JSON.stringify(over)}: peor ${worstDeg}°`).toBe(0);
          expect(codes(r), JSON.stringify(over)).not.toContain('mate.overhang');
        }
      }
    }
  });

  it('sin la opción, las burbujas y la forma ajustada sí vuelan (y avisa)', async () => {
    const r = await run({ ...PATTERN_DEFAULTS.bubbles, pattern: 'bubbles', profile: 'follow', selfSupport: false });
    expect(codes(r)).toContain('mate.overhang');
    const on = await run({ ...PATTERN_DEFAULTS.bubbles, pattern: 'bubbles', profile: 'follow' });
    expect(codes(on)).toContain('mate.selfSupport');
    expect(on.items[0].parts[0].volumeMm3).toBeGreaterThan(r.items[0].parts[0].volumeMm3);
  });

  it('con el borde apoyado encima, el hueco es más corto y el interior sobresale', async () => {
    const flush = await run({ rimMode: 'flush' });
    const rest = await run({ rimMode: 'rest', rimLipMm: 3 });
    expect(rest.items[0].parts[0].volumeMm3).toBeGreaterThan(flush.items[0].parts[0].volumeMm3);
    const p = normalizeParams({ ...defaults, rimMode: 'rest', rimLipMm: 3 });
    const m = buildMate(K, p, { segments: 144, dz: 2 });
    expect(m.zInsert + p.insertHeightMm).toBeCloseTo(m.heightMm + 3, 6);
    m.solid.delete();
  });

  it('si el mate pedido es más bajo que el interior se sube y se avisa', async () => {
    const r = await run({ heightMm: 50 });
    check(r, 'bajo');
    expect(codes(r)).toContain('mate.heightRaised');
    expect(r.items[0].sizeMm[2]).toBeCloseTo(defaults.insertHeightMm + defaults.clearanceMm + 3, 1);
  });

  it('una silueta angosta se ensancha sola para dejar la pared', async () => {
    const r = await run({ profile: 'straight', bottomDiameterMm: 40, topDiameterMm: 40, pattern: 'smooth' });
    check(r, 'angosta');
    expect(codes(r)).toContain('mate.reshaped');
    const p = normalizeParams({ ...defaults, ...DRAFT });
    expect(r.items[0].sizeMm[0]).toBeGreaterThanOrEqual(p.insertMouthDiameterMm + 2 * (p.clearanceMm + p.wallMm) - 0.5);
  });

  it('si la silueta queda corta, el ensanche es gradual: no queda un labio fino en el borde de arriba', () => {
    for (const top of [92, 90, 88, 84, 80]) {
      const p = normalizeParams({ ...defaults, pattern: 'smooth', profile: 'straight', bottomDiameterMm: top, topDiameterMm: top });
      const m = buildMate(K, p, { segments: 256, dz: 1 });
      let prev = null;
      for (let dz = 15; dz >= 0.25; dz -= 0.5) {
        const cs = m.solid.slice(m.heightMm - dz);
        const r = cs.bounds().max[0];
        cs.delete();
        // el radio crece como mucho ~0,12 mm por mm (7°); antes saltaba hasta 0,8 mm en el último milímetro
        if (prev !== null) expect(r - prev, `Ø${top} a ${dz} mm del borde`).toBeLessThan(0.5 * 0.12 + 0.03);
        prev = r;
      }
      m.solid.delete();
    }
  });

  it('interiores raros no rompen: normaliza y construye', async () => {
    for (const over of [
      { insertFlareHeightMm: 500, insertHeightMm: 31, insertBaseRadiusMm: 10 },
      { insertMouthDiameterMm: 10 },
      { insertHeightMm: 150, insertBaseDiameterMm: 120, insertBodyDiameterMm: 120, insertMouthDiameterMm: 140, rimMode: 'rest', rimLipMm: 8 },
      { clearanceMm: 0, insertBaseRadiusMm: 0 },
      { clearanceMm: 1.5, wallMm: 1.2, profile: 'follow' },
      { insertBaseDiameterMm: 20, insertBaseRadiusMm: 10 },
      { insertHeightMm: 'x', clearanceMm: NaN, wallMm: null },
    ]) {
      check(await run(over), JSON.stringify(over));
    }
  });

  it('presets, resumen del pedido y avisos de uso', async () => {
    for (const preset of mate.presets) check(await run(preset.params), preset.id);
    const rows = mate.orderSummary(defaults, { lang: 'es', color: (c) => c, option: (k, v) => v });
    expect(rows.map((r) => r[0])).toEqual(['Forma', 'Textura', 'Alto', 'Borde del interior', 'Color']);
    expect(codes(await run())).toContain('mate.use');
  });
});
