import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel } from './helpers.js';
import { build } from '../../src/tools/desk/build.js';
import { defaults, normalizeParams } from '../../src/tools/desk/params.js';
import { layoutDesk } from '../../src/tools/desk/layout.js';
import { scanOverhangs } from '../../src/core/kernel/analysis.js';
import desk from '../../src/tools/desk/index.js';

let K;
beforeAll(async () => {
  K = await initKernel();
});

const ctx = (extra = {}) => ({ printer: {}, ...extra });
const run = (over = {}, extra = {}) => build(K, { ...defaults, curveQuality: 'draft', ...over }, ctx(extra));
const codes = (r) => r.messages.map((m) => m.code);
const rad = (deg) => (deg * Math.PI) / 180;

/** La pieza como Manifold (las partes unidas). */
function solidOf(item) {
  const parts = item.parts.map((p) => new K.Manifold(new K.Mesh({ numProp: 3, vertProperties: Float32Array.from(p.positions), triVerts: p.indices })));
  return parts.length === 1 ? parts[0] : K.Manifold.union(parts);
}

/** Perfil (y, z) extruido a lo largo de X, de x0 a x1: como la placa del soporte. */
const alongX = (points, x0, x1) => new K.CrossSection([points], 'NonZero').extrude(x1 - x0).rotate([90, 0, 90]).translate([x0, 0, 0]);

function checkItem(it, label, genus = 0) {
  expect(it.merged.status, label).toBe('NoError');
  expect(it.merged.genus, label).toBe(genus);
  for (const p of it.parts) {
    expect(p.status, `${label} ${p.colorKey}`).toBe('NoError');
    expect(p.volumeMm3, `${label} ${p.colorKey}`).toBeGreaterThan(0);
  }
  const sum = it.parts.reduce((s, p) => s + p.volumeMm3, 0);
  expect(Math.abs(sum - it.merged.volumeMm3) / it.merged.volumeMm3, label).toBeLessThan(0.002);
  return it;
}

function check(r, label, genus = 0) {
  expect(r.messages.filter((m) => m.level === 'error'), label).toEqual([]);
  expect(r.items.length, label).toBe(1);
  return checkItem(r.items[0], label, genus);
}

function bounds(part) {
  const P = part.positions;
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) (mn[k] = Math.min(mn[k], P[i + k])), (mx[k] = Math.max(mx[k], P[i + k]));
  return { mn, mx };
}

/** Con el túnel pasante (soporte solo, sin la pared de la taza que lo cierre de un lado) la pieza tiene un agujero de lado a lado: género 1. */
const genusOf = (o) => {
  const l = layoutDesk(normalizeParams({ ...defaults, ...o }));
  return l.stand && !l.cup && l.stand.cavity ? 1 : 0;
};

