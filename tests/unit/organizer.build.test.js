import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/organizer/build.js';
import { defaults, normalizeParams, parseDrillSizes, brandColors } from '../../src/tools/organizer/params.js';
import { BRANDS } from '../../src/tools/organizer/brands.js';
import { buildCase } from '../../src/tools/organizer/case.js';
import { exportStl, export3mf } from '../../src/core/export/exports.js';
import organizer from '../../src/tools/organizer/index.js';

let K;
beforeAll(async () => {
  K = await initKernel();
});

/** Una "L": asimétrica, para ver que el logo no sale espejado ni acostado. */
const L_SHAPE = [[[0, 0], [30, 0], [30, 5], [5, 5], [5, 20], [0, 20]]];
const ctx = (extra = {}) => ({ getFont: (id) => fontStore.get(id), printer: {}, logoPolys: { dewalt: L_SHAPE, makita: L_SHAPE, milwaukee: L_SHAPE }, ...extra });
const run = (over = {}, extra = {}) => build(K, { ...defaults, curveQuality: 'draft', ...over }, ctx(extra));
/** Las piezas de una sola parte (caja, soporte, porta puntas) con el logo de DeWalt en el frente, sobresaliendo. */
const runFront = (over = {}, extra = {}) => run({ kind: 'box', logo: 'dewalt', logoStyle: 'relief', colors: { base: '#febd17', logo: '#1a1a1a', latch: '#1a1a1a' }, ...over }, extra);
const codes = (r) => r.messages.map((m) => m.code);

function bounds(part) {
  const P = part.positions;
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) (mn[k] = Math.min(mn[k], P[i + k])), (mx[k] = Math.max(mx[k], P[i + k]));
  return { mn, mx };
}

/** Una pieza válida: malla cerrada, partes sin solaparse, `genus` esperado de la pieza unida. */
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

function check(r, label) {
  expect(r.messages.filter((m) => m.level === 'error'), label).toEqual([]);
  expect(r.items.length, label).toBe(1);
  // una sola pieza, sin partes sueltas (el logo queda trabado en la pared)
  return checkItem(r.items[0], label);
}

/** Cada pieza del estuche llevada a su lugar con el estuche cerrado (como la muestra el visor). */
function closedManifolds(r) {
  return r.items.map((it) => {
    const m = it.viewTransform;
    const parts = it.parts.map((p) => {
      const P = Float32Array.from(p.positions);
      for (let i = 0; i < P.length; i += 3) {
        const [x, y, z] = [P[i], P[i + 1], P[i + 2]];
        P[i] = m[0] * x + m[1] * y + m[2] * z + m[3];
        P[i + 1] = m[4] * x + m[5] * y + m[6] * z + m[7];
        P[i + 2] = m[8] * x + m[9] * y + m[10] * z + m[11];
      }
      return new K.Manifold(new K.Mesh({ numProp: 3, vertProperties: P, triVerts: p.indices }));
    });
    return { key: it.key, name: it.name, m: parts.length === 1 ? parts[0] : K.Manifold.union(parts) };
  });
}

