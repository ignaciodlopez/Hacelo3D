import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/organizer/build.js';
import { defaults, normalizeParams } from '../../src/tools/organizer/params.js';
import { jarDims } from '../../src/tools/organizer/jar.js';
import { export3mf } from '../../src/core/export/exports.js';
import organizer from '../../src/tools/organizer/index.js';

let K;
beforeAll(async () => {
  K = await initKernel();
});

/** Una "L": asimétrica, para ver que el logo no sale espejado ni acostado. */
const L_SHAPE = [[[0, 0], [30, 0], [30, 5], [5, 5], [5, 20], [0, 20]]];
const ctx = () => ({ getFont: (id) => fontStore.get(id), printer: {}, logoPolys: { milwaukee: L_SHAPE } });
const run = (over = {}) => build(K, { ...defaults, kind: 'jar', curveQuality: 'draft', ...over }, ctx());

// medidas del frasco de referencia (Ø80 × 40): volúmenes del cuerpo y de la tapa
const REF_BODY_MM3 = 33771;
const REF_LID_MM3 = 18366;

function bounds(positions) {
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) (mn[k] = Math.min(mn[k], positions[i + k])), (mx[k] = Math.max(mx[k], positions[i + k]));
  return { mn, mx };
}

/** Posiciones de una parte llevadas por una matriz 3×4 por filas. */
function transformed(part, m) {
  const P = Float32Array.from(part.positions);
  for (let i = 0; i < P.length; i += 3) {
    const [x, y, z] = [P[i], P[i + 1], P[i + 2]];
    P[i] = m[0] * x + m[1] * y + m[2] * z + m[3];
    P[i + 1] = m[4] * x + m[5] * y + m[6] * z + m[7];
    P[i + 2] = m[8] * x + m[9] * y + m[10] * z + m[11];
  }
  return P;
}

const solid = (part, m) => new K.Manifold(new K.Mesh({ numProp: 3, vertProperties: m ? transformed(part, m) : Float32Array.from(part.positions), triVerts: Uint32Array.from(part.indices) }));
const whole = (item, m) => {
  const ms = item.parts.map((p) => solid(p, m));
  return ms.length === 1 ? ms[0] : K.Manifold.union(ms);
};

/** Cuerpo y tapa cerrados (la tapa puesta), con la tapa girada `deg` grados sobre el eje y subida `lift` mm. */
function closed(r, deg = 0, lift = 0) {
  const [body, lid] = r.items;
  let l = whole(lid, lid.viewTransform);
  if (deg || lift) l = l.rotate([0, 0, deg]).translate([0, 0, lift]);
  return { body: whole(body, body.viewTransform), lid: l };
}

const closedRun = (over = {}) => run({ caseView: 'closed', ...over });

