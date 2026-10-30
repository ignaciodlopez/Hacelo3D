// Generación del organizador de escritorio. FUNCIÓN PURA: params → BuildResult (sin DOM ni three.js).
//
// Una sola pieza, parada y sin soportes, armada con módulos que se acomodan solos (ver layout.js):
//   - lapicero: celdas redondas, cuadradas o hexagonales en filas escalonadas (la de atrás, más alta)
//   - celular: ranura inclinada con labio adelante, respaldo atrás y muesca para el cable
//   - notas adhesivas: bolsillo para un taco de Post-it, con muesca para agarrar las hojas
//   - tarjetas: ranura inclinada para tarjetas personales
//   - bandeja: franja baja adelante, a todo lo ancho, con fondo redondeado
//   - texto en el frente: grabado o en relieve
// Todas las cavidades se abren hacia arriba. El frente es la cara de -Y; el centro del bloque está en el origen (en
// planta) y apoya en z = 0.

import { createScope } from '../../core/kernel/manifold.js';
import { textToCrossSection } from '../../core/kernel/text.js';
import { roundedRect, segmentsFor } from '../../core/kernel/shapes2d.js';
import { manifoldToMesh, mergeParts } from '../../core/kernel/mesh.js';
import { analyzeParts, fitsBed, round } from '../../core/kernel/analysis.js';
import { normalizePrinter, snapZ } from '../../core/printer/profiles.js';
import { normalizeParams, qualityOf } from './params.js';
import { layoutDesk, CARD, PHONE_PLAY_T, SLOT_LIP_FRONT } from './layout.js';

const PART_LABEL = { base: 'Base', text: 'Texto' };
const SQ3 = Math.sqrt(3);
/** Chaflán de entrada de las celdas del lapicero (mm). */
const CHAMFER = 0.6;
/** Lo que queda como mínimo de plano arriba de una pared entre el canto redondeado y el chaflán de la celda (mm). */
const MIN_RIM = 0.9;
/** Alto del zócalo que une los módulos (mm). */
const PLINTH = 5;
/** Ancho de la muesca del cable en el labio del celular (mm). */
const CABLE_W = 12;
/** Pared que queda detrás del texto, y cuánto entra en la pared el texto en relieve (mm). */
const MIN_BEHIND = 0.8;
const TEXT_EMBED = 0.4;
/** Aire entre el texto y los bordes del frente (mm). */
const TEXT_MARGIN = 3;
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * @param {any} K  módulo manifold-3d ya inicializado
 * @param {any} rawParams
 * @param {{ getFont:(id:string)=>Promise<any>, printer?:any, preview?:boolean }} ctx
 */