describe('organizadores de taller: piezas con el logo en el frente', () => {
  for (const kind of ['box', 'drills', 'bits']) {
    for (const logoStyle of ['relief', 'flush']) {
      it(`${kind}, logo ${logoStyle}: pieza válida con el logo en el frente`, async () => {
        const it = check(await runFront({ kind, logoStyle }), `${kind} ${logoStyle}`);
        expect(it.parts.map((p) => p.colorKey)).toEqual(['base', 'logo']);
        const body = bounds(it.parts[0]);
        const logo = bounds(it.parts[1]);
        const front = body.mn[1];
        if (logoStyle === 'relief') {
          // sobresale del frente (y entra un poco en la pared)
          expect(logo.mn[1]).toBeCloseTo(front - defaults.logoDepthMm, 3);
          expect(logo.mx[1]).toBeGreaterThan(front);
        } else {
          // al ras: dentro de la pared, la cara de adelante queda plana
          expect(logo.mn[1]).toBeCloseTo(front, 3);
          expect(it.sizeMm[1]).toBeCloseTo(body.mx[1] - body.mn[1], 3);
        }
        // de pie y centrado: más ancho que alto (la L mide 30 × 20), dentro del frente
        expect(logo.mx[0] - logo.mn[0]).toBeGreaterThan(logo.mx[2] - logo.mn[2]);
        expect(logo.mn[0] + logo.mx[0]).toBeCloseTo(0, 3);
        expect(logo.mn[2]).toBeGreaterThan(0);
        expect(logo.mx[2]).toBeLessThan(body.mx[2]);
      });
    }
  }

  it('logo grabado: un hueco en la pieza, sin parte de otro color', async () => {
    const plain = (await runFront({ logo: null })).items[0];
    const it = check(await runFront({ logoStyle: 'engraved' }), 'grabado');
    expect(it.parts.map((p) => p.colorKey)).toEqual(['base']);
    expect(it.merged.volumeMm3).toBeLessThan(plain.merged.volumeMm3 - 1);
  });

  it('logo por separado: la pieza deja el hueco con juego y el logo sale aparte, acostado, sin pedir AMS', async () => {
    const r = await runFront({ logoStyle: 'separate', logoFitMm: 0 });
    expect(r.messages.filter((m) => m.level === 'error')).toEqual([]);
    expect(r.items.length).toBe(2);
    const [piece, logo] = r.items;
    checkItem(piece, 'pieza');
    checkItem(logo, 'logo');
    expect(piece.parts.map((p) => p.colorKey)).toEqual(['base']);
    expect(logo.parts.map((p) => p.colorKey)).toEqual(['logo']);
    expect(logo.parts[0].color).toBe('#1a1a1a');
    // sin juego el hueco es el del grabado, y el logo tiene el volumen del logo al ras
    const engraved = (await runFront({ logoStyle: 'engraved' })).items[0];
    const flush = (await runFront({ logoStyle: 'flush' })).items[0];
    expect(piece.merged.volumeMm3).toBeCloseTo(engraved.merged.volumeMm3, 0);
    expect(logo.merged.volumeMm3).toBeCloseTo(flush.parts.find((x) => x.colorKey === 'logo').volumeMm3, 0);
    // el logo apoya en la cama y tiene el espesor pedido
    const { mn, mx } = bounds(logo.parts[0]);
    expect(mn[2]).toBeCloseTo(0, 3);
    expect(mx[2]).toBeCloseTo(defaults.logoDepthMm, 3);
    // cada pieza es de un solo color: no necesita AMS, aunque el logo sea de otro color
    expect(r.info.needsMMU).toBe(false);
    expect(codes(r)).not.toContain('color.needsMMU');
    expect(codes(r)).toContain('organizer.logoSeparate');
    // lado a lado, sin pisarse
    const a = piece.bboxXY;
    const b = logo.bboxXY;
    const xa = [a[0] + piece.offsetXY[0], a[2] + piece.offsetXY[0]];
    const xb = [b[0] + logo.offsetXY[0], b[2] + logo.offsetXY[0]];
    expect(Math.max(xa[0], xb[0])).toBeGreaterThanOrEqual(Math.min(xa[1], xb[1]));
  });

  it('logo por separado: más juego, hueco más grande (pieza con menos material); el mismo color igual sale aparte', async () => {
    const vol = async (logoFitMm) => (await runFront({ logoStyle: 'separate', logoFitMm })).items[0].merged.volumeMm3;
    expect(await vol(0.4)).toBeLessThan((await vol(0.1)) - 0.5);
    const same = await runFront({ logoStyle: 'separate', colors: { base: '#ffffff', logo: '#ffffff', latch: '#000000' } });
    expect(same.items.length).toBe(2);
  });

  it('el logo no sale espejado: el palo de la L queda a la izquierda mirando el frente', async () => {
    const it = (await runFront()).items[0];
    const logo = it.parts.find((p) => p.colorKey === 'logo');
    const { mn, mx } = bounds(logo);
    const P = logo.positions;
    // los vértices más altos son los del palo: tienen que estar del lado de -X (la izquierda vista desde -Y)
    let sumX = 0;
    let n = 0;
    for (let i = 0; i < P.length; i += 3) if (P[i + 2] > mx[2] - 0.01) (sumX += P[i]), n++;
    expect(sumX / n).toBeLessThan((mn[0] + mx[0]) / 2);
  });

  it('el tamaño del logo es una parte del lugar libre del frente', async () => {
    const width = async (logoSizePct) => {
      const { mn, mx } = bounds((await runFront({ logoSizePct })).items[0].parts[1]);
      return mx[0] - mn[0];
    };
    const full = await width(100);
    expect(await width(50)).toBeCloseTo(full / 2, 0);
    // a 100 % ocupa el frente menos el margen (la L es más ancha que alta, manda el ancho o el alto disponible)
    expect(full).toBeLessThanOrEqual(defaults.boxWidthMm - 2 * defaults.cornerRadiusMm);
  });

  it('logo del mismo color que la pieza: una sola pieza', async () => {
    const it = check(await runFront({ colors: { base: '#ffffff', logo: '#ffffff', latch: '#000000' } }), 'mismo color');
    expect(it.parts.length).toBe(1);
  });

  it('sin logo: una sola pieza y ningún aviso', async () => {
    const r = await runFront({ logo: null });
    const it = check(r, 'sin logo');
    expect(it.parts.length).toBe(1);
    expect(r.messages).toEqual([]);
  });

  it('logo de otro color en el frente: avisa que necesita AMS si la impresora no tiene', async () => {
    const r = await runFront({}, { printer: { multiMaterial: false } });
    expect(r.info.needsMMU).toBe(true);
    expect(codes(r)).toContain('color.needsMMU');
  });

  it('logo elegido pero sin dibujo: avisa y sigue sin logo', async () => {
    const r = await runFront({ logo: 'bosch' });
    expect(codes(r)).toContain('organizer.logoMissing');
    expect(r.items[0].parts.length).toBe(1);
  });

  it('caja: medidas pedidas, cantidad de divisiones y fondo redondeado', async () => {
    const box = { logo: null, boxWidthMm: 100, boxDepthMm: 60, boxHeightMm: 30, boxCols: 4, boxRows: 2 };
    const it = check(await runFront(box), 'caja');
    expect(it.sizeMm.map((v) => Math.round(v * 10) / 10)).toEqual([100, 60, 30]);
    expect(it.holes).toBe(8);
    // el fondo redondeado suma material; las divisiones bajas sacan
    const flat = (await runFront({ ...box, scoop: false })).items[0];
    expect(it.merged.volumeMm3).toBeGreaterThan(flat.merged.volumeMm3);
    const low = (await runFront({ ...box, dividerHeightPct: 50 })).items[0];
    expect(low.merged.volumeMm3).toBeLessThan(it.merged.volumeMm3);
  });

  it('caja con esquinas muy redondeadas: el fondo redondeado no se asoma por afuera', async () => {
    const it = check(await runFront({ logo: null, cornerRadiusMm: 20, scoopRadiusMm: 20 }), 'esquinas');
    expect(it.sizeMm[0]).toBeLessThanOrEqual(defaults.boxWidthMm + 1e-3);
    expect(it.sizeMm[1]).toBeLessThanOrEqual(defaults.boxDepthMm + 1e-3);
  });

  it('caja con demasiadas divisiones: error claro', async () => {
    const r = await runFront({ boxWidthMm: 40, boxCols: 12 });
    expect(r.items).toEqual([]);
    expect(codes(r)).toContain('organizer.cellsTooSmall');
  });

  it('soporte de mechas: un agujero por medida, en escalones, y las medidas grabadas', async () => {
    const one = check(await runFront({ kind: 'drills', logo: null, drillSizes: '3 4 5 6 8 10' }), 'mechas');
    expect(one.holes).toBe(6);
    const two = check(await runFront({ kind: 'drills', logo: null, drillSizes: '3 4 5 6 8 10', drillRows: 2 }), 'mechas 2');
    expect(two.holes).toBe(6);
    // en dos filas: más angosto, más profundo y la de atrás más alta (un escalón)
    expect(two.sizeMm[0]).toBeLessThan(one.sizeMm[0]);
    expect(two.sizeMm[1]).toBeGreaterThan(one.sizeMm[1]);
    expect(two.sizeMm[2]).toBeCloseTo(one.sizeMm[2] + defaults.stepMm, 1);
    // los números grabados: el bloque es más profundo (lleva la franja de la medida) y tiene el grabado
    const plain = (await runFront({ kind: 'drills', logo: null, drillSizes: '3 4 5 6 8 10', drillLabels: false })).items[0];
    expect(one.sizeMm[1]).toBeGreaterThan(plain.sizeMm[1]);
    expect(one.triangles).toBeGreaterThan(plain.triangles + 100);
  });

  it('soporte de mechas: ignora lo que no es una medida y avisa', async () => {
    const r = await runFront({ kind: 'drills', drillSizes: '3 hola 4,5 99' });
    expect(r.items[0].holes).toBe(2);
    expect(r.messages.find((m) => m.code === 'organizer.badSizes').params.list).toBe('hola 99');
    const empty = await runFront({ kind: 'drills', drillSizes: '  ' });
    expect(empty.items).toEqual([]);
    expect(codes(empty)).toContain('organizer.noSizes');
  });

  it('porta puntas: filas × columnas de hexágonos de 1/4"', async () => {
    const it = check(await runFront({ kind: 'bits', logo: null, bitCols: 6, bitRows: 3 }), 'puntas');
    expect(it.holes).toBe(18);
    expect(it.sizeMm[2]).toBeCloseTo(defaults.bitDepthMm + 1.6 + 2 * defaults.stepMm, 1);
  });

  it('vista previa: sin la pieza unida, el resto igual', async () => {
    const full = await runFront();
    const prev = await runFront({}, { preview: true });
    expect(prev.items[0].merged).toBeNull();
    prev.items[0].sizeMm.forEach((v, k) => expect(v).toBeCloseTo(full.items[0].sizeMm[k], 3));
  });
});

