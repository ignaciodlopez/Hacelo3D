// Generación de los organizadores de taller. FUNCIÓN PURA: params → BuildResult (sin DOM ni three.js).
//
// Cuatro tipos, para imprimir sin soportes:
//   - estuche porta mechas: caja con tapa, bisagras y trabas, con el logo en la tapa (ver case.js; varias piezas)
//   - caja con divisiones (tornillos, clavos, tarugos): celdas con el fondo de adelante redondeado para sacar las piezas
//   - soporte de mechas: bloque escalonado con un agujero por medida y la medida grabada adelante
//   - porta puntas: bloque escalonado con agujeros hexagonales de 1/4"
// En los tres últimos el logo va en el frente (la cara de -Y): sobresale, queda al ras en su color o grabado.
// El centro de la pieza está en el origen (en planta) y apoya en z = 0.

import { createScope } from '../../core/kernel/manifold.js';
import { textToCrossSection } from '../../core/kernel/text.js';
import { roundedRect, segmentsFor } from '../../core/kernel/shapes2d.js';
import { manifoldToMesh, mergeParts } from '../../core/kernel/mesh.js';
import { analyzeParts, fitsBed, round } from '../../core/kernel/analysis.js';
import { normalizePrinter, snapZ } from '../../core/printer/profiles.js';
import { normalizeParams, parseDrillSizes, qualityOf, BIT_HEX_MM } from './params.js';
import { buildCase } from './case.js';

const PART_LABEL = { base: 'Cuerpo', logo: 'Logo', latch: 'Trabas' };
const NAME = { box: 'caja', drills: 'soporte de mechas', bits: 'porta puntas' };
/** Aire entre el logo y los bordes del frente (mm). */
const LOGO_MARGIN = 3;
/** Pared que queda detrás de un logo al ras (mm), y cuánto entra en la pared el logo en relieve. */
const MIN_BEHIND = 0.8;
const LOGO_EMBED = 0.4;
/** Soporte de mechas: franja delante de cada fila donde va la medida, y profundidad del grabado (mm). */
const LABEL_ZONE = 7;
const LABEL_DEPTH = 0.6;
/** Ancho mínimo de cada lugar del soporte de mechas para que entre el número (mm). */
const LABEL_MIN_W = 7;
/** Piso que queda bajo los agujeros, y chaflán de entrada para que la mecha o la punta entre fácil (mm). */
const HOLE_FLOOR = 1.6;
const CHAMFER = 0.6;
/** Separación entre las piezas del estuche sobre la cama (mm). */
const BED_GAP = 8;

/**
 * @param {any} K  módulo manifold-3d ya inicializado
 * @param {any} rawParams
 * @param {{ getFont:(id:string)=>Promise<any>, printer?:any, preview?:boolean, logoPolys?:Record<string, number[][][]> }} ctx
 */
