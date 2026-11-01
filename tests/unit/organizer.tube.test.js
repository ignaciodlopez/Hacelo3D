import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/organizer/build.js';
import { defaults, normalizeParams } from '../../src/tools/organizer/params.js';
import { tubeDims, PITCH } from '../../src/tools/organizer/tube.js';
import { scanOverhangs } from '../../src/core/kernel/analysis.js';
import { export3mf } from '../../src/core/export/exports.js';
import organizer from '../../src/tools/organizer/index.js';

let K;
beforeAll(async () => {
  K = await initKernel();
});

/** Una "L": asimétrica, para ver que el logo no sale espejado ni acostado. */
const L_SHAPE = [[[0, 0], [30, 0], [30, 5], [5, 5], [5, 20], [0, 20]]];
const ctx = () => ({ getFont: (id) => fontStore.get(id), printer: {}, logoPolys: { milwaukee: L_SHAPE } });
const run = (over = {}) => build(K, { ...defaults, kind: 'tube', tubeBaseLogo: true, curveQuality: 'draft', ...over }, ctx());
const closedRun = (over = {}) => run({ caseView: 'closed', ...over });

// medidas de la caja de referencia Ø60 × 110 (adentro 100): volúmenes de los STL (±6 %: la rosca es más baja y el cuello 2 mm más largo)
const REF_BODY_MM3 = 59008;
const REF_LID_MM3 = 43244;
const near = (v, ref, tol = 0.06) => Math.abs(v / ref - 1) < tol;

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