describe('estuche porta mechas', () => {
  const SQ = Math.SQRT1_2;
  /** Ejes del mecanismo con los parámetros por defecto (bisagra, pivote de las trabas). */
  const axes = () => {
    const c = buildCase(K, (o) => o, normalizeParams(defaults), { zf: (z) => z, seg: 0.5, logo2d: null });
    return { H: [0, ...c.axes.hinge], P: [0, ...c.axes.latch] };
  };
  /** Gira una pieza alrededor de un eje paralelo a X (ángulo positivo: la tapa se abre, la traba se suelta). */
  const turn = (m, c, deg) => m.translate([0, -c[1], -c[2]]).rotate([-deg, 0, 0]).translate(c);

  it('por defecto: base, tapa con el logo embutido y dos trabas, sin piezas de metal', async () => {
    const r = await run();
    expect(r.messages.filter((m) => m.level === 'error')).toEqual([]);
    expect(r.items.map((it) => it.key)).toEqual(['base', 'lid', 'latch', 'latch']);
    // la base tiene las dos barras de las trabas (cada una, con sus orejas y la pared, es un "asa" de la malla)
    checkItem(r.items[0], 'base', 2);
    checkItem(r.items[1], 'tapa', 0);
    checkItem(r.items[2], 'traba', 0);
    expect(r.items[1].parts.map((p) => p.colorKey)).toEqual(['base', 'logo']);
    expect(r.items[2].parts[0].color).toBe(defaults.colors.latch);
    // la medida que se informa es la del estuche cerrado
    expect(r.info.sizeMm).toEqual([defaults.caseLengthMm, defaults.caseWidthMm, defaults.caseHeightMm + defaults.lidHeightMm]);
    expect(codes(r)).toContain('organizer.caseAssembly');
  });

  it('para imprimir: todo apoya en la cama (la tapa dada vuelta) y sin piezas encimadas', async () => {
    const r = await run({ caseView: 'print' });
    const boxes = r.items.map((it) => {
      for (const p of it.parts) expect(bounds(p).mn[2], it.name).toBeCloseTo(0, 3);
      const [x0, y0, x1, y1] = it.bboxXY;
      return [x0 + it.offsetXY[0], y0 + it.offsetXY[1], x1 + it.offsetXY[0], y1 + it.offsetXY[1]];
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        expect(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], `${i} × ${j}`).toBe(true);
      }
    }
    // la tapa se imprime con el logo contra la cama
    const logo = bounds(r.items[1].parts[1]);
    expect(logo.mn[2]).toBeCloseTo(0, 3);
    expect(logo.mx[2]).toBeCloseTo(defaults.logoDepthMm, 3);
  });

  it('cerrado: ninguna pieza pisa a otra (los pernos quedan dentro de sus C)', async () => {
    const parts = closedManifolds(await run());
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) expect(parts[i].m.intersect(parts[j].m).volume(), `${parts[i].name} × ${parts[j].name}`).toBeLessThan(0.01);
    }
    expect(parts[1].m.boundingBox().max[2]).toBeCloseTo(defaults.caseHeightMm + defaults.lidHeightMm, 3);
  });

  it('bisagra: la tapa abre sin chocar y se calza desde atrás con un clic (bien abierta)', async () => {
    const [base, lid] = closedManifolds(await run());
    const { H } = axes();
    for (const deg of [15, 45, 90, 110]) expect(turn(lid.m, H, deg).intersect(base.m).volume(), `abierta ${deg}°`).toBeLessThan(0.001);
    // abierta 150°, la tapa entra empujándola por la boca de las C (que miran hacia atrás y abajo): solo roza al pasar el perno
    const at = (s) => turn(lid.m, H, 150).translate([0, s * SQ, -s * SQ]).intersect(base.m).volume();
    expect(at(1)).toBeGreaterThan(0.05);
    expect(at(1)).toBeLessThan(1);
    for (const s of [2, 3, 4, 6]) expect(at(s), `s=${s}`).toBeLessThan(0.001);
  });

  it('trabas: giran sin chocar, abrazan la barra con un clic y se calzan en los pernos de la tapa', async () => {
    const parts = closedManifolds(await run());
    const box = K.Manifold.union([parts[0].m, parts[1].m]);
    const { P } = axes();
    const latch = parts[2].m;
    // al cerrar, solo roza la barra entre 1° y 5° (el clic); más abierta no toca nada
    let snap = 0;
    for (const deg of [1, 2, 3, 5]) snap = Math.max(snap, turn(latch, P, deg).intersect(box).volume());
    expect(snap).toBeGreaterThan(0.05);
    expect(snap).toBeLessThan(2);
    for (const deg of [10, 30, 60, 90]) expect(turn(latch, P, deg).intersect(box).volume(), `${deg}°`).toBeLessThan(0.001);
    // calzar: girada 30°, entra por la boca de su C (hacia la caja y abajo, girada con ella) y solo roza los pernos
    const a = (30 * Math.PI) / 180;
    const dir = [0, SQ * Math.cos(a) - SQ * Math.sin(a), -SQ * Math.sin(a) - SQ * Math.cos(a)];
    for (const s of [1, 2, 3, 4]) expect(turn(latch, P, 30).translate(dir.map((v) => -v * s)).intersect(box).volume(), `s=${s}`).toBeLessThan(0.5);
    // sin ajuste no hay clic
    const loose = closedManifolds(await run({ latchSnapMm: 0 }));
    const looseBox = K.Manifold.union([loose[0].m, loose[1].m]);
    expect(turn(loose[2].m, P, 2).intersect(looseBox).volume()).toBeLessThan(snap);
  });

  it('logo grabado en la tapa, o del mismo color: la tapa queda de una sola parte', async () => {
    const engraved = await run({ logoStyle: 'engraved' });
    expect(engraved.items[1].parts.map((p) => p.colorKey)).toEqual(['base']);
    const same = await run({ colors: { ...defaults.colors, logo: defaults.colors.base } });
    expect(same.items[1].parts.map((p) => p.colorKey)).toEqual(['base']);
    expect(same.items[1].merged.volumeMm3).toBeGreaterThan(engraved.items[1].merged.volumeMm3);
    // "sobresale" no se puede en la tapa (se imprime dada vuelta): queda al ras
    const relief = await run({ logoStyle: 'relief' });
    expect(bounds(relief.items[1].parts[1]).mn[2]).toBeCloseTo(0, 3);
  });

  it('logo por separado: la tapa deja el hueco con juego y el logo es otra pieza acostada, en su lugar al verlo cerrado', async () => {
    const engraved = await run({ logoStyle: 'engraved' });
    const sep = await run({ logoStyle: 'separate', logoFitMm: 0.2 });
    expect(sep.messages.filter((m) => m.level === 'error')).toEqual([]);
    expect(sep.items.map((it) => it.key)).toEqual(['base', 'lid', 'logo', 'latch', 'latch']);
    checkItem(sep.items[1], 'tapa');
    checkItem(sep.items[2], 'logo');
    expect(sep.items[1].parts.map((p) => p.colorKey)).toEqual(['base']);
    expect(sep.items[2].parts.map((p) => p.colorKey)).toEqual(['logo']);
    // el hueco es más grande que el del grabado
    expect(sep.items[1].merged.volumeMm3).toBeLessThan(engraved.items[1].merged.volumeMm3 - 1);
    // el logo apoya en la cama con el espesor pedido
    const { mn, mx } = bounds(sep.items[2].parts[0]);
    expect(mn[2]).toBeCloseTo(0, 3);
    expect(mx[2]).toBeCloseTo(defaults.logoDepthMm, 3);
    expect(sep.info.needsMMU).toBe(false);
    expect(codes(sep)).toContain('organizer.logoSeparate');
    // cerrado: el logo suelto entra en el hueco de la tapa (no pisa la tapa y queda dentro de ella)
    const closed = closedManifolds(sep);
    const lid = closed.find((c) => c.key === 'lid').m;
    const logo = closed.find((c) => c.key === 'logo').m;
    expect(lid.intersect(logo).volume()).toBeLessThan(0.01);
    const lidBox = lid.boundingBox();
    const logoBox = logo.boundingBox();
    for (let k = 0; k < 3; k++) expect(logoBox.min[k]).toBeGreaterThanOrEqual(lidBox.min[k] - 1e-3), expect(logoBox.max[k]).toBeLessThanOrEqual(lidBox.max[k] + 1e-3);
  });

  it('descarga: las cuatro piezas', async () => {
    const r = await run();
    const zip = unzipSync(exportStl(r, 'organizador').data);
    expect(Object.keys(zip).sort()).toEqual(['organizador-base.stl', 'organizador-tapa.stl', 'organizador-traba-1.stl', 'organizador-traba-2.stl']);
    expect(export3mf(r, 'organizador').filename).toBe('organizador-lote.3mf');
  });

  it('vista previa: sin las piezas unidas, mismas medidas', async () => {
    const full = await run();
    const prev = await run({}, { preview: true });
    expect(prev.items[1].merged).toBeNull();
    prev.items.forEach((it, i) => it.sizeMm.forEach((v, k) => expect(v).toBeCloseTo(full.items[i].sizeMm[k], 3)));
  });
});

