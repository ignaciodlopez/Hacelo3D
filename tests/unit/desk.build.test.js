import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/desk/build.js';
import { defaults, normalizeParams } from '../../src/tools/desk/params.js';
import { layoutDesk } from '../../src/tools/desk/layout.js';
import { scanOverhangs } from '../../src/core/kernel/analysis.js';
import desk from '../../src/tools/desk/index.js';

let K;
beforeAll(async () => {
  K = await initKernel();
});

const ctx = (extra = {}) => ({ getFont: (id) => fontStore.get(id), printer: {}, ...extra });
const run = (over = {}, extra = {}) => build(K, { ...defaults, curveQuality: 'draft', ...over }, ctx(extra));
const codes = (r) => r.messages.map((m) => m.code);

/** La pieza como Manifold (las partes unidas). */
function solidOf(item) {
  const parts = item.parts.map((p) => new K.Manifold(new K.Mesh({ numProp: 3, vertProperties: Float32Array.from(p.positions), triVerts: p.indices })));
  return parts.length === 1 ? parts[0] : K.Manifold.union(parts);
}

/** Perfil (y, z) extruido a lo largo de X, de x0 a x1: como las ranuras de la pieza. */
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

/** Área de un polígono (shoelace). */
const area = (poly) => Math.abs(poly.reduce((s, q, i) => s + (q[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * q[1]), 0) / 2);

describe('organizador de escritorio: piezas', () => {
  it('por defecto: una sola pieza, de un solo color, apoyada en la cama y dentro de la cama', async () => {
    const r = await run();
    const it = check(r, 'defecto');
    expect(it.parts.map((p) => p.colorKey)).toEqual(['base']);
    expect(bounds(it.parts[0]).mn[2]).toBeCloseTo(0, 3);
    const l = layoutDesk(normalizeParams(defaults));
    expect(it.sizeMm[0]).toBeCloseTo(l.width, 1);
    expect(it.sizeMm[1]).toBeCloseTo(l.depth, 1);
    expect(r.info.sizeMm[0]).toBeCloseTo(l.width, 1);
    expect(r.info.needsMMU).toBe(false);
    expect(codes(r)).not.toContain('size.bedOverflow');
  });

  for (const penShape of ['round', 'square', 'hex']) {
    for (const phoneSide of ['left', 'right']) {
      for (const [pens, phone, notes] of [[true, true, '76x76'], [true, false, 'none'], [false, true, 'none'], [false, false, '51x76'], [true, true, 'none'], [false, true, 'custom']]) {
        it(`${penShape}, celular ${phoneSide}, lapicero ${pens}, celular ${phone}, notas ${notes}: pieza válida de una sola isla`, async () => {
          const it = check(await run({ penShape, phoneSide, pens, phone, notes }), 'matriz');
          expect(bounds(it.parts[0]).mn[2]).toBeCloseTo(0, 3);
        });
      }
    }
  }

  it('módulos separados por una ranura sobre un zócalo, o con una pared compartida: las dos son una sola pieza válida', async () => {
    const separate = check(await run({ podGapMm: 4 }), 'ranura');
    const shared = check(await run({ podGapMm: 0 }), 'pared compartida');
    // a media altura de las paredes la pieza con ranura se parte en un contorno por módulo; con pared compartida hay uno solo
    const outlines = (it) => solidOf(it).slice(40).toPolygons().filter((q) => area(q) > 500).length;
    expect(outlines(separate)).toBeGreaterThanOrEqual(3);
    // el zócalo los une abajo
    expect(solidOf(separate).slice(2.0).toPolygons().filter((q) => area(q) > 5000).length).toBe(1);
    expect(shared.sizeMm[0]).toBeLessThan(separate.sizeMm[0]);
  });

  it('bordes suaves: con 0 la pieza sigue siendo válida y con más redondeo tiene menos material arriba', async () => {
    const sharp = check(await run({ edgeRadiusMm: 0 }), 'sin redondeo');
    const soft = check(await run({ edgeRadiusMm: 1.5 }), 'redondeado');
    expect(soft.merged.volumeMm3).toBeLessThan(sharp.merged.volumeMm3);
    // en paredes finas el redondeo se limita solo (queda plano arriba), sin romper la pieza
    check(await run({ edgeRadiusMm: 4, wallMm: 1.6 }), 'pared fina');
  });

  it('lapicero: una celda por columna y fila, con la fila de atrás más alta', async () => {
    const it = check(await run({ phone: false, notes: 'none', penCols: 3, penRows: 2, penStepMm: 15, penHeightMm: 90 }), 'lapicero');
    const m = solidOf(it);
    // la altura máxima es la de la fila de atrás
    expect(it.sizeMm[2]).toBeCloseTo(90, 0);
    // a media altura de la fila de adelante: el contorno de afuera y 3 × 2 agujeros
    expect(m.slice(40).toPolygons().length).toBe(7);
    // la fila de adelante es 15 mm más baja: por encima solo quedan las 3 celdas de atrás
    expect(m.slice(80).toPolygons().length).toBe(4);
  });

  it('celdas redondas, cuadradas y hexagonales tienen la forma pedida', async () => {
    const hole = async (penShape) => {
      const it = check(await run({ phone: false, notes: 'none', penCols: 1, penRows: 1, penShape, penCellMm: 30, wallMm: 3 }), penShape);
      const polys = solidOf(it).slice(40).toPolygons();
      return Math.min(...polys.map(area));
    };
    // círculo de Ø30 (el borrador usa pocos lados: cerca del área exacta), cuadrado de 30 y hexágono de 30 entre caras
    expect(await hole('round')).toBeGreaterThan(Math.PI * 15 * 15 * 0.95);
    expect(await hole('round')).toBeLessThanOrEqual(Math.PI * 15 * 15 + 1);
    expect(await hole('square')).toBeCloseTo(900, 0);
    expect(await hole('hex')).toBeCloseTo((Math.sqrt(3) / 2) * 900, 0);
  });

  it('celular: la ranura sale sin soportes con 0°, 15° y 30°, y un celular simulado entra sin pisar la pieza', async () => {
    for (const phoneAngleDeg of [0, 15, 30]) {
      const over = { pens: false, notes: 'none', phoneAngleDeg, phoneCable: false };
      const it = check(await run(over), `celular ${phoneAngleDeg}`);
      const z = layoutDesk(normalizeParams({ ...defaults, ...over })).zones[0];
      const P = it.parts[0];
      const { fraction, worstDeg } = scanOverhangs(P.positions, P.indices, 0.5, -0.75);
      expect(fraction, `${phoneAngleDeg}°`).toBe(0);
      expect(worstDeg).toBeLessThanOrEqual(phoneAngleDeg + 1);

      // un celular (con funda: 82 × 12) dentro de la ranura, apoyado en el fondo
      const a = (phoneAngleDeg * Math.PI) / 180;
      const yf = z.y0 + 3;
      const hw = defaults.phoneThicknessMm / Math.cos(a);
      const d = 1.5 / 2 / Math.cos(a);
      const floor = defaults.floorMm;
      const L = 120 / Math.cos(a);
      const phone = alongX(
        [
          [yf + d, floor + 0.05],
          [yf + d + hw, floor + 0.05],
          [yf + d + hw + L * Math.sin(a), floor + 0.05 + L * Math.cos(a)],
          [yf + d + L * Math.sin(a), floor + 0.05 + L * Math.cos(a)],
        ],
        (z.x0 + z.x1) / 2 - defaults.phoneWidthMm / 2,
        (z.x0 + z.x1) / 2 + defaults.phoneWidthMm / 2,
      );
      expect(phone.volume()).toBeGreaterThan(1000);
      expect(solidOf(it).intersect(phone).volume(), `celular ${phoneAngleDeg}°`).toBeLessThan(0.01);
    }
  });

  it('celular: la muesca del cable abre el labio hasta el fondo de la ranura', async () => {
    const withCable = check(await run({ pens: false, notes: 'none', phoneCable: true }), 'cable');
    const without = check(await run({ pens: false, notes: 'none', phoneCable: false }), 'sin cable');
    expect(withCable.merged.volumeMm3).toBeLessThan(without.merged.volumeMm3 - 10);
  });

  it('notas: un taco simulado apoyado en el fondo del bolsillo no pisa la pieza y sobra el juego por lado', async () => {
    const over = { pens: false, phone: false, notes: '76x76', notesClearanceMm: 1.5 };
    const it = check(await run(over), 'notas');
    const z = layoutDesk(normalizeParams({ ...defaults, ...over })).zones[0];
    const body = solidOf(it);
    const cx = (z.x0 + z.x1) / 2;
    const cy = (z.y0 + z.y1) / 2;
    const pad = K.Manifold.cube([76, 76, 20]).translate([cx - 38, cy - 38, defaults.floorMm + 0.01]);
    expect(body.intersect(pad).volume()).toBeLessThan(0.01);
    // un taco 0,4 mm más ancho que el bolsillo ya pisa las paredes
    const wide = K.Manifold.cube([76 + 2 * 1.5 + 0.4, 76, 20]).translate([cx - 38 - 1.5 - 0.2, cy - 38, defaults.floorMm + 0.01]);
    expect(body.intersect(wide).volume()).toBeGreaterThan(0.5);
  });

  it('notas: la muesca semicircular saca material de la pared de adelante', async () => {
    const over = { pens: false, phone: false, notes: '76x76' };
    const a = check(await run({ ...over, notesNotch: true }), 'con muesca');
    const b = check(await run({ ...over, notesNotch: false }), 'sin muesca');
    expect(a.merged.volumeMm3).toBeLessThan(b.merged.volumeMm3 - 20);
  });

  it('sin soportes: ninguna cara vuela más de lo que perdona el slicer, en el conjunto completo', async () => {
    const it = check(await run({ tray: true, cards: true }), 'completo');
    const P = it.parts[0];
    expect(scanOverhangs(P.positions, P.indices, 0.5, -0.75).fraction).toBe(0);
  });

  it('bandeja y tarjetas: piezas válidas, y cada una agrega su lugar', async () => {
    const plain = check(await run(), 'sin');
    const tray = check(await run({ tray: true, trayDividers: 2 }), 'bandeja');
    expect(tray.sizeMm[1]).toBeGreaterThan(plain.sizeMm[1] + 30);
    const cards = check(await run({ cards: true }), 'tarjetas');
    expect(cards.sizeMm[0]).toBeGreaterThan(plain.sizeMm[0] + 90);
  });

  it('bandeja: con o sin fondo redondeado, válida', async () => {
    check(await run({ tray: true, trayScoop: false }), 'sin curva');
    check(await run({ tray: true, trayScoop: true, trayHeightMm: 30 }), 'con curva');
  });

  it('todo apagado: error claro y ninguna pieza', async () => {
    const r = await run({ pens: false, phone: false, notes: 'none', cards: false });
    expect(r.items).toEqual([]);
    expect(codes(r)).toContain('desk.empty');
  });

  it('la cama: los valores por defecto entran en 256 × 256 y el preset compacto en 180 × 180', async () => {
    expect(codes(await run({}, { printer: { bed: [256, 256] } }))).not.toContain('size.bedOverflow');
    const compact = desk.presets.find((p) => p.id === 'compact');
    const r = await run(compact.params, { printer: { bed: [180, 180] } });
    check(r, 'compacto');
    expect(codes(r)).not.toContain('size.bedOverflow');
    expect(codes(await run({}, { printer: { bed: [180, 180] } }))).toContain('size.bedOverflow');
  });

  it('vista previa: mismas medidas, sin la pieza unida', async () => {
    const full = (await run()).items[0];
    const prev = (await run({}, { preview: true })).items[0];
    expect(prev.sizeMm[0]).toBeCloseTo(full.sizeMm[0], 3);
    expect(prev.parts.length).toBe(full.parts.length);
  });
});

describe('organizador de escritorio: texto en el frente', () => {
  const label = { label: 'Mi escritorio' };

  it('grabado: un hueco en el frente, una sola parte', async () => {
    const plain = check(await run({ tray: true }), 'sin texto');
    const it = check(await run({ tray: true, ...label, labelStyle: 'engraved' }), 'grabado');
    expect(it.parts.map((p) => p.colorKey)).toEqual(['base']);
    expect(it.merged.volumeMm3).toBeLessThan(plain.merged.volumeMm3 - 1);
  });

  it('en relieve de otro color: sobresale por delante y es otra parte (pide AMS si la impresora no tiene)', async () => {
    const r = await run({ tray: true, ...label, labelStyle: 'relief', colors: { base: '#2b2b2b', text: '#ffffff' } }, { printer: { multiMaterial: false } });
    const it = check(r, 'relieve');
    expect(it.parts.map((p) => p.colorKey)).toEqual(['base', 'text']);
    const l = layoutDesk(normalizeParams({ ...defaults, tray: true }));
    expect(bounds(it.parts[1]).mn[1]).toBeLessThan(-l.depth / 2 - 0.2);
    expect(codes(r)).toContain('color.needsMMU');
  });

  it('en relieve del mismo color que la pieza: una sola parte', async () => {
    const it = check(await run({ tray: true, ...label, labelStyle: 'relief', colors: { base: '#ffffff', text: '#ffffff' } }), 'mismo color');
    expect(it.parts.length).toBe(1);
  });

  it('el texto va centrado en el frente de la bandeja y dentro de su altura', async () => {
    const it = check(await run({ tray: true, ...label, labelStyle: 'relief', colors: { base: '#2b2b2b', text: '#ffffff' } }), 'centrado');
    const { mn, mx } = bounds(it.parts[1]);
    expect((mn[0] + mx[0]) / 2).toBeCloseTo(0, 0);
    expect(mn[2]).toBeGreaterThan(0);
    expect(mx[2]).toBeLessThan(defaults.trayHeightMm);
    expect((mn[2] + mx[2]) / 2).toBeCloseTo(defaults.trayHeightMm / 2, 0);
  });

  it('sin bandeja el texto va en el frente del lapicero; sin lugar, avisa', async () => {
    const r = await run({ ...label, labelStyle: 'relief', colors: { base: '#2b2b2b', text: '#ffffff' } });
    check(r, 'lapicero');
    expect(r.items[0].parts.map((p) => p.colorKey)).toEqual(['base', 'text']);
    // solo el celular con muesca: no hay frente libre para el texto
    const none = await run({ ...label, pens: false, notes: 'none' });
    expect(codes(none)).toContain('desk.labelNoRoom');
    expect(none.items[0].parts.map((p) => p.colorKey)).toEqual(['base']);
  });

  it('sin la fuente: avisa y sigue sin texto', async () => {
    const r = await run(label, {
      getFont: async () => {
        throw new Error('x');
      },
    });
    expect(codes(r)).toContain('desk.labelNoRoom');
    check(r, 'sin fuente');
  });

  it('un grabado más hondo que la pared se limita y avisa', async () => {
    const r = await run({ tray: true, ...label, labelStyle: 'engraved', labelDepthMm: 1.6, wallMm: 1.6 });
    check(r, 'hondo');
    expect(codes(r)).toContain('desk.labelDepth');
  });
});

describe('organizador de escritorio: panel', () => {
  it('los presets generan piezas válidas', async () => {
    for (const preset of desk.presets) check(await run({ ...preset.params }), preset.id);
  });

  it('resumen del pedido: módulos, medidas y color en palabras', () => {
    const color = (hex) => ({ '#2b2b2b': 'gris oscuro', '#ffffff': 'blanco' })[hex] ?? hex;
    const es = Object.fromEntries(desk.orderSummary({ ...defaults }, { lang: 'es', color }));
    expect(es.Lapicero).toBe('4 celdas redondas (2 × 2) de 30 mm');
    expect(es.Celular).toBe('hasta 82 × 12 mm');
    expect(es['Notas adhesivas']).toBe('76 × 76 mm');
    expect(es.Tarjetas).toBe('');
    expect(es.Color).toBe('gris oscuro');
    const off = Object.fromEntries(
      desk.orderSummary({ ...defaults, pens: false, phone: false, notes: 'none', label: 'Hola', labelStyle: 'relief', colors: { base: '#2b2b2b', text: '#ffffff' } }, { lang: 'es', color }),
    );
    expect(off.Lapicero).toBe('');
    expect(off.Texto).toBe('Hola');
    expect(off.Color).toBe('gris oscuro con texto blanco');
    const en = Object.fromEntries(desk.orderSummary({ ...defaults, notes: 'custom', notesWidthMm: 60.5 }, { lang: 'en', color }));
    expect(en['Pen holder']).toBe('4 cells round (2 × 2) of 30 mm');
    expect(en['Sticky notes']).toBe('60.5 × 76 mm');
  });
});
