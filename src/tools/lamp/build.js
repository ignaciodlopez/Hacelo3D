// Generación de la lámpara. FUNCIÓN PURA: params → BuildResult (sin DOM ni three.js).
//
// Piezas (cada una es un item aparte, se imprimen por separado):
//   - pantalla: con la rosca macho integrada, hueca con pared (pared) o maciza para modo vaso (vaso)
//   - base: réplica paramétrica de "Modular Lamp / base.stl" (rosca hembra, abrazadera del portalámparas)
// Vista "armada": la pantalla se muestra enroscada sobre la base (`viewOffset`, solo para el visor);
// las descargas usan siempre la posición de impresión, todo apoyado en z = 0.

import { createScope } from '../../core/kernel/manifold.js';
import { manifoldToMesh } from '../../core/kernel/mesh.js';
import { analyzeParts, fitsBed, round, scanOverhangs } from '../../core/kernel/analysis.js';
import { normalizePrinter } from '../../core/printer/profiles.js';
import { normalizeParams, meshDensity } from './params.js';
import { buildShade } from './shade.js';
import { buildBase } from './base.js';
import { THREAD, SEAT_Z } from './thread.js';

/**
 * Lamparita de referencia (LED A60): Ø60 × ~110 mm sobre el portalámparas. El vidrio ancho empieza
 * unos 20 mm arriba del portalámparas: más abajo solo está el casquillo, que es mucho más angosto.
 */
const BULB = { diameter: 60, clearance: 5, height: 110, glassFrom: 20 };
/** Pendiente a partir de la cual avisamos (normal hacia abajo más de ~48° desde la vertical). */
const OVERHANG_NZ = -0.75;
const GAP = 8;
/** Ancho típico de la línea de pared en modo vaso (mm), para estimar el peso. */
const VASE_LINE_MM = 0.8;

/**
 * @param {any} K  módulo manifold-3d ya inicializado
 * @param {any} rawParams
 * @param {{ printer?: any }} ctx
 */
export async function build(K, rawParams, ctx = {}) {
  const p = normalizeParams(rawParams);
  const printer = normalizePrinter(ctx.printer);
  const density = meshDensity(p.curveQuality);
  const messages = [];
  const sc = createScope();
  const t = sc.track;
  try {
    const wantShade = p.parts !== 'base';
    const wantBase = p.parts !== 'shade';
    /** @type {any[]} */
    const pieces = [];

    let shadeInfo = null;
    if (wantShade) {
      try {
        shadeInfo = buildShade(K, p, density);
      } catch (err) {
        if (String(err?.message) !== 'lamp.inset') throw err;
        return fail(messages, 'lamp.inset');
      }
      t(shadeInfo.shade);
      const vase = p.shadeMode === 'vase';
      pieces.push({
        key: 'shade',
        name: 'pantalla',
        label: 'Pantalla',
        colorKey: 'shade',
        color: p.colors.shade,
        manifold: shadeInfo.shade,
        lift: SEAT_Z,
        // en modo vaso se imprime solo la cara de afuera: el peso sale de esa superficie, no del macizo
        printedVolume: vase ? vaseWallVolume(t, shadeInfo.shade) : null,
      });
    }
    if (wantBase) {
      const { base } = buildBase(K, t, p, density);
      pieces.push({ key: 'base', name: 'base', label: 'Base', colorKey: 'base', color: p.colors.base, manifold: base, lift: 0 });
    }

    // ---- items: lado a lado sobre la cama (y armados en el visor)
    const items = [];
    let cursor = 0;
    const widths = pieces.map((pc) => {
      const bb = pc.manifold.boundingBox();
      return bb.max[0] - bb.min[0];
    });
    const totalW = widths.reduce((s, w) => s + w, 0) + GAP * (pieces.length - 1);
    pieces.forEach((pc, i) => {
      const item = toItem(pc, printer);
      const x = cursor + widths[i] / 2 - totalW / 2;
      cursor += widths[i] + GAP;
      item.offsetXY = [x, 0];
      item.viewOffset = p.view === 'assembled' ? [0, 0, pc.lift] : [x, 0, 0];
      items.push(item);
    });

    // ---- avisos
    const shadeItem = items.find((it) => it.key === 'shade');
    if (shadeItem && shadeInfo) {
      if (shadeInfo.heightRaised) messages.push({ level: 'warn', code: 'lamp.heightRaised', params: { mm: Math.ceil(shadeInfo.heightMm) } });
      checkShade(p, printer, shadeItem, shadeInfo, messages);
      messages.push({ level: 'info', code: p.shadeMode === 'vase' ? 'lamp.vaseHow' : 'lamp.wallHow' });
    }
    for (const it of items) {
      const [sx, sy] = it.sizeMm;
      if (!fitsBed(sx, sy, printer.bed)) messages.push({ level: 'warn', code: 'size.bedOverflow', params: { w: round(sx, 1), h: round(sy, 1) } });
    }
    if (wantBase && p.clampScrew) messages.push({ level: 'info', code: 'lamp.screw' });
    messages.push({ level: 'info', code: 'lamp.led' });

    const parts = items.flatMap((it) => it.parts);
    const gramsByColor = {};
    for (const pt of parts) gramsByColor[pt.colorKey] = (gramsByColor[pt.colorKey] ?? 0) + (pt.volumeMm3 / 1000) * printer.densityGcm3;
    return {
      items,
      plates: null,
      bed: null,
      messages,
      info: {
        colorChanges: null,
        gramsByColor,
        needsMMU: false,
        triangles: items.reduce((s, it) => s + it.triangles, 0),
        // con varias piezas distintas el panel muestra la medida de cada una, no solo la de la primera
        pieceSizes: items.length > 1 ? items.map((it) => ({ key: it.key, sizeMm: it.sizeMm })) : null,
        seatZ: SEAT_Z,
        bodyZ0: shadeInfo?.bodyZ0 ?? null,
      },
    };
  } finally {
    sc.dispose();
  }
}