describe('medidas de mecha', () => {
  it('acepta coma decimal, varios separadores y "mm"', () => {
    expect(parseDrillSizes('3 4,5 5.5;6/8, 10mm').sizes).toEqual([3, 4.5, 5.5, 6, 8, 10]);
    expect(parseDrillSizes('3, 4, 5').sizes).toEqual([3, 4, 5]);
    expect(parseDrillSizes('0.5 30 abc').bad).toEqual(['0.5', '30', 'abc']);
  });
});

describe('marcas y panel', () => {
  const root = resolve(import.meta.dirname, '../..');
  const catalog = JSON.parse(readFileSync(resolve(root, 'public/logos/logos.json'), 'utf8'));

  it('cada marca tiene su SVG, su entrada en el catálogo y colores válidos', () => {
    expect(catalog.map((c) => c.id)).toEqual(BRANDS.map((b) => b.id));
    for (const b of BRANDS) {
      expect(existsSync(resolve(root, 'public/logos', `${b.id}.svg`)), b.id).toBe(true);
      for (const k of ['base', 'logo', 'latch']) expect(b.colors[k], `${b.id} ${k}`).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const id of ['dewalt', 'milwaukee', 'makita', 'total', 'ingco', 'emtop', 'lusqtoff']) expect(BRANDS.some((b) => b.id === id), id).toBe(true);
  });

  it('elegir una marca aplica sus colores', () => {
    const ctl = organizer.schema.flatMap((s) => s.controls).find((c) => c.key === 'logo');
    expect(ctl.alsoSet('makita', defaults)).toEqual({ colors: brandColors('makita', defaults.colors) });
    expect(ctl.alsoSet('makita', defaults).colors.latch).toBe('#f2f2f2');
    expect(ctl.alsoSet(null, defaults)).toEqual({});
  });

  it('pasar al estuche con el logo "sobresale" lo cambia a "al ras"', () => {
    const ctl = organizer.schema.flatMap((s) => s.controls).find((c) => c.key === 'kind');
    expect(ctl.alsoSet('case', { ...defaults, logoStyle: 'relief' })).toEqual({ logoStyle: 'flush' });
    expect(ctl.alsoSet('box', { ...defaults, logoStyle: 'relief' })).toEqual({});
  });

  it('normalizar nunca falla y respeta los límites', () => {
    const p = normalizeParams({ kind: 'nada', boxCols: 99, drillRows: 0, logo: '', colors: { base: 'rojo' }, caseLengthMm: 9999 });
    expect(p.kind).toBe('case');
    expect(p.boxCols).toBe(12);
    expect(p.drillRows).toBe(1);
    expect(p.caseLengthMm).toBe(350);
    expect(p.logo).toBeNull();
    expect(p.colors.base).toBe(defaults.colors.base);
    expect(normalizeParams(null).kind).toBe('case');
  });

  it('los presets generan piezas válidas', async () => {
    for (const preset of organizer.presets) {
      const r = await run({ ...preset.params });
      expect(r.messages.filter((m) => m.level === 'error'), preset.id).toEqual([]);
      for (const it of r.items) expect(it.merged.status, `${preset.id} ${it.name}`).toBe('NoError');
    }
  });

  it('resumen del pedido: tipo, medidas, logo y colores en palabras', () => {
    const c = { lang: 'es', color: (x) => x, option: (k, v) => v, logo: (id) => ({ dewalt: 'DeWalt', milwaukee: 'Milwaukee' })[id] ?? id };
    const kase = Object.fromEntries(organizer.orderSummary(defaults, c));
    expect(kase.Medidas).toBe('220 × 70 × 80 mm');
    expect(kase.Logo).toBe('Milwaukee (flush)');
    expect(kase.Colores).toBe('#c8102e con logo #ffffff y trabas #1a1a1a');
    const box = Object.fromEntries(organizer.orderSummary({ ...defaults, kind: 'box', logo: 'dewalt', logoStyle: 'engraved' }, c));
    expect(box.Medidas).toBe('120 × 80 × 40 mm, 6 divisiones (3 × 2)');
    expect(box.Colores).toBe('#c8102e');
    const drills = Object.fromEntries(organizer.orderSummary({ ...defaults, kind: 'drills', drillSizes: '3 4,5' }, c));
    expect(drills.Medidas).toBe('3 · 4,5 mm');
    const bits = Object.fromEntries(organizer.orderSummary({ ...defaults, kind: 'bits', logo: null }, c));
    expect(bits.Medidas).toBe('20 puntas (2 × 10)');
    expect(bits.Logo).toBe('');
  });
});