describe('organizador de escritorio: piezas', () => {
  it('por defecto: una sola pieza de un solo color, apoyada en la cama, con las medidas del modelo de referencia', async () => {
    const r = await run();
    const it = check(r, 'defecto');
    expect(it.parts.map((p) => p.colorKey)).toEqual(['base']);
    expect(bounds(it.parts[0]).mn[2]).toBeCloseTo(0, 3);
    // 6,5 × 3,25 × 3,2 pulgadas (la altura se alinea a la capa)
    expect(it.sizeMm[0]).toBeCloseTo(165.1, 1);
    expect(it.sizeMm[1]).toBeCloseTo(82.55, 1);
    expect(it.sizeMm[2]).toBeCloseTo(81.28, 0);
    expect(r.info.sizeMm[0]).toBeCloseTo(165.1, 1);
    expect(r.info.needsMMU).toBe(false);
    expect(codes(r)).not.toContain('size.bedOverflow');
  });

  for (const phoneSide of ['left', 'right']) {
    for (const [pens, phone] of [[true, true], [true, false], [false, true]]) {
      for (const cupDividers of [0, 2]) {
        it(`celular ${phoneSide}, lapicero ${pens}, soporte ${phone}, divisiones ${cupDividers}: pieza válida de una sola isla`, async () => {
          const over = { phoneSide, pens, phone, cupDividers };
          const it = check(await run(over), 'matriz', genusOf(over));
          expect(bounds(it.parts[0]).mn[2]).toBeCloseTo(0, 3);
          const l = layoutDesk(normalizeParams({ ...defaults, ...over }));
          expect(it.sizeMm[0]).toBeCloseTo(l.width, 1);
          expect(it.sizeMm[1]).toBeCloseTo(l.depth, 1);
        });
      }
    }
  }

  it('el celular va del lado pedido: el labio del soporte queda en la mitad positiva o negativa de X', async () => {
    // un trozo del labio (por encima de la base y por debajo de su tope), recortado a cada mitad de la pieza
    const lipVolume = async (phoneSide) => {
      const over = { phoneSide, snapToLayers: false };
      const body = solidOf(check(await run(over), phoneSide));
      const s = layoutDesk(normalizeParams({ ...defaults, ...over })).stand;
      const slab = (x0, x1) => K.Manifold.cube([x1 - x0, defaults.wallMm - 1, 3]).translate([x0, s.shiftY + 0.5, defaults.baseMm + 1]).intersect(body).volume();
      // por dentro de la taza, a esa altura y a ese fondo, no hay nada: solo el labio puede dar volumen
      return { pos: slab(20, 60), neg: slab(-60, -20) };
    };
    const right = await lipVolume('right');
    const left = await lipVolume('left');
    expect(right.pos).toBeGreaterThan(100);
    expect(right.neg).toBeLessThan(0.001);
    expect(left.neg).toBeGreaterThan(100);
    expect(left.pos).toBeLessThan(0.001);
    // la pieza en espejo es igual de grande
    const a = (await run({ phoneSide: 'right', snapToLayers: false })).items[0];
    const b = (await run({ phoneSide: 'left', snapToLayers: false })).items[0];
    expect(b.merged.volumeMm3).toBeCloseTo(a.merged.volumeMm3, 0);
  });

  it('lapicero: la taza es hueca hasta la base, con paredes de la medida pedida', async () => {
    const over = { phone: false, snapToLayers: false };
    const body = solidOf(check(await run(over), 'taza'));
    const iw = defaults.cupWidthMm - 2 * defaults.wallMm;
    const id = defaults.cupDepthMm - 2 * defaults.wallMm;
    const inside = (w, d) => K.Manifold.cube([w, d, 70]).translate([-w / 2, -d / 2, defaults.baseMm + 0.01]);
    // un hueco más chico que el interior (que deja aire en las esquinas redondeadas) no toca nada, ni siquiera el fondo
    expect(body.intersect(inside(iw - 10, id - 10)).volume()).toBeLessThan(0.01);
    // y uno 2 mm más ancho que el interior ya pisa las paredes
    expect(body.intersect(inside(iw + 2, id - 10)).volume()).toBeGreaterThan(50);
  });

  it('divisiones: cada una agrega un compartimiento, de la altura de la taza', async () => {
    for (const n of [0, 1, 2, 3]) {
      const it = check(await run({ phone: false, cupDividers: n }), `${n} divisiones`);
      const m = solidOf(it);
      // a media altura: el contorno de afuera y un hueco por compartimiento
      expect(m.slice(40).toPolygons().length, `${n} divisiones`).toBe(n + 2);
      // y siguen hasta arriba
      expect(m.slice(defaults.cupHeightMm - 1).toPolygons().length, `${n} divisiones, arriba`).toBe(n + 2);
    }
    const plain = check(await run({ phone: false, cupDividers: 0 }), 'sin');
    const two = check(await run({ phone: false, cupDividers: 2 }), 'dos');
    expect(two.merged.volumeMm3).toBeGreaterThan(plain.merged.volumeMm3 + 5000);
  });

  it('divisiones: con una taza angosta se limitan y avisan', async () => {
    const r = await run({ phone: false, cupWidthMm: 40, cupDividers: 3 });
    check(r, 'angosta');
    expect(codes(r)).toContain('desk.dividersLimited');
  });

  it('soporte: la ranura sale sin soportes con 0°, 15° y 30°, y un celular simulado entra sin pisar la pieza', async () => {
    for (const phoneAngleDeg of [0, 15, 30]) {
      const over = { phoneAngleDeg, snapToLayers: false };
      const it = check(await run(over), `soporte ${phoneAngleDeg}`);
      const P = it.parts[0];
      const { fraction, worstDeg } = scanOverhangs(P.positions, P.indices, 0.5, -0.75);
      expect(fraction, `${phoneAngleDeg}°`).toBe(0);
      expect(worstDeg, `${phoneAngleDeg}°`).toBeLessThanOrEqual(46);

      // un celular (con funda, 0,6 mm menos que la ranura) apoyado en el fondo, delante de la placa
      const l = layoutDesk(normalizeParams({ ...defaults, ...over }));
      const s = l.stand;
      const a = rad(phoneAngleDeg);
      const B = defaults.baseMm;
      const yF = s.yF + s.shiftY; // pie de la cara de adelante de la placa
      const z0 = B + 0.05;
      const back = (z) => yF + (z - B) * Math.tan(a) - 0.05; // 0,05 mm delante de la placa
      const front = (z) => back(z) - (defaults.phoneSlotMm - 0.6) / Math.cos(a);
      const zt = z0 + 100;
      const xc = (s.x0 + s.x1) / 2;
      const phone = alongX([[front(z0), z0], [back(z0), z0], [back(zt), zt], [front(zt), zt]], xc - 35, xc + 35);
      expect(phone.volume()).toBeGreaterThan(1000);
      expect(solidOf(it).intersect(phone).volume(), `celular ${phoneAngleDeg}°`).toBeLessThan(0.01);

      // un celular 2 mm más grueso que la ranura ya no entra
      const fat = alongX([[front(z0) - 2, z0], [back(z0), z0], [back(zt), zt], [front(zt) - 2, zt]], xc - 35, xc + 35);
      expect(solidOf(it).intersect(fat).volume(), `celular grueso ${phoneAngleDeg}°`).toBeGreaterThan(0.5);
    }
  });

  it('soporte: el túnel sale por el extremo libre, lo cierra la pared de la taza y desaparece con poca inclinación', async () => {
    for (const phoneSide of ['right', 'left']) {
      const over = { phoneSide, snapToLayers: false };
      const body = solidOf(check(await run(over), `túnel ${phoneSide}`));
      const l = layoutDesk(normalizeParams({ ...defaults, ...over }));
      const s = l.stand;
      expect(s.cavity).not.toBeNull();
      // un cubito de 1 mm en el medio del túnel, a 10 mm de altura
      const z = 10;
      const yc = (s.yF + s.th + (z - defaults.baseMm) * Math.tan(rad(defaults.phoneAngleDeg)) + s.yW - defaults.wallMm) / 2 + s.shiftY;
      const probe = (x) => K.Manifold.cube([1, 1, 1]).translate([x - 0.5, yc - 0.5, z - 0.5]).intersect(body).volume();
      const free = phoneSide === 'right' ? s.x1 - 5 : s.x0 + 5; // extremo libre
      const toCup = phoneSide === 'right' ? s.x0 + 5 : s.x1 - 5; // contra la taza
      expect(probe(free), `${phoneSide}: libre`).toBeLessThan(0.001);
      expect(probe(toCup), `${phoneSide}: contra la taza`).toBeLessThan(0.001);
      // dentro de la pared de la taza no hay túnel
      const cupWall = phoneSide === 'right' ? l.cup.x1 - 1.5 : l.cup.x0 + 1.5;
      expect(probe(cupWall), `${phoneSide}: pared`).toBeCloseTo(1, 3);
    }
    // sola, la placa y el respaldo se separan a media altura del túnel; arriba de él, la cuña es maciza
    const alone = check(await run({ pens: false, snapToLayers: false }), 'sola', 1);
    expect(solidOf(alone).slice(15).toPolygons().length).toBe(2);
    expect(solidOf(alone).slice(45).toPolygons().length).toBe(1);
    // con 3° no hay lugar para el túnel: una sola cuña maciza y la pieza vuelve a ser de género 0
    const flat = check(await run({ pens: false, phoneAngleDeg: 3, snapToLayers: false }), 'sin túnel');
    expect(solidOf(flat).slice(15).toPolygons().length).toBe(1);
  });

  it('sin soportes: ninguna cara vuela más de lo que perdona el slicer, en todas las combinaciones', async () => {
    for (const over of [{}, { cupDividers: 3 }, { phoneAngleDeg: 30, phoneHeightMm: 120 }, { pens: false }, { phone: false }, { edgeRadiusMm: 4 }, { wallMm: 6 }]) {
      const it = check(await run(over), JSON.stringify(over), genusOf({ ...defaults, ...over }));
      const P = it.parts[0];
      const { fraction, worstDeg } = scanOverhangs(P.positions, P.indices, 0.5, -0.75);
      expect(fraction, JSON.stringify(over)).toBe(0);
      expect(worstDeg, JSON.stringify(over)).toBeLessThanOrEqual(46);
    }
  });

  it('bordes suaves: con 0 la pieza sigue siendo válida y con más redondeo tiene menos material', async () => {
    const sharp = check(await run({ edgeRadiusMm: 0 }), 'sin redondeo');
    const soft = check(await run({ edgeRadiusMm: 1.5 }), 'redondeado');
    expect(soft.merged.volumeMm3).toBeLessThan(sharp.merged.volumeMm3);
    // en paredes finas el redondeo se limita solo (queda plano arriba), sin romper la pieza
    check(await run({ edgeRadiusMm: 4, wallMm: 1.6 }), 'pared fina');
  });

  it('esquinas: con 0 la base sale rectangular y con radio, redondeada (sin cambiar las medidas)', async () => {
    const square = check(await run({ cornerRadiusMm: 0, snapToLayers: false }), 'viva');
    const round = check(await run({ cornerRadiusMm: 15, snapToLayers: false }), 'redonda');
    // (el borrador discretiza el arco: la medida puede diferir unos centésimos)
    expect(round.sizeMm[0]).toBeCloseTo(square.sizeMm[0], 1);
    expect(round.sizeMm[1]).toBeCloseTo(square.sizeMm[1], 1);
    expect(round.merged.volumeMm3).toBeLessThan(square.merged.volumeMm3);
  });

  it('el soporte crece con la altura y el ángulo, y la base crece con él si hace falta', async () => {
    const small = check(await run({ cupDepthMm: 40, phoneHeightMm: 60, phoneAngleDeg: 10 }), 'chico');
    // una placa de 140 mm es más alta que la taza: el túnel asoma por encima de su pared y la pieza queda abierta de lado a lado
    const big = check(await run({ cupDepthMm: 40, phoneHeightMm: 140, phoneAngleDeg: 30 }), 'grande', 1);
    expect(big.sizeMm[1]).toBeGreaterThan(small.sizeMm[1] + 30);
    expect(big.sizeMm[2]).toBeCloseTo(140, 0);
  });

  it('todo apagado: error claro y ninguna pieza', async () => {
    const r = await run({ pens: false, phone: false });
    expect(r.items).toEqual([]);
    expect(codes(r)).toContain('desk.empty');
  });

  it('la cama: los valores por defecto entran en 256 × 256 y el preset compacto en 180 × 180', async () => {
    expect(codes(await run({}, { printer: { bed: [256, 256] } }))).not.toContain('size.bedOverflow');
    const compact = desk.presets.find((p) => p.id === 'compact');
    const r = await run(compact.params, { printer: { bed: [180, 180] } });
    check(r, 'compacto');
    expect(codes(r)).not.toContain('size.bedOverflow');
    expect(codes(await run({}, { printer: { bed: [150, 150] } }))).toContain('size.bedOverflow');
  });

  it('vista previa: mismas medidas, sin la pieza unida', async () => {
    const full = (await run()).items[0];
    const prev = (await run({}, { preview: true })).items[0];
    expect(prev.sizeMm[0]).toBeCloseTo(full.sizeMm[0], 3);
    expect(prev.parts.length).toBe(full.parts.length);
  });
});