function fail(messages, code) {
  messages.push({ level: 'error', code });
  return { items: [], messages, info: { colorChanges: null, gramsByColor: {}, needsMMU: false, triangles: 0 } };
}

function toItem(pc, printer) {
  const m = pc.manifold;
  const bb = m.boundingBox();
  const mesh = manifoldToMesh(m);
  const merged = manifoldToMesh(m); // buffers propios: el worker transfiere cada ArrayBuffer una sola vez
  const part = {
    id: pc.key,
    label: pc.label,
    colorKey: pc.colorKey,
    color: pc.color,
    ...mesh,
    volumeMm3: pc.printedVolume ?? m.volume(),
    zMin: bb.min[2],
    zMax: bb.max[2],
    status: m.status(),
    genus: m.genus(),
  };
  return {
    key: pc.key,
    name: pc.name,
    parts: [part],
    merged: { ...merged, status: part.status, genus: part.genus, volumeMm3: m.volume() },
    sizeMm: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]],
    offsetXY: [0, 0],
    bboxXY: [bb.min[0], bb.min[1], bb.max[0], bb.max[1]],
    triangles: mesh.indices.length / 3,
    analysis: analyzeParts([part], printer),
  };
}

/** Volumen que se imprime en modo vaso: la superficie lateral por el ancho típico de la línea en espiral. */
function vaseWallVolume(t, solid) {
  const bb = solid.boundingBox();
  const caps = t(solid.slice(bb.min[2] + 0.01)).area() + t(solid.slice(bb.max[2] - 0.01)).area();
  return Math.max(0, solid.surfaceArea() - caps) * VASE_LINE_MM;
}

function checkShade(p, printer, item, info, messages) {
  // voladizos: caras que miran hacia abajo más de ~48° (sin contar el cuello roscado ni la cara de apoyo)
  const { fraction, worstDeg } = scanOverhangs(item.merged.positions, item.merged.indices, THREAD.neckTopZ + 1e-3, OVERHANG_NZ);
  if (fraction > 0.003) messages.push({ level: 'warn', code: 'lamp.overhang', params: { deg: worstDeg } });

  // paredes finas para la boquilla
  if (p.shadeMode === 'wall' && p.wallMm < printer.nozzleMm * 2 - 1e-6) messages.push({ level: 'warn', code: 'lamp.thinWall', params: { mm: round(printer.nozzleMm * 2, 2) } });

  // ¿entra la lamparita? (radio interno mínimo en la zona que ocupa, ya armada sobre la base)
  const bulbTop = p.socketHeightMm + BULB.height;
  const near = info.bodyInnerRadii.filter((e) => e.z + SEAT_Z >= p.socketHeightMm + BULB.glassFrom && e.z + SEAT_Z <= bulbTop);
  const minR = near.reduce((m, e) => Math.min(m, e.r), Infinity);
  if (Number.isFinite(minR) && 2 * minR < BULB.diameter + 2 * BULB.clearance) messages.push({ level: 'warn', code: 'lamp.bulbTight', params: { mm: round(2 * minR, 0) } });
  if (info.heightMm + SEAT_Z < bulbTop) messages.push({ level: 'info', code: 'lamp.bulbShows' });
}