export async function build(K, rawParams, ctx) {
  const p = normalizeParams(rawParams);
  const printer = normalizePrinter(ctx.printer);
  const messages = [];
  const logoPolys = p.logo ? (ctx.logoPolys?.[p.logo] ?? null) : null;
  if (p.logo && !logoPolys) messages.push({ level: 'warn', code: 'organizer.logoMissing' });
  const font = p.kind === 'drills' && p.drillLabels ? await ctx.getFont('lato-black').catch(() => null) : null;

  const sc = createScope();
  const t = sc.track;
  try {
    const { seg, tol } = qualityOf(p.curveQuality);
    const zf = (z) => (p.snapToLayers ? snapZ(z, printer) : z);
    const env = { K, t, p, printer, messages, preview: !!ctx.preview };
    if (p.kind === 'case') return caseResult(env, buildCase(K, t, p, { zf, seg, logo2d: logo2dOf(K, t, logoPolys) }));

    const body = p.kind === 'box' ? buildBox(K, t, p, zf, seg, messages) : buildHolder(K, t, p, zf, seg, tol, font, messages);
    if (!body) return fail(messages);

    // ---- logo en el frente
    let base = body.solid;
    let logo = logoPolys ? logoOnFront(K, t, p, logoPolys, body.front, messages) : null;
    // un logo del mismo color que la pieza va junto con ella (una sola pieza, sin cambio de color); de otro color, la
    // pieza le deja su lugar (el logo siempre entra un poco en la pared: así queda trabado y no solo apoyado).
    // Grabado: el logo es un hueco en la pieza.
    const engraved = p.logoStyle === 'engraved';
    const sameColor = p.colors.logo === p.colors.base;
    if (logo) base = sameColor && !engraved ? t(K.Manifold.union([base, logo])) : t(base.subtract(logo));
    if (engraved || sameColor) logo = null;
    const item = makeItem(env, NAME[p.kind], [
      ['base', base],
      ['logo', logo],
    ]);
    item.holes = body.holes;
    const [sx, sy] = item.sizeMm;
    if (!fitsBed(sx, sy, printer.bed)) messages.push({ level: 'warn', code: 'size.bedOverflow', params: { w: round(sx, 1), h: round(sy, 1) } });
    if (item.analysis.needsMMU && !printer.multiMaterial) messages.push({ level: 'warn', code: 'color.needsMMU' });
    return {
      items: [item],
      plates: null,
      bed: null,
      messages,
      info: { colorChanges: item.analysis.colorChanges, gramsByColor: item.analysis.gramsByColor, needsMMU: item.analysis.needsMMU, triangles: item.triangles },
    };
  } finally {
    sc.dispose();
  }
}

function fail(messages) {
  return { items: [], messages, info: { colorChanges: null, gramsByColor: {}, needsMMU: false, triangles: 0 } };
}

/**
 * Una pieza con sus partes de color: `[colorKey, manifold|null]`.
 * @returns {any} item del BuildResult
 */
function makeItem(env, name, list) {
  const { K, t, p, printer } = env;
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
    analysis: analyzeParts(parts, printer),
  };
}

/** Logo de la marca como CrossSection centrado en el origen (sin escalar), o null. */
function logo2dOf(K, t, polys) {
  if (!polys) return null;
  const raw = t(new K.CrossSection(polys, 'NonZero'));
  if (raw.isEmpty()) return null;
  const b = raw.bounds();
  return t(raw.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]));
}

// ---------------------------------------------------------------------------
// Estuche porta mechas: varias piezas
// ---------------------------------------------------------------------------

function caseResult(env, c) {
  const { K, t, p, printer, messages } = env;
  const engraved = p.logoStyle === 'engraved';
  const sameColor = p.colors.logo === p.colors.base;
  // grabado: el hueco queda vacío; del mismo color: el logo rellena su hueco (no se ve, pero la tapa queda entera)
  const lid = c.logo && sameColor && !engraved ? t(K.Manifold.union([c.lid, c.logo])) : c.lid;
  const logo = c.logo && !sameColor && !engraved ? c.logo : null;
  if (c.logoInfo?.clipped) messages.push({ level: 'warn', code: 'organizer.logoDepth', params: { mm: round(c.logoInfo.depthMm, 1) } });

  const items = [
    { key: 'base', ...makeItem(env, 'base', [['base', c.base]]) },
    { key: 'lid', ...makeItem(env, 'tapa', [['base', lid], ['logo', logo]]), view: c.lidView },
    ...c.latchViews.map((view, i) => ({ key: 'latch', ...makeItem(env, `traba ${i + 1}`, [['latch', c.latch]]), view })),
  ];

  // sobre la cama: base, tapa y las trabas, una fila detrás de la otra
  let y = 0;
  const rowOf = (list) => {
    const h = Math.max(...list.map((it) => it.bboxXY[3] - it.bboxXY[1]));
    let x = -list.reduce((s, it) => s + it.bboxXY[2] - it.bboxXY[0], 0) / 2 - (BED_GAP * (list.length - 1)) / 2;
    for (const it of list) {
      it.offsetXY = [x - it.bboxXY[0], y - it.bboxXY[1]];
      x += it.bboxXY[2] - it.bboxXY[0] + BED_GAP;
    }
    y += h + BED_GAP;
  };
  rowOf([items[0]]);
  rowOf([items[1]]);
  rowOf(items.slice(2));
  const shift = (y - BED_GAP) / 2;
  for (const it of items) it.offsetXY = [it.offsetXY[0], it.offsetXY[1] - shift];

  // cerrado: cada pieza en su lugar (la tapa vuelve a estar arriba, las trabas trabadas)
  for (const it of items) {
    if (p.caseView === 'closed') it.viewTransform = it.view ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
    delete it.view;
  }

  for (const it of items) {
    const [sx, sy] = it.sizeMm;
    if (!fitsBed(sx, sy, printer.bed)) messages.push({ level: 'warn', code: 'size.bedOverflow', params: { w: round(sx, 1), h: round(sy, 1) } });
  }
  const needsMMU = items.some((it) => it.analysis.needsMMU);
  if (needsMMU && !printer.multiMaterial) messages.push({ level: 'warn', code: 'color.needsMMU' });
  messages.push({ level: 'info', code: 'organizer.caseAssembly' });

  const gramsByColor = {};
  for (const it of items) for (const pt of it.parts) gramsByColor[pt.colorKey] = (gramsByColor[pt.colorKey] ?? 0) + (pt.volumeMm3 / 1000) * printer.densityGcm3;
  return {
    items,
    plates: null,
    bed: null,
    messages,
    info: {
      colorChanges: null,
      gramsByColor,
      needsMMU,
      triangles: items.reduce((s, it) => s + it.triangles, 0),
      // la medida del estuche cerrado (sin bisagras ni trabas), que es la que importa al pedirlo
      sizeMm: c.sizeMm,
    },
  };
}