export async function build(K, rawParams, ctx) {
  const p = normalizeParams(rawParams);
  const printer = normalizePrinter(ctx.printer);
  const messages = [];
  const lay = layoutDesk(p);
  messages.push(...lay.messages);
  if (!lay.ok) return fail(messages);
  const wantsLabel = p.label.trim() !== '';
  const font = wantsLabel ? await ctx.getFont(p.fontId).catch(() => null) : null;

  const sc = createScope();
  const t = sc.track;
  try {
    const { seg, tol } = qualityOf(p.curveQuality);
    const zf = (z) => (p.snapToLayers ? snapZ(z, printer) : z);
    const wall = p.wallMm;
    const floor = zf(p.floorMm);
    const W = lay.width;
    const Dt = lay.depth;
    const yFront = lay.mainY0 - wall;
    const yBack = lay.mainY1 + wall;

    /** Caja entre dos esquinas. */
    const box = (x0, x1, y0, y1, z0, z1) => t(t(K.Manifold.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    /** Perfil en el plano YZ (puntos [y, z]) extruido a lo largo de X, de x0 a x1. */
    const alongX = (points, x0, x1) => t(t(t(t(new K.CrossSection([points], 'NonZero')).extrude(x1 - x0)).rotate([90, 0, 90])).translate([x0, 0, 0]));

    // Bloques con esquinas verticales redondeadas y el canto de arriba redondeado: el casco convexo de cuatro "pucks"
    // (cilindros con el borde de arriba redondeado) que pueden tener distinta altura adelante y atrás (cuña) y distinto
    // radio en cada esquina. Abajo quedan planos y verticales: se imprimen sin soportes.
    const rEdge = Math.min(p.edgeRadiusMm, Math.max(0, wall - CHAMFER - MIN_RIM));
    const rOut = Math.max(0.01, Math.min(p.cornerRadiusMm, W / 2 - 1, Dt / 2 - 1));
    const rIn = Math.max(0.01, rEdge);
    const pucks = new Map();
    const puck = (rad, h) => {
      const key = `${rad.toFixed(3)}|${h.toFixed(3)}`;
      if (!pucks.has(key)) {
        const f = Math.min(rEdge, rad, h / 2);
        const pts = [[0, 0], [rad, 0]];
        if (f > 0.05) {
          const n = Math.max(4, Math.round(6 * seg) + 2);
          for (let i = 0; i <= n; i++) {
            const a = (i / n) * (Math.PI / 2);
            pts.push([rad - f + f * Math.cos(a), h - f + f * Math.sin(a)]);
          }
        } else pts.push([rad, h]);
        pts.push([0, h]);
        pucks.set(key, t(K.Manifold.revolve(t(new K.CrossSection([pts], 'NonZero')), segmentsFor(rad, seg))));
      }
      return pucks.get(key);
    };
    const onEdgeX = (x) => Math.abs(Math.abs(x) - W / 2) < 1e-6;
    const onEdgeY = (y) => Math.abs(Math.abs(y) - Dt / 2) < 1e-6;
    // con ranura entre módulos cada uno es un bloque redondeado entero; con paredes compartidas solo son redondas las
    // esquinas de afuera del conjunto (las de los empalmes, apenas)
    const separate = p.podGapMm > 0;
    /** Bloque entre dos esquinas, de altura `hf` adelante (y0) y `hb` atrás (y1). Con `step`, las de adelante son chicas. */
    const soft = (x0, x1, y0, y1, hf, hb, step = false) => {
      const maxR = Math.min((x1 - x0) / 2, (y1 - y0) / 2);
      const at = (x, y, h, sx, sy) => {
        const big = (separate || (onEdgeX(x) && onEdgeY(y))) && !(step && sy > 0);
        const rr = Math.max(0.01, Math.min(big ? rOut : rIn, maxR));
        return t(puck(rr, h).translate([x + sx * rr, y + sy * rr, 0]));
      };
      return t(K.Manifold.hull([at(x0, y0, hf, 1, 1), at(x1, y0, hf, -1, 1), at(x1, y1, hb, -1, -1), at(x0, y1, hb, 1, -1)]));
    };

    const adds = [];
    const cuts = [];
    const heights = [];
    const tops = {};

    for (const z of lay.zones) {
      const xa = z.x0 - wall;
      const xb = z.x1 + wall;
      const cx = (z.x0 + z.x1) / 2;
      const cy = (z.y0 + z.y1) / 2;

      if (z.kind === 'pens') {
        // una fila por escalón (de adelante hacia atrás); cada una llega hasta el fondo con su altura, así la pared que
        // separa dos filas toma la altura de la más alta
        const rows = p.penRows;
        const { cell } = z;
        const rowTop = (i) => zf(Math.max(floor + 10, p.penHeightMm - (rows - 1 - i) * p.penStepMm));
        const R = p.penShape === 'round' ? p.penCellMm / 2 : p.penCellMm / SQ3;
        const half = p.penShape === 'square' ? p.penCellMm / 2 : R;
        const shape =
          p.penShape === 'round' ? t(K.CrossSection.circle(R, segmentsFor(R, seg))) : p.penShape === 'square' ? t(K.CrossSection.square([p.penCellMm, p.penCellMm], true)) : t(K.CrossSection.circle(R, 6));
        const k = (half + CHAMFER) / half;
        for (let i = 0; i < rows; i++) {
          const top = rowTop(i);
          heights.push(top);
          const rowY0 = z.y0 + i * (cell.d + wall);
          adds.push(soft(xa, xb, i === 0 ? yFront : rowY0 - wall, yBack, top, top, i > 0));
          for (let j = 0; j < p.penCols; j++) {
            const x = z.x0 + cell.w / 2 + j * (cell.w + wall);
            const y = rowY0 + cell.d / 2;
            cuts.push(t(t(shape.extrude(top - floor + 1)).translate([x, y, floor])));
            // chaflán de entrada (cono a 45°); no se mete en la pared de atrás si esa es más alta (quedaría un techo)
            const cone = t(t(shape.extrude(CHAMFER + 0.01, 0, 0, [k, k])).translate([x, y, top - CHAMFER]));
            cuts.push(i < rows - 1 ? t(cone.intersect(box(x - 100, x + 100, y - 100, rowY0 + cell.d, 0, 400))) : cone);
          }
        }
        tops.pens = rowTop(0);
      } else if (z.kind === 'notes') {
        const h = zf(z.height);
        heights.push(h);
        adds.push(soft(xa, xb, yFront, yBack, h, h));
        // esquinas del bolsillo concéntricas con las de afuera (pared pareja), sin llegar a tocar las del taco (que son vivas)
        const rPocket = Math.max(0.5, Math.min((separate ? rOut : rIn) - wall, 3.4 * p.notesClearanceMm, z.w / 2 - 0.1));
        cuts.push(t(t(roundedRect(K, t, z.w, z.d, rPocket, cx, cy, seg).extrude(h - floor + 1)).translate([0, 0, floor])));
        if (p.notesNotch) {
          // semicírculo en la pared de adelante para meter el dedo y sacar las hojas
          const r = Math.min(15, 0.2 * z.w, h - floor - 6);
          if (r >= 4) {
            const len = z.y0 - yFront + 2;
            const cyl = t(K.Manifold.cylinder(len, r, r, segmentsFor(r, seg)));
            cuts.push(t(t(t(cyl.rotate([-90, 0, 0]))).translate([cx, yFront - 1, h])));
            tops.notchR = r;
          }
        }
        tops.notes = h;
      } else {
        // ranura inclinada (celular o tarjetas): el fondo es plano, la cara de atrás sube apoyada y la de adelante
        // vuela el ángulo de la ranura (como mucho 30°, así que se imprime sin soportes)
        const phone = z.kind === 'phone';
        const th = phone ? p.phoneThicknessMm + PHONE_PLAY_T : CARD.slotMm;
        const angle = rad(phone ? p.phoneAngleDeg : CARD.angleDeg);
        const lip = phone ? p.phoneLipMm : CARD.lipMm;
        const top = zf(z.height);
        heights.push(top);
        const tan = Math.tan(angle);
        const yf = z.y0 + SLOT_LIP_FRONT;
        const z1 = zf(floor + lip);
        // base a la altura del labio, a todo lo largo del frente; atrás, el respaldo en cuña (sube del labio al alto del
        // respaldo, de adelante hacia atrás)
        adds.push(soft(xa, xb, yFront, yBack, z1, z1));
        adds.push(soft(xa, xb, yf, yBack, z1, top, true));
        const hw = th / Math.cos(angle);
        const topZ = top + 2;
        const L = (topZ - floor) / Math.cos(angle);
        const ya = yf + (z1 - floor) * tan;
        // un solo perfil: la ranura (fondo plano, cara de atrás que sube apoyada y cara de adelante que vuela el ángulo)
        // más lo que queda adelante de ella por encima del labio
        cuts.push(
          alongX(
            [
              [yf, floor],
              [yf + hw, floor],
              [yf + hw + L * Math.sin(angle), topZ],
              [yf - 1, topZ],
              [yf - 1, z1],
              [ya, z1],
            ],
            z.x0,
            z.x1,
          ),
        );
        if (phone && p.phoneCable) {
          // muesca en el labio, hasta el fondo de la ranura: el cable pasa por debajo del celular
          // con bandeja la muesca pasa también la pared que la separa de la ranura (abierta arriba, sin puente)
          const trayTop = lay.tray ? zf(p.trayHeightMm) : 0;
          cuts.push(box(cx - CABLE_W / 2, cx + CABLE_W / 2, yFront - 1, ya + 0.5, floor, Math.max(z1, trayTop) + 1));
        }
        tops[z.kind] = z1;
      }
    }

    // ---- bandeja: franja baja adelante, a todo lo ancho
    let trayCavity = null;
    let scoops = null;
    if (lay.tray) {
      const h = zf(p.trayHeightMm);
      heights.push(h);
      adds.push(soft(-W / 2, W / 2, -Dt / 2, lay.tray.y1 + wall, h, h));
      const n = p.trayDividers + 1;
      const iw = W - 2 * wall;
      const cw = (iw - (n - 1) * wall) / n;
      const depth = lay.tray.y1 - lay.tray.y0;
      const comps = Array.from({ length: n }, (_, i) => -iw / 2 + i * (cw + wall));
      // esquinas concéntricas con las de afuera (pared pareja)
      const rc = Math.max(0.5, Math.min(rOut - wall, depth / 2 - 0.1, cw / 2 - 0.1));
      trayCavity = t(K.Manifold.union(comps.map((x0) => t(t(roundedRect(K, t, cw, depth, rc, x0 + cw / 2, (lay.tray.y0 + lay.tray.y1) / 2, seg).extrude(h - floor + 1)).translate([0, 0, floor])))));
      cuts.push(trayCavity);
      const r = Math.min(12, depth * 0.5, h - floor - 1);
      if (p.trayScoop && r >= 2) {
        const nseg = segmentsFor(r, seg);
        scoops = t(
          K.Manifold.union(
            comps.map((x0) => {
              const block = box(x0, x0 + cw, lay.tray.y0, lay.tray.y0 + r, floor, floor + r);
              const cyl = t(t(t(K.Manifold.cylinder(cw + 2, r, r, nseg)).rotate([0, 90, 0])).translate([x0 - 1, lay.tray.y0 + r, floor + r]));
              return t(block.subtract(cyl));
            }),
          ),
        );
      }
      tops.tray = h;
    }

    // zócalo bajo continuo: une los módulos y deja la ranura entre ellos
    if (separate && lay.zones.length + (lay.tray ? 1 : 0) > 1) {
      const plinth = zf(Math.max(floor + 1.2, PLINTH));
      adds.push(soft(-W / 2, W / 2, -Dt / 2, Dt / 2, plinth, plinth));
    }
    const maxH = Math.max(...heights);
    const outer = t(roundedRect(K, t, W, Dt, rOut, 0, 0, seg).extrude(maxH + 1));
    let base = t(t(K.Manifold.union(adds)).intersect(outer));
    base = t(base.subtract(t(K.Manifold.union(cuts))));
    // fondo redondeado de la bandeja, recortado al hueco (no se asoma por las paredes)
    if (scoops && trayCavity) base = t(K.Manifold.union([base, t(scoops.intersect(trayCavity))]));

    // ---- texto en el frente
    let text = null;
    if (wantsLabel) {
      const placed = labelOnFront(K, t, p, font, { zones: lay.zones, tops, W, rOut, yFront: -Dt / 2, tol }, messages);
      if (placed) {
        const sameColor = p.colors.text === p.colors.base;
        if (p.labelStyle === 'engraved') base = t(base.subtract(placed.solid));
        else if (sameColor) base = t(K.Manifold.union([base, placed.solid]));
        else {
          // la pieza le deja su lugar: el texto entra un poco en la pared, así queda trabado y no solo apoyado
          base = t(base.subtract(placed.solid));
          text = placed.solid;
        }
      }
    }

    const item = makeItem({ K, t, p, printer, preview: !!ctx.preview }, 'escritorio', [
      ['base', base],
      ['text', text],
    ]);
    const [sx, sy] = item.sizeMm;
    if (!fitsBed(sx, sy, printer.bed)) messages.push({ level: 'warn', code: 'size.bedOverflow', params: { w: round(sx, 1), h: round(sy, 1) } });
    if (item.analysis.needsMMU && !printer.multiMaterial) messages.push({ level: 'warn', code: 'color.needsMMU' });
    return {
      items: [item],
      plates: null,
      bed: null,
      messages,
      info: { colorChanges: item.analysis.colorChanges, gramsByColor: item.analysis.gramsByColor, needsMMU: item.analysis.needsMMU, triangles: item.triangles, sizeMm: [W, Dt, maxH] },
    };
  } finally {
    sc.dispose();
  }
}

function fail(messages) {
  return { items: [], messages, info: { colorChanges: null, gramsByColor: {}, needsMMU: false, triangles: 0 } };
}

/** Una pieza con sus partes de color: `[colorKey, manifold|null]`. */
function makeItem(env, name, list) {
  const { K, t, p } = env;
  const groups = list.filter(([, m]) => m && !m.isEmpty());
  const parts = groups.map(([colorKey, m]) => {
    const bb = m.boundingBox();
    return {
      id: colorKey,
      label: PART_LABEL[colorKey],
      colorKey,
      color: p.colors[colorKey],
      ...manifoldToMesh(m),
      volumeMm3: m.volume(),
      zMin: bb.min[2],
      zMax: bb.max[2],
      status: m.status(),
      genus: m.genus(),
    };
  });
  const { merged, box: mb, triangles } = mergeParts(K, t, groups.map(([, m]) => m), env.preview);
  return {
    name,
    parts,
    merged,
    sizeMm: [mb.max[0] - mb.min[0], mb.max[1] - mb.min[1], mb.max[2] - mb.min[2]],
    offsetXY: [0, 0],
    bboxXY: [mb.min[0], mb.min[1], mb.max[0], mb.max[1]],
    triangles,
    analysis: analyzeParts(parts, env.printer),
  };
}

// ---------------------------------------------------------------------------
// Texto en el frente
// ---------------------------------------------------------------------------

/**
 * El texto, de pie sobre la cara de -Y: la bandeja si hay; si no, el lapicero, las notas o el celular (sin la muesca del
 * cable en el medio). Devuelve el sólido del texto en su lugar (grabado: lo que se resta; relieve: lo que sobresale y
 * entra un poco en la pared), o null si no hay lugar.
 */
function labelOnFront(K, t, p, font, o, messages) {
  if (!font) {
    messages.push({ level: 'warn', code: 'desk.labelNoRoom' });
    return null;
  }
  const { zones, tops, W, rOut, yFront, tol } = o;
  const faces = [];
  if (tops.tray) faces.push({ xc: 0, w: W - 2 * rOut, h: tops.tray, zc: tops.tray / 2 });
  const pens = zones.find((z) => z.kind === 'pens');
  if (pens) faces.push({ xc: (pens.x0 + pens.x1) / 2, w: pens.w, h: tops.pens, zc: tops.pens / 2 });
  const notes = zones.find((z) => z.kind === 'notes');
  if (notes) {
    // bajo la muesca de las hojas, si la hay
    const h = tops.notchR ? tops.notes - tops.notchR : tops.notes;
    faces.push({ xc: (notes.x0 + notes.x1) / 2, w: notes.w, h, zc: h / 2 });
  }
  const phone = zones.find((z) => z.kind === 'phone');
  if (phone && !p.phoneCable) faces.push({ xc: (phone.x0 + phone.x1) / 2, w: phone.w, h: tops.phone, zc: tops.phone / 2 });
  const labelText = p.label.trim();
  for (const f of faces) {
    const size = Math.min(p.labelSizeMm, f.h - 2 * 2);
    const maxW = f.w - 2 * TEXT_MARGIN;
    if (size < 3 || maxW < 8) continue;
    const r = textToCrossSection(K, t, font, { lines: [labelText], sizeMode: 'capHeight', sizeMm: size, tolMm: tol });
    if (!r.cs) break;
    const lw = r.bbox.maxX - r.bbox.minX;
    const fit = Math.min(1, maxW / lw);
    const cs = t(t(r.cs.scale([fit, fit])).translate([f.xc, 0]));
    // el texto no puede atravesar la pared de adelante
    const maxInset = p.wallMm - MIN_BEHIND;
    let d = p.labelDepthMm;
    if (d > maxInset) {
      d = Math.max(0.2, maxInset);
      messages.push({ level: 'warn', code: 'desk.labelDepth', params: { mm: round(d, 1) } });
    }
    const relief = p.labelStyle === 'relief';
    const embed = relief ? Math.min(TEXT_EMBED, maxInset) : 0;
    // el dibujo se extruye en Z y se lo para sobre el frente: x queda igual, la Y del dibujo pasa a ser la altura y el
    // espesor va hacia -Y
    const solid = t(t(t(cs.extrude(relief ? d + embed : d + 1)).rotate([90, 0, 0])).translate([0, relief ? yFront + embed : yFront + d, f.zc]));
    return { solid };
  }
  messages.push({ level: 'warn', code: 'desk.labelNoRoom' });
  return null;
}
