// Generación del sello. FUNCIÓN PURA: params → BuildResult (sin DOM ni three.js).
//
// Se imprime con el MANGO contra la cama y el diseño hacia arriba, sin soportes:
//   mango (z = 0…h) → cono de transición a ≤ 45° → placa → diseño en relieve.
// El diseño (texto y/o ícono) va ESPEJADO en X: al estampar sale derecho.

import { createScope } from '../../core/kernel/manifold.js';
import { textToCrossSection } from '../../core/kernel/text.js';
import { addIcon, iconAlone } from '../../core/kernel/icon2d.js';
import { circle, roundedRect, fitShapeAround, segmentsFor } from '../../core/kernel/shapes2d.js';
import { manifoldToMesh } from '../../core/kernel/mesh.js';
import { analyzeParts, fitsBed, round } from '../../core/kernel/analysis.js';
import { normalizePrinter, snapZ } from '../../core/printer/profiles.js';
import { normalizeParams, qualityTol } from './params.js';

const MAX_LINES = 4;
const MAX_CHARS = 30;
/** Alto máximo del cono de transición (mm); más allá la pendiente supera los 45°. */
const MAX_FLARE = 30;

/**
 * @param {any} K  módulo manifold-3d ya inicializado
 * @param {any} rawParams
 * @param {{ getFont:(id:string)=>Promise<any>, printer?:any, fallbackFontId?:string, iconPolys?:Record<string, number[][][]> }} ctx
 */
export async function build(K, rawParams, ctx) {
  const p = normalizeParams(rawParams);
  const printer = normalizePrinter(ctx.printer);
  const messages = [];
  const lines = p.text
    .split(/\r?\n/)
    .slice(0, MAX_LINES)
    .map((l) => l.slice(0, MAX_CHARS));
  const hasText = lines.some((l) => l.trim() !== '');
  const iconPolys = p.icon ? (ctx.iconPolys?.[p.icon] ?? null) : null;
  if (!hasText && !iconPolys) return fail(messages, 'stamp.empty');
  const font = hasText ? await ctx.getFont(p.fontId) : null;
  const fallbackFont = hasText ? await ctx.getFont(ctx.fallbackFontId ?? 'lato-bold').catch(() => null) : null;
  const item = buildItem(K, p, printer, { lines, hasText, font, fallbackFont, iconPolys }, messages);
  if (!item) return fail(messages, 'stamp.empty');
  const [sx, sy] = item.sizeMm;
  if (!fitsBed(sx, sy, printer.bed)) messages.push({ level: 'warn', code: 'size.bedOverflow', params: { w: round(sx, 1), h: round(sy, 1) } });
  return {
    items: [item],
    plates: null,
    bed: null,
    messages,
    info: {
      colorChanges: item.analysis.colorChanges,
      gramsByColor: item.analysis.gramsByColor,
      needsMMU: item.analysis.needsMMU,
      triangles: item.triangles,
      scale: item.scale,
    },
  };
}

function fail(messages, code) {
  messages.push({ level: 'error', code });
  return { items: [], messages, info: { colorChanges: null, gramsByColor: {}, needsMMU: false, triangles: 0, scale: 0 } };
}