// ---------------------------------------------------------------------------
// Caja con divisiones
// ---------------------------------------------------------------------------

function buildBox(K, t, p, zf, seg, messages) {
  const W = p.boxWidthMm;
  const D = p.boxDepthMm;
  const H = zf(p.boxHeightMm);
  const floor = zf(p.floorMm);
  const wall = p.wallMm;
  const div = p.dividerMm;
  const rOut = Math.max(0.01, Math.min(p.cornerRadiusMm, W / 2 - wall - 1, D / 2 - wall - 1));
  const iw = W - 2 * wall;
  const id = D - 2 * wall;
  const cw = (iw - (p.boxCols - 1) * div) / p.boxCols;
  const ch = (id - (p.boxRows - 1) * div) / p.boxRows;
  if (cw < 6 || ch < 6 || H - floor < 3) {
    messages.push({ level: 'error', code: 'organizer.cellsTooSmall' });
    return null;
  }
  // las esquinas de las celdas siguen la curva de afuera (o 1 mm, para que se limpien fácil)
  const rCell = Math.max(0.01, Math.min(Math.max(rOut - wall, 1), cw / 2, ch / 2));
  const cells = [];
  for (let i = 0; i < p.boxCols; i++) {
    for (let j = 0; j < p.boxRows; j++) cells.push({ cx: -iw / 2 + cw / 2 + i * (cw + div), cy: -id / 2 + ch / 2 + j * (ch + div) });
  }
  const outer = t(roundedRect(K, t, W, D, rOut, 0, 0, seg).extrude(H));
  const cav2d = t(K.CrossSection.union(cells.map((c) => roundedRect(K, t, cw, ch, rCell, c.cx, c.cy, seg))));
  const cav = t(t(cav2d.extrude(H - floor + 1)).translate([0, 0, floor]));
  let solid = t(outer.subtract(cav));

  // divisiones más bajas que las paredes: se rebaja todo el interior por encima de su altura
  if (p.dividerHeightPct < 100 && cells.length > 1) {
    const zDiv = zf(floor + ((H - floor) * p.dividerHeightPct) / 100);
    if (zDiv < H - 1e-6) {
      const top = t(t(roundedRect(K, t, iw, id, Math.max(0.01, rOut - wall), 0, 0, seg).extrude(H - zDiv + 1)).translate([0, 0, zDiv]));
      solid = t(solid.subtract(top));
    }
  }

  // fondo redondeado contra la pared de adelante de cada celda: las piezas chicas salen deslizando el dedo
  if (p.scoop) {
    const r = Math.min(p.scoopRadiusMm, ch * 0.5, H - floor - 1);
    if (r >= 2) {
      const n = segmentsFor(r, seg);
      const scoops = cells.map(({ cx, cy }) => {
        const x0 = cx - cw / 2;
        const y0 = cy - ch / 2;
        const block = t(t(K.Manifold.cube([cw, r, r])).translate([x0, y0, floor]));
        const cyl = t(t(t(K.Manifold.cylinder(cw + 2, r, r, n)).rotate([0, 90, 0])).translate([x0 - 1, y0 + r, floor + r]));
        return t(block.subtract(cyl));
      });
      // recortado al hueco de las celdas: en las esquinas redondeadas no se asoma por la pared
      solid = t(K.Manifold.union([solid, t(t(K.Manifold.union(scoops)).intersect(cav))]));
    }
  }
  return { solid, holes: cells.length, front: { w: W - 2 * rOut, h: H, y: -D / 2, zc: H / 2, maxInset: wall - MIN_BEHIND } };
}

