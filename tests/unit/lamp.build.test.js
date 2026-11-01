import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel } from './helpers.js';
import { build } from '../../src/tools/lamp/build.js';
import { buildShade } from '../../src/tools/lamp/shade.js';
import { buildBase } from '../../src/tools/lamp/base.js';
import { defaults, normalizeParams } from '../../src/tools/lamp/params.js';
import { THREAD, SEAT_Z } from '../../src/tools/lamp/thread.js';
import { profileRadius, surfaceRadius, patternSegments, ringStep, gridPhase, COUNT_PATTERNS } from '../../src/core/kernel/surface.js';
import { insetRing, polarRing } from '../../src/core/kernel/rings.js';
import lamp from '../../src/tools/lamp/index.js';

let K;
beforeAll(async () => {
  K = await initKernel();
});

const DRAFT = { curveQuality: 'draft' };
const run = (over = {}) => build(K, { ...defaults, ...DRAFT, ...over }, { printer: {} });
const codes = (r) => r.messages.map((m) => m.code);

function check(r, label) {
  expect(r.messages.filter((m) => m.level === 'error'), label).toEqual([]);
  for (const it of r.items) {
    expect(it.merged.status, `${label} ${it.key}`).toBe('NoError');
    expect(it.parts[0].volumeMm3, `${label} ${it.key}`).toBeGreaterThan(0);
    expect(it.parts[0].positions.buffer).not.toBe(it.merged.positions.buffer);
    expect(it.parts[0].zMin, `${label} ${it.key} apoya en la cama`).toBeCloseTo(0, 3);
  }
  return Object.fromEntries(r.items.map((it) => [it.key, it]));
}

/** Manifold de la pantalla y la base sueltas (sin pasar por la malla del item). */
function pieces(over = {}) {
  const p = normalizeParams({ ...defaults, ...over });
  const density = { segments: 256, dz: 3 };
  const sh = buildShade(K, p, density);
  const { base } = buildBase(K, (o) => o, p, density);
  return { p, sh, base };
}