describe('frasco con tapa roscada', () => {
  it('por defecto: cuerpo y tapa cerrados, cada uno con su logo, medidas del frasco de referencia', async () => {
    const r = await closedRun();
    expect(r.messages.filter((m) => m.level === 'error')).toEqual([]);
    expect(r.items.map((it) => it.key)).toEqual(['body', 'lid']);
    for (const it of r.items) {
      expect(it.merged.status, it.name).toBe('NoError');
      expect(it.merged.genus, it.name).toBe(0);
      for (const p of it.parts) expect(p.status, `${it.name} ${p.colorKey}`).toBe('NoError');
      expect(it.parts.map((p) => p.colorKey), it.name).toEqual(['base', 'logo']);
    }
    expect(r.info.sizeMm[0]).toBeCloseTo(defaults.jarDiameterMm, 1);
    expect(r.info.sizeMm[2]).toBeCloseTo(defaults.jarHeightMm, 1);
    expect(r.items[1].sizeMm[2]).toBeCloseTo(defaults.jarCapHeightMm, 1);
    expect(r.messages.map((m) => m.code)).toContain('organizer.jarAssembly');
    expect(defaults.jarGrip).toBe('knurl');
  });

  it('con la ranura helicoidal de agarre las medidas y los volúmenes salen del frasco de referencia', async () => {
    const r = await closedRun({ jarGrip: 'groove', jarGripDepthMm: 1 });
    expect(Math.abs(r.items[0].merged.volumeMm3 / REF_BODY_MM3 - 1)).toBeLessThan(0.04);
    expect(Math.abs(r.items[1].merged.volumeMm3 / REF_LID_MM3 - 1)).toBeLessThan(0.04);
  });

  it('moleteado: pirámides truncadas en el exterior (menos material que liso), con el diámetro intacto', async () => {
    const [knurl, groove, smooth] = await Promise.all(['knurl', 'groove', 'none'].map((jarGrip) => closedRun({ jarGrip, jarGripDepthMm: 1, logo: null })));
    for (const i of [0, 1]) {
      const [vk, vg, vs] = [knurl, groove, smooth].map((r) => r.items[i].merged.volumeMm3);
      expect(vk, `pieza ${i}`).toBeLessThan(vs - 40);
      expect(vg, `pieza ${i}`).toBeLessThan(vs);
      // la cresta de las pirámides llega al radio del frasco: nada sobresale ni queda corto
      const { mn, mx } = bounds(knurl.items[i].parts[0].positions);
      expect(mx[0] - mn[0]).toBeCloseTo(defaults.jarDiameterMm, 1);
      expect(mx[1] - mn[1]).toBeGreaterThan(defaults.jarDiameterMm - 0.5);
    }
  });

  it('moleteado: el dibujo cierra en la vuelta (cantidad entera de entradas) para cualquier diámetro y tamaño', () => {
    for (const jarDiameterMm of [50, 63, 80, 97, 150]) {
      for (const jarGripPitchMm of [3, 4.4, 6.1, 9]) {
        const d = jarDims(normalizeParams({ kind: 'jar', jarDiameterMm, jarGripPitchMm }));
        expect(Number.isInteger(d.knurlStarts)).toBe(true);
        expect(d.knurlPitch * d.knurlStarts).toBeCloseTo(Math.PI * jarDiameterMm, 6);
        expect(Math.abs(d.knurlPitch / jarGripPitchMm - 1)).toBeLessThan(0.12);
      }
    }
  });

  it('para imprimir: el cuerpo parado y la tapa dada vuelta, los dos apoyados en la cama y lado a lado', async () => {
    const r = await run({ caseView: 'print' });
    const boxes = r.items.map((it) => {
      for (const p of it.parts) expect(bounds(p.positions).mn[2], `${it.name} ${p.colorKey}`).toBeCloseTo(0, 3);
      expect(it.viewTransform).toBeUndefined();
      const [x0, y0, x1, y1] = it.bboxXY;
      return [x0 + it.offsetXY[0], y0 + it.offsetXY[1], x1 + it.offsetXY[0], y1 + it.offsetXY[1]];
    });
    expect(boxes[0][2] <= boxes[1][0] || boxes[1][2] <= boxes[0][0]).toBe(true);
    // el logo de la tapa y el de la base quedan contra la cama, embutidos
    for (const it of r.items) {
      const logo = bounds(it.parts[1].positions);
      expect(logo.mn[2]).toBeCloseTo(0, 3);
      expect(logo.mx[2]).toBeCloseTo(defaults.logoDepthMm, 3);
    }
  });

  it('las descargas son las piezas para imprimir en las dos vistas', async () => {
    const closedR = await closedRun();
    const printR = await run({ caseView: 'print' });
    expect(export3mf({ items: closedR.items }).data.length).toBeGreaterThan(1000);
    for (const it of printR.items) expect(it.merged.status).toBe('NoError');
  });

  for (const [label, over] of [
    ['Ø80 × 40', {}],
    ['juego de 0,1 mm', { jarFitMm: 0.1 }],
    ['Ø60 × 35', { jarDiameterMm: 60, jarHeightMm: 35 }],
    ['Ø110 × 60, tapa de 16', { jarDiameterMm: 110, jarHeightMm: 60, jarCapHeightMm: 16 }],
    ['pared de 1,6 mm', { jarWallMm: 1.6 }],
    ['alto 70', { jarHeightMm: 70 }],
  ]) {
    it(`${label}: cerrado, la tapa no pisa al cuerpo`, async () => {
      const { body, lid } = closed(await closedRun(over));
      expect(body.intersect(lid).volume()).toBeLessThan(0.01);
    });
  }

  it('la rosca es real: la tapa girada sin subir pisa los cordones, y girada subiendo lo que sube la hélice, no', async () => {
    const r = await closedRun();
    const pitch = 3.75;
    const quarter = closed(r, 90, pitch / 4);
    expect(quarter.body.intersect(quarter.lid).volume()).toBeLessThan(0.01);
    // al revés (hélice izquierda) o sin subir: choca
    const noLift = closed(r, 90, 0);
    expect(noLift.body.intersect(noLift.lid).volume()).toBeGreaterThan(1);
    const wrongWay = closed(r, 90, -pitch / 4);
    expect(wrongWay.body.intersect(wrongWay.lid).volume()).toBeGreaterThan(1);
  });

  it('el juego de la rosca agranda la boca de la tapa, y con juego 0 igual no se pisan', async () => {
    const tight = jarDims(normalizeParams({ kind: 'jar', jarFitMm: 0 }));
    const loose = jarDims(normalizeParams({ kind: 'jar', jarFitMm: 0.4 }));
    expect(loose.lidBoreR - tight.lidBoreR).toBeCloseTo(0.4, 6);
    const { body, lid } = closed(await closedRun({ jarFitMm: 0 }));
    expect(body.intersect(lid).volume()).toBeLessThan(0.01);
  });

  it('el logo no sale espejado ni acostado, en la tapa (vista desde arriba) y en la base (dando vuelta el cuerpo)', async () => {
    const r = await closedRun();
    const flip = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0];
    const lidLogo = transformed(r.items[1].parts[1], r.items[1].viewTransform);
    // la base se mira desde abajo: se la da vuelta sobre el eje X como se da vuelta el frasco
    const baseLogo = transformed(r.items[0].parts[1], flip);
    for (const [name, P] of [['tapa', lidLogo], ['base', baseLogo]]) {
      const { mn, mx } = bounds(P);
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < P.length; i += 3) {
        sx += P[i];
        sy += P[i + 1];
      }
      const n = P.length / 3;
      // el palo de la L está a la izquierda y la patita abajo: el promedio de sus vértices queda a la izquierda y abajo
      expect(sx / n, name).toBeLessThan((mn[0] + mx[0]) / 2);
      expect(sy / n, name).toBeLessThan((mn[1] + mx[1]) / 2);
      // y es una L ancha, no acostada
      expect(mx[0] - mn[0], name).toBeGreaterThan(mx[1] - mn[1]);
    }
  });

  it('logo grabado: hueco en las dos piezas; del mismo color: cada pieza de una sola parte', async () => {
    const plain = await run({ logo: null });
    const engraved = await run({ logoStyle: 'engraved' });
    const same = await run({ colors: { ...defaults.colors, logo: defaults.colors.base } });
    for (const i of [0, 1]) {
      expect(plain.items[i].parts.map((p) => p.colorKey)).toEqual(['base']);
      expect(engraved.items[i].parts.map((p) => p.colorKey)).toEqual(['base']);
      expect(engraved.items[i].merged.volumeMm3).toBeLessThan(plain.items[i].merged.volumeMm3 - 1);
      expect(same.items[i].parts.map((p) => p.colorKey)).toEqual(['base']);
      expect(same.items[i].merged.volumeMm3).toBeCloseTo(plain.items[i].merged.volumeMm3, -1);
    }
  });

  it('sin logo en la base: solo la tapa lleva logo', async () => {
    const r = await run({ jarBaseLogo: false });
    expect(r.items[0].parts.map((p) => p.colorKey)).toEqual(['base']);
    expect(r.items[1].parts.map((p) => p.colorKey)).toEqual(['base', 'logo']);
  });

  it('muy bajo para el hombro y el cuello: error claro', async () => {
    const r = await run({ jarHeightMm: 30, jarCapHeightMm: 30 });
    expect(r.items).toEqual([]);
    expect(r.messages.map((m) => m.code)).toContain('organizer.jarTooShort');
    expect(jarDims(normalizeParams({ kind: 'jar' })).ok).toBe(true);
  });

  it('vista previa: sin las piezas unidas, mismas medidas', async () => {
    const full = await run();
    const prev = await build(K, { ...defaults, kind: 'jar', curveQuality: 'draft' }, { ...ctx(), preview: true });
    expect(prev.items.map((it) => it.sizeMm.map((v) => Math.round(v)))).toEqual(full.items.map((it) => it.sizeMm.map((v) => Math.round(v))));
    expect(prev.info.triangles).toBeGreaterThan(0);
  });

  it('los parámetros se normalizan y el tipo aparece en el panel, los presets y el resumen del pedido', () => {
    const p = normalizeParams({ kind: 'jar', jarDiameterMm: 9999, jarHeightMm: 1, jarFitMm: -3, jarBaseLogo: 'si' });
    expect(p.kind).toBe('jar');
    expect(p.jarDiameterMm).toBe(150);
    expect(p.jarHeightMm).toBe(30);
    expect(p.jarFitMm).toBe(0);
    expect(p.jarBaseLogo).toBe(defaults.jarBaseLogo);
    const kinds = organizer.schema.flatMap((s) => s.controls).find((c) => c.key === 'kind');
    expect(kinds.options.map(([v]) => v)).toContain('jar');
    // el logo del frasco va contra la cama: no puede sobresalir
    expect(kinds.alsoSet('jar', { ...defaults, logoStyle: 'relief' })).toEqual({ logoStyle: 'flush' });
    expect(organizer.presets.filter((pr) => pr.params.kind === 'jar').length).toBeGreaterThanOrEqual(3);
    const c = { lang: 'es', color: (x) => x, option: (k, v) => v, logo: (id) => id };
    expect(Object.fromEntries(organizer.orderSummary({ ...defaults, kind: 'jar' }, c)).Medidas).toBe('Ø80 × 40 mm');
  });
});