// ---------------------------------------------------------------------------
// Porta mechas y porta puntas: bloque escalonado con agujeros
// ---------------------------------------------------------------------------

/** "4.5" → "4,5" (medida grabada). */
const fmt = (d) => String(Math.round(d * 100) / 100).replace('.', ',');

function buildHolder(K, t, p, zf, seg, tol, font, messages) {
  const bits = p.kind === 'bits';
  /** Filas (de adelante hacia atrás) de agujeros: `R` radio (para el hexágono, al vértice), `wx`/`wy` lo que ocupan en planta. */
  let rows;
  if (bits) {
    const af = BIT_HEX_MM + p.bitClearanceMm;
    const R = af / Math.sqrt(3);
    rows = Array.from({ length: p.bitRows }, () => Array.from({ length: p.bitCols }, () => ({ hex: true, R, wx: 2 * R, wy: af })));
  } else {
    const { sizes, bad } = parseDrillSizes(p.drillSizes);
    if (bad.length) messages.push({ level: 'warn', code: 'organizer.badSizes', params: { list: bad.slice(0, 8).join(' ') } });
    if (!sizes.length) {
      messages.push({ level: 'error', code: 'organizer.noSizes' });
      return null;
    }
    const per = Math.ceil(sizes.length / Math.min(p.drillRows, sizes.length));
    rows = [];
    for (let i = 0; i < sizes.length; i += per) {
      rows.push(
        sizes.slice(i, i + per).map((d) => {
          const hole = d + p.drillClearanceMm;
          return { hex: false, R: hole / 2, wx: hole, wy: hole, label: fmt(d) };
        }),
      );
    }
  }
  const labels = !bits && p.drillLabels && !!font;
  const g = p.gapMm;
  const m = Math.max(g, 3);
  const zone = labels ? LABEL_ZONE : 0;
  const cellW = (h) => Math.max(h.wx, labels ? LABEL_MIN_W : 0) + g;
  const contentW = (row) => row.reduce((s, h) => s + cellW(h), 0) - g;
  const W = Math.max(...rows.map(contentW)) + 2 * m;

  // de adelante hacia atrás: cada fila es un escalón más alto que la anterior
  const depth = bits ? p.bitDepthMm : p.drillDepthMm;
  const top0 = zf(depth + HOLE_FLOOR);
  const layout = [];
  let y = 0;
  rows.forEach((row, i) => {
    const maxWy = Math.max(...row.map((h) => h.wy));
    const front = i === 0 ? m : g / 2;
    const back = i === rows.length - 1 ? m : g / 2;
    layout.push({ row, y0: y, holeCy: y + front + zone + maxWy / 2, labelCy: y + front + zone / 2, top: zf(top0 + i * p.stepMm) });
    y += front + zone + maxWy + back;
  });
  const D = y;

  const steps = layout.map((l) => t(t(K.Manifold.cube([W, D - l.y0, l.top])).translate([-W / 2, l.y0, 0])));
  let solid = steps.length === 1 ? steps[0] : t(K.Manifold.union(steps));

  const cuts = [];
  for (const l of layout) {
    let x = -contentW(l.row) / 2;
    for (const h of l.row) {
      const cx = x + (cellW(h) - g) / 2;
      x += cellW(h);
      const shape = h.hex ? t(K.CrossSection.circle(h.R, 6)) : t(K.CrossSection.circle(h.R, segmentsFor(h.R, seg)));
      const hd = Math.min(depth, l.top - HOLE_FLOOR);
      cuts.push(t(t(shape.extrude(hd + 1)).translate([cx, l.holeCy, l.top - hd])));
      // chaflán de entrada (cono a 45°)
      const k = (h.R + CHAMFER) / h.R;
      cuts.push(t(t(shape.extrude(CHAMFER + 0.01, 0, 0, [k, k])).translate([cx, l.holeCy, l.top - CHAMFER])));
      if (labels) {
        const r = textToCrossSection(K, t, font, { lines: [h.label], sizeMode: 'capHeight', sizeMm: Math.min(4, zone * 0.6), tolMm: tol });
        if (r.cs) {
          const lw = r.bbox.maxX - r.bbox.minX;
          const fit = Math.min(1, (cellW(h) - 1) / lw);
          const txt = t(t(r.cs.scale([fit, fit])).translate([cx, l.labelCy]));
          cuts.push(t(t(txt.extrude(LABEL_DEPTH + 1)).translate([0, 0, l.top - LABEL_DEPTH])));
        }
      }
    }
  }
  solid = t(solid.subtract(t(K.Manifold.union(cuts))));
  solid = t(solid.translate([0, -D / 2, 0]));
  const count = rows.reduce((s, r) => s + r.length, 0);
  return { solid, holes: count, front: { w: W, h: top0, y: -D / 2, zc: top0 / 2, maxInset: m + zone - MIN_BEHIND } };
}