function buildItem(K, p, printer, src, messages) {
  const sc = createScope();
  const t = sc.track;
  try {
    const tol = qualityTol(p.curveQuality);
    const quality = p.curveQuality === 'draft' ? 0.5 : p.curveQuality === 'high' ? 1.6 : 1;

    // ---- diseño 2D (texto y/o ícono), centrado en el origen
    let design;
    let scale = 0;
    if (src.hasText) {
      let textRes = textToCrossSection(K, t, src.font, {
        lines: src.lines,
        sizeMode: 'textWidth',
        sizeMm: p.sizeMm,
        letterSpacingMm: p.letterSpacingMm,
        // el interlineado del panel está en "em" (alto de la fuente); text.js usa ascendente + descendente
        lineSpacing: (p.lineSpacing * src.font.unitsPerEm) / Math.max(1, src.font.ascender - src.font.descender),
        align: p.align,
        boldOffsetMm: p.boldOffsetMm,
        uppercase: p.uppercase,
        tolMm: tol,
        fallbackFont: src.fallbackFont,
      });
      if (textRes.missing.length) messages.push({ level: 'warn', code: 'text.missingGlyphs', params: { chars: textRes.missing.join(' ') } });
      if (textRes.cs && src.iconPolys) textRes = addIcon(K, t, p, textRes, src.iconPolys);
      design = textRes.cs;
      scale = textRes.scale;
    }
    if (!design) {
      const alone = iconAlone(K, t, src.iconPolys, p.sizeMm);
      if (!alone) return null;
      design = alone.cs;
    }
    // espejado en X: lo que se ve en el modelo es el reverso de lo que queda impreso en el papel
    const T = t(design.mirror([1, 0]));
    const db = T.bounds();

    // ---- placa
    const m = p.marginMm;
    let plate;
    if (p.shape === 'rounded') {
      plate = roundedRect(K, t, db.max[0] - db.min[0] + 2 * m, db.max[1] - db.min[1] + 2 * m, p.cornerRadiusMm, (db.min[0] + db.max[0]) / 2, (db.min[1] + db.max[1]) / 2, quality);
    } else {
      plate = fitShapeAround(K, t, p.shape, t(T.offset(m, 'Round', 2, segmentsFor(m, quality))), quality);
    }
    const pb = plate.bounds();
    const pw = pb.max[0] - pb.min[0];
    const ph = pb.max[1] - pb.min[1];
    const pcx = (pb.min[0] + pb.max[0]) / 2;
    const pcy = (pb.min[1] + pb.max[1]) / 2;

    // ---- validaciones 2D
    const n = printer.nozzleMm;
    const opened = t(t(T.offset(-n / 2, 'Round', 2, 16)).offset(n / 2, 'Round', 2, 16));
    if (T.area() > 0 && (T.area() - opened.area()) / T.area() > 0.15) messages.push({ level: 'warn', code: 'text.thin' });

    // ---- mango (en el centro de la placa)
    let handleCs = null;
    let hx = 0;
    let hy = 0;
    if (p.handle === 'knob') {
      const d = Math.min(p.handleWidthMm, Math.min(pw, ph) * 0.9);
      hx = hy = d;
      handleCs = circle(K, t, d / 2, pcx, pcy, quality);
    } else if (p.handle === 'bar') {
      hy = Math.min(p.handleWidthMm, ph * 0.9);
      hx = Math.min(p.handleLengthMm, pw * 0.9);
      handleCs = roundedRect(K, t, hx, hy, Math.min(hy / 2, 8), pcx, pcy, quality);
    }

    // ---- alturas (todas al borde de capa)
    const zf = (z) => (p.snapToLayers ? snapZ(z, printer) : z);
    const layer = printer.layerHeightMm;
    const hH = handleCs ? zf(p.handleHeightMm) : 0;
    // cono de transición mango → placa: tan abierto como la distancia horizontal que hay que cubrir (45°)
    const gap = handleCs ? Math.max((pw - hx) / 2, (ph - hy) / 2) : 0;
    if (gap > MAX_FLARE / 2) messages.push({ level: 'warn', code: 'stamp.flare', params: { mm: round(Math.min(MAX_FLARE, gap), 0) } });
    const zPlate0 = handleCs ? zf(hH + Math.min(MAX_FLARE, Math.max(layer * 2, gap))) : 0;
    const zPlate1 = zf(zPlate0 + p.plateThicknessMm);
    const zTop = Math.max(zf(zPlate1 + p.reliefMm), zPlate1 + layer);

    const ext = (cs, z0, z1) => (cs.isEmpty() || z1 - z0 < 1e-6 ? null : t(t(cs.extrude(z1 - z0)).translate([0, 0, z0])));
    const solids = [ext(plate, zPlate0, zPlate1), ext(T, zPlate1, zTop)];
    if (handleCs) {
      solids.push(ext(handleCs, 0, hH));
      if (zPlate0 > hH + 1e-6) {
        // loft entre la sección del mango y la de la placa (casco convexo de dos láminas finas)
        const lo = ext(handleCs, hH - 0.01, hH);
        const hi = ext(plate, zPlate0, zPlate0 + 0.01);
        solids.push(t(K.Manifold.hull([lo, hi])));
      }
    }
    const stamp = t(K.Manifold.union(solids.filter(Boolean)));

    const bb = stamp.boundingBox();
    const mesh = manifoldToMesh(stamp);
    const mergedMesh = manifoldToMesh(stamp); // buffers propios: el worker transfiere cada ArrayBuffer una sola vez
    const part = {
      id: 'base',
      label: 'Sello',
      colorKey: 'base',
      color: p.colors.base,
      ...mesh,
      volumeMm3: stamp.volume(),
      zMin: bb.min[2],
      zMax: bb.max[2],
      status: stamp.status(),
      genus: stamp.genus(),
    };
    const analysis = analyzeParts([part], printer);
    return {
      name: src.lines.find((l) => l.trim()) || p.icon || 'sello',
      parts: [part],
      merged: { ...mergedMesh, status: part.status, genus: part.genus, volumeMm3: part.volumeMm3 },
      sizeMm: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]],
      offsetXY: [0, 0],
      bboxXY: [bb.min[0], bb.min[1], bb.max[0], bb.max[1]],
      triangles: mesh.indices.length / 3,
      analysis,
      scale,
      reliefTopZ: zTop,
    };
  } finally {
    sc.dispose();
  }
}