describe('lámpara', () => {
  it('por defecto: pantalla (tubo con rosca) y base, cerradas y lado a lado', async () => {
    const r = await run();
    const { shade, base } = check(r, 'default');
    expect(r.items.map((i) => i.key)).toEqual(['shade', 'base']);
    expect(shade.merged.genus).toBe(1); // abierta arriba y abajo
    expect(shade.sizeMm[2]).toBeCloseTo(defaults.heightMm, 1);
    expect(base.sizeMm[0]).toBeCloseTo(116, 1);
    expect(base.sizeMm[2]).toBeCloseTo(defaults.socketHeightMm, 1);
    // para imprimir no se pisan; en el visor la pantalla queda enroscada sobre la base
    const gap = shade.offsetXY[0] + shade.sizeMm[0] / 2 <= base.offsetXY[0] - base.sizeMm[0] / 2 + 1e-6;
    expect(gap).toBe(true);
    expect(shade.viewOffset).toEqual([0, 0, SEAT_Z]);
    expect(base.viewOffset).toEqual([0, 0, 0]);
    expect(codes(r)).not.toContain('lamp.overhang');
  });

  it('todas las texturas, en pared y en modo vaso, dan mallas cerradas', async () => {
    for (const pattern of ['smooth', 'waves', 'ribs', 'facets', 'rings', 'bubbles', 'zigzag', 'star', 'scales', 'lattice', 'honeycomb', 'diamonds', 'fluted']) {
      for (const shadeMode of ['wall', 'vase']) {
        const over = { pattern, shadeMode, parts: 'shade' };
        check(await run(over), JSON.stringify(over));
      }
    }
  });

  it('perfil florero: el tramo recto del medio tiene el diámetro pedido (con 100 estrías finas)', async () => {
    const over = { profile: 'vase', bottomDiameterMm: 116, midDiameterMm: 160, topDiameterMm: 120, heightMm: 200, pattern: 'waves', patternCount: 100, patternDepthMm: 1, parts: 'shade' };
    const { shade } = check(await run(over), JSON.stringify(over));
    expect(shade.sizeMm[0]).toBeCloseTo(162, 0); // 160 del fondo de las estrías + 1 mm de relieve por lado
  });

  it('modo vaso: una sola pieza maciza con la rosca integrada (sin aro aparte)', async () => {
    const r = await run({ shadeMode: 'vase' });
    const { shade } = check(r, 'vase');
    expect(r.items.map((i) => i.key)).toEqual(['shade', 'base']);
    expect(shade.merged.genus).toBe(0);
    expect(shade.viewOffset).toEqual([0, 0, SEAT_Z]);
    expect(shade.sizeMm[2]).toBeCloseTo(defaults.heightMm, 1);
    // el peso sale de la pared en espiral, no del macizo
    expect(shade.parts[0].volumeMm3).toBeLessThan(shade.merged.volumeMm3 / 10);
    expect(shade.parts[0].volumeMm3).toBeGreaterThan(10000);
    expect(codes(r)).not.toContain('lamp.overhang');
  });

  it('modo vaso: la rosca macho es la misma que en modo pared (entra en la base igual)', () => {
    const wall = pieces().sh;
    const { sh } = pieces({ shadeMode: 'vase' });
    // el contorno exterior del cuello es el mismo: el macizo cubre todo el tubo roscado del modo pared
    for (const z of [0.5, THREAD.neckTopZ / 2, THREAD.neckTopZ - 0.5]) {
      expect(wall.shade.slice(z).subtract(sh.shade.slice(z)).area(), `z=${z}`).toBeLessThan(0.01);
      expect(sh.shade.slice(z).area()).toBeGreaterThan(wall.shade.slice(z).area());
    }
  });

  it('alto insuficiente: la pantalla se alarga con aviso en vez de salir plegada', async () => {
    // base ancha o textura profunda: el cuello se abre 45° y se come el alto
    for (const over of [{ heightMm: 60, bottomDiameterMm: 240 }, { heightMm: 60, pattern: 'facets', patternCount: 3 }, { heightMm: 60, patternDepthMm: 15, bottomDiameterMm: 200 }]) {
      const r = await run({ ...over, parts: 'shade' });
      const { shade } = check(r, JSON.stringify(over));
      expect(codes(r), JSON.stringify(over)).toContain('lamp.heightRaised');
      expect(shade.sizeMm[2]).toBeGreaterThan(over.heightMm);
      expect(shade.sizeMm[2]).toBeCloseTo(r.info.bodyZ0 + 20, 1);
      expect(shade.merged.volumeMm3).toBeGreaterThan(0);
    }
    // en modo vaso la pantalla no sale con volumen negativo
    const v = await run({ heightMm: 60, bottomDiameterMm: 240, shadeMode: 'vase', parts: 'shade' });
    expect(check(v, 'vase').shade.merged.volumeMm3).toBeGreaterThan(0);
    // con alto suficiente, no avisa y respeta el alto pedido
    const ok = await run({ parts: 'shade' });
    expect(codes(ok)).not.toContain('lamp.heightRaised');
    expect(ok.items[0].sizeMm[2]).toBeCloseTo(defaults.heightMm, 1);
  });

  it('texturas finas en una pieza alta no pasan el tope de triángulos', async () => {
    const r = await build(K, { ...defaults, parts: 'shade', pattern: 'bubbles', patternCount: 64, patternPeriodMm: 6, heightMm: 320, curveQuality: 'high' }, { printer: {} });
    check(r, 'burbujas finas');
    expect(r.info.triangles).toBeLessThan(1_100_000);
  });

  it('con varias piezas informa la medida de cada una; con una sola, no', async () => {
    const both = await run();
    expect(both.info.pieceSizes.map((p) => p.key)).toEqual(['shade', 'base']);
    expect(both.info.pieceSizes[1].sizeMm[0]).toBeCloseTo(116, 1);
    expect((await run({ parts: 'base' })).info.pieceSizes).toBeNull();
  });

  it('la rosca entra: enroscada no choca, y el cuello apoya en el aro a la altura de asiento', () => {
    const { sh, base } = pieces();
    // giro que alinea la hélice de la pantalla con la de la base a esa altura
    const phi = (360 * SEAT_Z) / THREAD.pitch;
    const at = (dz) => base.intersect(sh.shade.rotate([0, 0, phi]).translate([0, 0, SEAT_Z + dz])).volume();
    expect(at(0.02)).toBeLessThan(0.5);
    expect(at(-0.3)).toBeGreaterThan(1);
    // la pantalla no toca el piso de la base
    expect(SEAT_Z).toBeGreaterThan(THREAD.floorMm);
  });

  it('holgura positiva afina la rosca macho', () => {
    const tight = pieces({ threadFitMm: 0 }).sh.shade.volume();
    const loose = pieces({ threadFitMm: 0.4 }).sh.shade.volume();
    expect(loose).toBeLessThan(tight);
  });

  it('piezas sueltas: solo base, solo pantalla', async () => {
    const b = await run({ parts: 'base' });
    expect(Object.keys(check(b, 'base'))).toEqual(['base']);
    expect(codes(b)).toContain('lamp.screw');
    const s = await run({ parts: 'shade' });
    expect(Object.keys(check(s, 'shade'))).toEqual(['shade']);
    const plain = await run({ parts: 'base', clampScrew: false });
    expect(check(plain, 'sin abrazadera').base.parts[0].volumeMm3).toBeLessThan(b.items[0].parts[0].volumeMm3);
  });

  it('avisos: voladizo, lamparita apretada, pared fina', async () => {
    expect(codes(await run({ pattern: 'zigzag', patternPeriodMm: 10 }))).toContain('lamp.overhang');
    expect(codes(await run({ profile: 'straight', topDiameterMm: 50, heightMm: 150, pattern: 'smooth' }))).toContain('lamp.bulbTight');
    expect(codes(await run({ heightMm: 80 }))).toContain('lamp.bulbShows');
    expect(codes(await run({ wallMm: 0.6 }))).toContain('lamp.thinWall');
  });

  it('los presets se imprimen sin soportes', async () => {
    for (const preset of lamp.presets) {
      const r = await run(preset.params);
      check(r, preset.id);
      expect(codes(r), preset.id).not.toContain('lamp.overhang');
    }
  });

  it('normalizeParams nunca lanza y clampea', () => {
    expect(() => normalizeParams(null)).not.toThrow();
    const p = normalizeParams({ parts: 'x', pattern: 'y', heightMm: 9999, bottomDiameterMm: 10, patternCount: 3.6, wallMm: 'abc', colors: { shade: 'zz' } });
    expect(p.parts).toBe('both');
    expect(p.pattern).toBe(defaults.pattern);
    expect(p.heightMm).toBe(320);
    expect(p.bottomDiameterMm).toBe(112);
    expect(p.patternCount).toBe(4);
    expect(p.wallMm).toBe(defaults.wallMm);
    expect(p.colors.shade).toBe(defaults.colors.shade);
  });

  describe('calidad de la malla', () => {
    /**
     * Cuánto se aparta la malla real de la superficie exacta de la textura: se toma el centro de cada triángulo del cuerpo (en
     * modo vaso, que es una sola cara) y se compara su radio con el que da la fórmula en ese ángulo y esa altura.
     */
    async function deviation(preset, curveQuality) {
      const raw = { ...defaults, ...preset.params, parts: 'shade', shadeMode: 'vase', curveQuality };
      const r = await build(K, raw, { printer: {} });
      const p = normalizeParams(raw);
      const { positions: P, indices: I } = r.items[0].merged;
      const z0 = r.info.bodyZ0;
      const bodyH = r.items[0].sizeMm[2] - z0;
      let max = 0;
      for (let k = 0; k < I.length; k += 3) {
        const [a, b, c] = [I[k] * 3, I[k + 1] * 3, I[k + 2] * 3];
        const x = (P[a] + P[b] + P[c]) / 3;
        const y = (P[a + 1] + P[b + 1] + P[c + 1]) / 3;
        const zp = (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - z0;
        // solo el cuerpo: sin el cuello ni las tapas
        if (zp < 3 || zp > bodyH - 3) continue;
        const t = zp / bodyH;
        const exact = surfaceRadius(p, profileRadius(p, t), Math.atan2(y, x), zp, t);
        max = Math.max(max, Math.abs(Math.hypot(x, y) - exact));
      }
      return max;
    }
    const preset = (id) => lamp.presets.find((x) => x.id === id);

    it('en calidad alta las aristas de cada diseño caen sobre los vértices: la malla queda a menos de 0,1 mm de la superficie exacta', async () => {
      // antes de alinear la grilla con el giro y el período de la textura, los picos se apartaban 0,47 mm; los diamantes, 0,30; el globo, 0,31
      for (const id of ['star', 'cylinder', 'globe', 'zigzag', 'scales', 'twist', 'lattice', 'diamonds', 'honeycomb', 'sophie']) {
        expect(await deviation(preset(id), 'high'), id).toBeLessThan(0.1);
      }
    }, 120000);

    it('la calidad máxima afina más que la alta (y sigue dando mallas cerradas)', async () => {
      for (const id of ['twist', 'zigzag', 'diamonds']) {
        const [hi, ultra] = [await deviation(preset(id), 'high'), await deviation(preset(id), 'ultra')];
        expect(ultra, id).toBeLessThan(hi);
      }
      const high = await build(K, { ...defaults, parts: 'shade', curveQuality: 'high' }, { printer: {} });
      const ultra = await build(K, { ...defaults, parts: 'shade', curveQuality: 'ultra' }, { printer: {} });
      check(ultra, 'máxima');
      expect(ultra.info.triangles).toBeGreaterThan(high.info.triangles * 1.5);
      expect(ultra.info.triangles).toBeLessThan(2_400_000);
      expect(normalizeParams({ curveQuality: 'ultra' }).curveQuality).toBe('ultra');
      const quality = lamp.schema.flatMap((sec) => sec.controls).find((c) => c.key === 'curveQuality');
      expect(quality.options.map(([v]) => v)).toEqual(['draft', 'normal', 'high', 'ultra']);
    }, 120000);

    it('vértices por vuelta: un número par por repetición (cresta y valle en un vértice) para todas las texturas con cantidad', () => {
      for (const pattern of COUNT_PATTERNS) {
        for (const patternCount of [3, 7, 10, 18, 24, 100, 160]) {
          const p = normalizeParams({ pattern, patternCount });
          const S = patternSegments(p, 384);
          expect(S % (2 * p.patternCount), `${pattern} ×${patternCount}`).toBe(0);
          expect(S).toBeLessThanOrEqual(1536);
        }
      }
    });

    it('la grilla acompaña el giro: en t = 0 no gira y arriba gira lo mismo que la textura; sin giro o sin cantidad, fija', () => {
      const p = normalizeParams({ pattern: 'ribs', twistDeg: 180 });
      expect(gridPhase(p, 0)).toBe(0);
      expect(gridPhase(p, 1)).toBeCloseTo(Math.PI, 12);
      expect(gridPhase(normalizeParams({ pattern: 'rings', twistDeg: 180 }), 1)).toBe(0);
      // con la grilla girada, la cresta cae en el vértice 0 a cualquier altura
      const S = patternSegments(p, 384);
      for (const t of [0, 0.37, 1]) {
        const ring = polarRing(S, (a) => surfaceRadius(p, 50, a, 0, t), gridPhase(p, t));
        const r = Array.from({ length: S }, (_, j) => Math.hypot(ring[j * 2], ring[j * 2 + 1]));
        expect(Math.max(...r), `t=${t}`).toBeCloseTo(50 + p.patternDepthMm, 9);
        expect(r[0], `t=${t}`).toBeCloseTo(50 + p.patternDepthMm, 9);
      }
    });

    it('insetRing con fase: el anillo de adentro conserva la grilla del de afuera', () => {
      const S = 64;
      const phase = 0.7;
      const ring = polarRing(S, () => 40, phase);
      const inner = insetRing(K, ring, 2, phase);
      for (const j of [0, 5, 31, 63]) {
        const [x, y] = [inner[j * 2], inner[j * 2 + 1]];
        const want = phase + (2 * Math.PI * j) / S;
        const diff = Math.atan2(Math.sin(want - Math.atan2(y, x)), Math.cos(want - Math.atan2(y, x)));
        expect(Math.abs(diff), `vértice ${j}`).toBeLessThan(1e-6);
        expect(Math.hypot(x, y)).toBeCloseTo(38, 1);
      }
    });

    it('anillos del cuerpo: las texturas verticales van sobre su grilla (escamas cada P/20, enrejado en la diagonal) y el resto, parejo', () => {
      const frac = (x) => Math.abs(x - Math.round(x));
      const scales = normalizeParams({ pattern: 'scales', patternPeriodMm: 16 });
      const step = ringStep(scales, 384, 0.8);
      expect(step).toBeLessThanOrEqual(0.8);
      expect(frac(16 / step / 20)).toBeLessThan(1e-9);
      const lattice = normalizeParams({ pattern: 'lattice', patternCount: 12, patternPeriodMm: 40 });
      const S = patternSegments(lattice, 384);
      const cell = (40 * 12) / S;
      expect(frac(cell / ringStep(lattice, S, 0.8))).toBeLessThan(1e-9);
      expect(ringStep(normalizeParams({ pattern: 'waves' }), 384, 0.8)).toBe(0.8);
    });

    it('avisa cuando el tope de triángulos obliga a simplificar el dibujo vertical, y no avisa con estrías rectas ni con los diseños de ejemplo', async () => {
      const fine = await build(K, { ...defaults, parts: 'shade', pattern: 'bubbles', patternCount: 64, patternPeriodMm: 6, heightMm: 320, curveQuality: 'high' }, { printer: {} });
      expect(codes(fine)).toContain('lamp.meshCapped');
      for (const pr of lamp.presets) {
        const r = await build(K, { ...defaults, ...pr.params, parts: 'shade', curveQuality: 'high' }, { printer: {} });
        expect(codes(r), pr.id).not.toContain('lamp.meshCapped');
      }
    }, 120000);
  });
});