describe('organizador de escritorio: panel', () => {
  it('los presets generan piezas válidas', async () => {
    for (const preset of desk.presets) {
      const over = { ...preset.params };
      check(await run(over), preset.id, genusOf({ ...defaults, ...over }));
    }
  });

  it('los parámetros viejos (versión 1) se descartan', () => {
    expect(desk.migrate({ notes: '76x76', tray: true, penCols: 3 }, 1)).toEqual({});
  });

  it('resumen del pedido: módulos, medidas y color en palabras', () => {
    const color = (hex) => ({ '#4fb3f0': 'celeste', '#ffffff': 'blanco' })[hex] ?? hex;
    const es = Object.fromEntries(desk.orderSummary({ ...defaults }, { lang: 'es', color }));
    expect(es.Lapicero).toBe('76,2 × 82,55 × 81,28 mm');
    expect(es.Celular).toBe('ranura de 16 mm, inclinación de 15°, ancho de 88,9 mm');
    expect(es.Color).toBe('celeste');
    const off = Object.fromEntries(desk.orderSummary({ ...defaults, pens: false, colors: { base: '#ffffff' } }, { lang: 'es', color }));
    expect(off.Lapicero).toBe('');
    expect(off.Color).toBe('blanco');
    const en = Object.fromEntries(desk.orderSummary({ ...defaults, cupDividers: 2, phone: false }, { lang: 'en', color }));
    expect(en['Pen holder']).toBe('76.2 × 82.55 × 81.28 mm, 2 dividers');
    expect(en.Phone).toBe('');
  });
});