describe('caja cilíndrica con tapa roscada', () => {
  it('por defecto: cuerpo y tapa cerrados, cada uno con su logo, medidas de la caja de referencia', async () => {
    const r = await closedRun();
    expect(r.messages.filter((m) => m.level === 'error')).toEqual([]);
    expect(r.items.map((it) => it.key)).toEqual(['body', 'lid']);
    for (const it of r.items) {
      expect(it.merged.status, it.name).toBe('NoError');
      expect(it.merged.genus, it.name).toBe(0);
      for (const p of it.parts) expect(p.status, `${it.name} ${p.colorKey}`).toBe('NoError');
      expect(it.parts.map((p) => p.colorKey), it.name).toEqual(['base', 'logo']);
    }
    expect(r.info.sizeMm[0]).toBeCloseTo(60, 1);
    expect(r.info.sizeMm[2]).toBeCloseTo(110, 1);
    expect(r.items[1].sizeMm[2]).toBeCloseTo(50, 1);
    expect(r.messages.map((m) => m.code)).toContain('organizer.tubeAssembly');
    expect(defaults.kind).toBe('case');
    expect(defaults.jarGrip).toBe('knurl');
  });

  it('los volúmenes del cuerpo y de la tapa salen de los STL de referencia (Ø60 × 110)', async () => {
    const r = await closedRun({ logo: null });
    expect(near(r.items[0].merged.volumeMm3, REF_BODY_MM3), `cuerpo ${r.items[0].merged.volumeMm3}`).toBe(true);
    expect(near(r.items[1].merged.volumeMm3, REF_LID_MM3), `tapa ${r.items[1].merged.volumeMm3}`).toBe(true);
  });

  it('las ocho medidas de la referencia: Ø60, largo de afuera 110…250 y adentro 100…240', async () => {
    const REF_BODY = [59008, 74377, 89851, 105299, 120776, 136211, 151761, 167152];
    for (const [i, L] of [110, 130, 150, 170, 190, 210, 230, 250].entries()) {
      const pr = organizer.presets.find((x) => x.id === `tube-${L}`);
      expect(pr, `preset ${L}`).toBeTruthy();
      const params = normalizeParams({ ...defaults, ...pr.params });
      expect(params.kind).toBe('tube');
      const d = tubeDims(params);
      expect(d.ok).toBe(true);
      expect(d.length).toBe(L);
      expect(d.innerMm).toBe(L - 10);
      const r = await closedRun({ ...pr.params, logo: null });
      expect(r.info.sizeMm[2]).toBeCloseTo(L, 1);
      expect(near(r.items[0].merged.volumeMm3, REF_BODY[i]), `cuerpo ${L}: ${r.items[0].merged.volumeMm3}`).toBe(true);
    }
  });

  it('medidas: agujero de Ø50, fondo de 5, cuello de 12 sobre el escalón de 60 y bolsillo de la tapa de 32', () => {
    const d = tubeDims(normalizeParams({ kind: 'tube' }));
    expect(d.R).toBe(30);
    expect(d.bore).toBe(25);
    expect(d.floor).toBe(5);
    expect(d.ledge).toBe(60);
    expect(d.top).toBe(72);
    expect(d.pocket).toBe(32);
    // el filo de la rosca queda 0,4 mm adentro del juego de la tapa
    expect(d.lidBore - d.crest).toBeCloseTo(0.4, 6);
    expect(d.crest - d.root).toBe(1);
  });

  it('moleteado: el dibujo cierra en la vuelta y la cresta llega al radio de la caja', async () => {
    for (const tubeDiameterMm of [40, 63, 80, 97, 120]) {
      const d = tubeDims(normalizeParams({ kind: 'tube', tubeDiameterMm }));
      expect(Number.isInteger(d.knurlStarts)).toBe(true);
      expect(d.knurlPitch * d.knurlStarts).toBeCloseTo(Math.PI * tubeDiameterMm, 6);
    }
    const r = await closedRun({ logo: null });
    for (const i of [0, 1]) {
      const { mn, mx } = bounds(r.items[i].parts[0].positions);
      expect(mx[0] - mn[0]).toBeCloseTo(60, 1);
      expect(mx[1] - mn[1]).toBeGreaterThan(59.5);
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
    ['Ø60 × 110', {}],
    ['Ø60 × 250', { tubeLengthMm: 250 }],
    ['juego de 0,1 mm', { tubeFitMm: 0.1 }],
    ['Ø40', { tubeDiameterMm: 40 }],
    ['Ø120', { tubeDiameterMm: 120, tubeLengthMm: 150 }],
    ['pared de 4 mm', { tubeWallMm: 4 }],
    ['pared de 10 mm', { tubeWallMm: 10 }],
    ['tapa de 30', { tubeLidHeightMm: 30 }],
    ['tapa de 100', { tubeLidHeightMm: 100, tubeLengthMm: 200 }],
    ['agarre en ranura', { jarGrip: 'groove', jarGripDepthMm: 1 }],
    ['agarre liso', { jarGrip: 'none' }],
  ]) {
    it(`${label}: cerrado, la tapa no pisa al cuerpo`, async () => {
      const { body, lid } = closed(await closedRun(over));
      expect(body.intersect(lid).volume()).toBeLessThan(0.01);
    });
  }

  it('la rosca es real: la tapa girada sin subir pisa el cuello, y girada subiendo lo que sube la hélice, no', async () => {
    const r = await closedRun();
    const quarter = closed(r, 90, PITCH / 4);
    expect(quarter.body.intersect(quarter.lid).volume()).toBeLessThan(0.01);
    // una vuelta entera sube un paso y queda igual de libre
    const full = closed(r, 360, PITCH);
    expect(full.body.intersect(full.lid).volume()).toBeLessThan(0.01);
    // al revés (hélice izquierda) o sin subir: choca
    const noLift = closed(r, 90, 0);
    expect(noLift.body.intersect(noLift.lid).volume()).toBeGreaterThan(1);
    const wrongWay = closed(r, 90, -PITCH / 4);
    expect(wrongWay.body.intersect(wrongWay.lid).volume()).toBeGreaterThan(1);
    // y no se saca tirando derecho hacia arriba: los dientes de la tapa traban contra el filo del cuello
    const pull = closed(r, 0, PITCH / 2);
    expect(pull.body.intersect(pull.lid).volume()).toBeGreaterThan(1);
  });

  it('con juego 0,1 la tapa también enrosca (mismo recorrido de la hélice sin pisar)', async () => {
    const r = await closedRun({ tubeFitMm: 0.1 });
    const quarter = closed(r, 90, PITCH / 4);
    expect(quarter.body.intersect(quarter.lid).volume()).toBeLessThan(0.01);
  });

  it('se imprime sin soportes: ninguna cara de afuera pasa de unos 48° con la vertical (cuerpo parado, tapa dada vuelta)', async () => {
    for (const over of [{}, { jarGrip: 'none' }, { jarGrip: 'groove' }, { tubeDiameterMm: 40, tubeWallMm: 4 }]) {
      const r = await run({ caseView: 'print', logo: null, ...over });
      for (const it of r.items) {
        const P = it.merged;
        const { fraction, worstDeg } = scanOverhangs(P.positions, P.indices, 5.5, -0.75);
        // la cara de abajo de la cavidad que se apoya (piso) y el canto de abajo ya quedan fuera por la altura
        expect(fraction, `${it.name} ${JSON.stringify(over)} (peor ${worstDeg}°)`).toBeLessThan(0.002);
      }
    }
  });

  it('el logo no sale espejado ni acostado, en la tapa (vista desde arriba) y en la base (dando vuelta el cuerpo)', async () => {
    const r = await closedRun();
    const flip = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0];
    const lidLogo = transformed(r.items[1].parts[1], r.items[1].viewTransform);
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
      expect(mx[0] - mn[0], name).toBeGreaterThan(mx[1] - mn[1]);
    }
  });

  it('logo grabado: hueco en las dos piezas; del mismo color: cada pieza de una sola parte; sin logo en la base: solo la tapa', async () => {
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
    const lidOnly = await run({ tubeBaseLogo: false });
    expect(lidOnly.items[0].parts.map((p) => p.colorKey)).toEqual(['base']);
    expect(lidOnly.items[1].parts.map((p) => p.colorKey)).toEqual(['base', 'logo']);
  });

  it('logo por separado: cuerpo y tapa dejan el hueco y cada logo es una pieza aparte, acostada', async () => {
    const r = await run({ logoStyle: 'separate', logoFitMm: 0.2 });
    expect(r.messages.filter((m) => m.level === 'error')).toEqual([]);
    expect(r.items.map((it) => it.name)).toEqual(['cuerpo', 'tapa', 'logo cuerpo', 'logo tapa']);
    for (const it of r.items) expect(it.merged.status, it.name).toBe('NoError');
    expect(r.info.needsMMU).toBe(false);
  });

  it('el logo se limita si el fondo es muy delgado para una profundidad de 3 mm', async () => {
    const r = await run({ tubeFloorMm: 2, logoDepthMm: 3 });
    expect(r.messages.map((m) => m.code)).toContain('organizer.logoDepth');
  });

  it('muy corta para el cuello y el bolsillo: error claro', async () => {
    const r = await run({ tubeLengthMm: 60, tubeLidHeightMm: 60 });
    expect(r.items).toEqual([]);
    expect(r.messages.map((m) => m.code)).toContain('organizer.tubeTooShort');
    expect(tubeDims(normalizeParams({ kind: 'tube' })).ok).toBe(true);
  });

  it('vista previa: sin las piezas unidas, mismas medidas', async () => {
    const full = await run();
    const prev = await build(K, { ...defaults, kind: 'tube', curveQuality: 'draft' }, { ...ctx(), preview: true });
    expect(prev.items.map((it) => it.sizeMm.map((v) => Math.round(v)))).toEqual(full.items.map((it) => it.sizeMm.map((v) => Math.round(v))));
    expect(prev.info.triangles).toBeGreaterThan(0);
  });

  it('por defecto el logo va solo en la tapa; el de abajo del cuerpo se activa aparte', async () => {
    expect(defaults.tubeBaseLogo).toBe(false);
    expect(defaults.jarBaseLogo).toBe(false);
    const r = await build(K, { ...defaults, kind: 'tube', curveQuality: 'draft' }, ctx());
    expect(r.items[0].parts.map((p) => p.colorKey)).toEqual(['base']);
    expect(r.items[1].parts.map((p) => p.colorKey)).toEqual(['base', 'logo']);
  });

  it('los parámetros se normalizan y el tipo aparece en el panel, los presets y el resumen del pedido', () => {
    const p = normalizeParams({ kind: 'tube', tubeDiameterMm: 9999, tubeLengthMm: 1, tubeWallMm: 0, tubeFitMm: -3, tubeFloorMm: 'x' });
    expect(p.kind).toBe('tube');
    expect(p.tubeDiameterMm).toBe(120);
    expect(p.tubeLengthMm).toBe(60);
    expect(p.tubeWallMm).toBe(4);
    expect(p.tubeFitMm).toBe(0.1);
    expect(p.tubeFloorMm).toBe(defaults.tubeFloorMm);
    const kinds = organizer.schema.flatMap((s) => s.controls).find((c) => c.key === 'kind');
    expect(kinds.options.map(([v]) => v)).toContain('tube');
    // el logo de la tapa va contra la cama: no puede sobresalir
    expect(kinds.alsoSet('tube', { ...defaults, logoStyle: 'relief' })).toEqual({ logoStyle: 'flush' });
    expect(organizer.presets.filter((pr) => pr.params.kind === 'tube')).toHaveLength(8);
    const tube = organizer.schema.find((s) => s.section === 'tube');
    expect(tube.showIf({ kind: 'tube' })).toBe(true);
    expect(tube.showIf({ kind: 'jar' })).toBe(false);
    const c = { lang: 'es', color: (x) => x, option: (k, v) => v, logo: (id) => id };
    expect(Object.fromEntries(organizer.orderSummary({ ...defaults, kind: 'tube' }, c)).Medidas).toBe('Ø60 × 110 mm (adentro 100 mm)');
    expect(Object.fromEntries(organizer.orderSummary({ ...defaults, kind: 'tube', tubeDiameterMm: 80, tubeLengthMm: 150 }, { ...c, lang: 'en' })).Sizes).toBe('Ø80 × 150 mm (inside 140 mm)');
  });
});