// ---------------------------------------------------------------------------
// Logo en el frente
// ---------------------------------------------------------------------------

/**
 * El logo, de pie sobre el frente (la cara de -Y): sobresale `logoDepthMm` o se hunde esa medida en la pared (al ras o
 * grabado). Ocupa `logoSizePct` del lugar libre del frente. Devuelve el sólido del logo (o null).
 * @param {{ w:number, h:number, y:number, zc:number, maxInset:number }} front
 */
function logoOnFront(K, t, p, polys, front, messages) {
  const raw = logo2dOf(K, t, polys);
  if (!raw) return null;
  const b = raw.bounds();
  const lw = b.max[0] - b.min[0];
  const lh = b.max[1] - b.min[1];
  const maxW = front.w - 2 * LOGO_MARGIN;
  const maxH = front.h - 2 * LOGO_MARGIN;
  if (maxW < 8 || maxH < 3) {
    messages.push({ level: 'warn', code: 'organizer.logoNoRoom' });
    return null;
  }
  const cs = t(raw.scale((Math.min(maxW / lw, maxH / lh) * p.logoSizePct) / 100));
  let d = p.logoDepthMm;
  if (p.logoStyle !== 'relief' && d > front.maxInset) {
    d = Math.max(0.2, front.maxInset);
    messages.push({ level: 'warn', code: 'organizer.logoDepth', params: { mm: round(d, 1) } });
  }
  // en relieve sobresale `d` y además entra `embed` en la pared; al ras solo entra `d`
  const embed = p.logoStyle === 'relief' ? Math.min(LOGO_EMBED, front.maxInset) : 0;
  // el dibujo se extruye en Z y se lo para sobre el frente: x queda igual, la Y del dibujo pasa a ser la altura
  // y el espesor va hacia -Y (de `y` hacia afuera)
  const upright = t(t(cs.extrude(d + embed)).rotate([90, 0, 0]));
  return t(upright.translate([0, p.logoStyle === 'relief' ? front.y + embed : front.y + d, front.zc]));
}
