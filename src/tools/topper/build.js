// Generación del topper de torta. FUNCIÓN PURA: params → BuildResult (sin DOM ni three.js).
//
// Pieza: base con la silueta del texto (o círculo / óvalo) + letras + palitos que salen
// por el borde inferior. Todo se resuelve en 2D (CrossSection) y recién al final se extruye.

import { createScope } from '../../core/kernel/manifold.js';
import { textToCrossSection } from '../../core/kernel/text.js';
import { closing, fillHoles, fitShapeAround, rectFromBounds, segmentsFor } from '../../core/kernel/shapes2d.js';
import { manifoldToMesh, mergeParts } from '../../core/kernel/mesh.js';
import { analyzeParts, fitsBed, round } from '../../core/kernel/analysis.js';
import { normalizePrinter, snapZ } from '../../core/printer/profiles.js';
import { normalizeParams, qualityTol } from './params.js';

const PART_LABEL = { base: 'Base', text: 'Letras' };
const MAX_LINES = 4;
const MAX_CHARS = 30;
/** Posición de cada palito como fracción del ancho de la silueta. */
const STICK_AT = { 1: [0.5], 2: [0.25, 0.75], 3: [0.18, 0.5, 0.82] };
/** Puente entre líneas: ancho mínimo (mm) y fracción de la superposición horizontal que cubre. */
const BRIDGE_MIN_MM = 12;
const BRIDGE_FRACTION = 0.7;

/**
 * @param {any} K  módulo manifold-3d ya inicializado
 * @param {any} rawParams
 * @param {{ getFont:(id:string)=>Promise<any>, printer?:any, fallbackFontId?:string }} ctx
 */
export async function build(K, rawParams, ctx) {
  const p = normalizeParams(rawParams);
  const printer = normalizePrinter(ctx.printer);
  const messages = [];
  const lines = p.text
    .split(/\r?\n/)
    .slice(0, MAX_LINES)
    .map((l) => l.slice(0, MAX_CHARS));
  if (lines.every((l) => l.trim() === '')) {
    messages.push({ level: 'error', code: 'text.empty' });
    return { items: [], messages, info: emptyInfo() };
  }
  const font = await ctx.getFont(p.fontId);
  const fallbackFont = await ctx.getFont(ctx.fallbackFontId ?? 'lato-bold').catch(() => null);
  const item = buildItem(K, p, printer, font, lines, fallbackFont, messages, !!ctx.preview);
  if (!item) {
    messages.push({ level: 'error', code: 'text.empty' });
    return { items: [], messages, info: emptyInfo() };
  }
  const [sx, sy] = item.sizeMm;
  if (!fitsBed(sx, sy, printer.bed)) messages.push({ level: 'warn', code: 'size.bedOverflow', params: { w: round(sx, 1), h: round(sy, 1) } });
  return {
    items: [item],
    plates: null,
    bed: null,
    messages: dedupe(messages),
    info: {
      colorChanges: item.analysis.colorChanges,
      gramsByColor: item.analysis.gramsByColor,
      needsMMU: item.analysis.needsMMU,
      triangles: item.triangles,
      scale: item.scale,
    },
  };
}

function emptyInfo() {
  return { colorChanges: null, gramsByColor: {}, needsMMU: false, triangles: 0, scale: 0 };
}

function dedupe(msgs) {
  const seen = new Set();
  return msgs.filter((m) => {
    const k = m.code + JSON.stringify(m.params ?? {});
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Silueta y palitos (2D)
// ---------------------------------------------------------------------------

/**
 * Puentes anchos entre líneas de texto consecutivas. Sin ellos el cierre morfológico las une
 * por un cuello angosto (a veces en un solo costado) y la pieza queda frágil.
 * Cada puente cubre la zona central donde las dos líneas se superponen en horizontal.
 */
function buildBridges(K, t, p, lineBoxes) {
  const boxes = lineBoxes.filter(Boolean);
  const bridges = [];
  const m = p.marginMm;
  for (let i = 0; i + 1 < boxes.length; i++) {
    const a = boxes[i];
    const b = boxes[i + 1];
    const x0 = Math.max(a.minX, b.minX);
    const x1 = Math.min(a.maxX, b.maxX);
    const overlap = x1 - x0;
    if (overlap < BRIDGE_MIN_MM) continue;
    const w = Math.min(overlap, Math.max(BRIDGE_MIN_MM, overlap * BRIDGE_FRACTION));
    const cx = (x0 + x1) / 2;
    const yLo = Math.min(a.minY, b.maxY) - m / 2;
    const yHi = Math.max(a.minY, b.maxY) + m / 2;
    bridges.push(rectFromBounds(K, t, cx - w / 2, yLo, cx + w / 2, yHi));
  }
  return bridges;
}

function buildOutline(K, t, p, T, quality, lineBoxes) {
  const m = p.marginMm;
  const grown = t(T.offset(m, 'Round', 2, segmentsFor(m, quality)));
  if (p.shape !== 'silhouette') return fitShapeAround(K, t, p.shape, grown, quality);
  if (p.fill === 'tight') return closing(t, grown, 1);
  // "Fondo relleno": se unen las líneas con puentes anchos y se cierra el contorno hasta quedar en una sola pieza
  const bridges = buildBridges(K, t, p, lineBoxes);
  const joined = bridges.length ? t(K.CrossSection.union([grown, ...bridges])) : grown;
  let r = Math.max(3, m * 1.2);
  let o = closing(t, joined, r);
  while (o.decompose().map(t).length > 1 && r < 30) {
    r += 2;
    o = closing(t, joined, r);
  }
  return fillHoles(K, t, o);
}

/** Un palito con punta: rectángulo desde `yTop` hacia abajo, que termina en triángulo. */
function stickShape(K, t, x, yTop, yTip, w) {
  const tip = Math.min(w * 1.8, (yTop - yTip) * 0.5);
  const h = w / 2;
  return t(
    new K.CrossSection(
      [
        [
          [x - h, yTop],
          [x - h, yTip + tip],
          [x, yTip],
          [x + h, yTip + tip],
          [x + h, yTop],
        ],
      ],
      'NonZero',
    ),
  );
}

/** Palitos pegados al borde inferior de la silueta. Devuelve las formas 2D. */
function buildSticks(K, t, p, outline, messages) {
  if (p.sticks === 0) return [];
  const ob = outline.bounds();
  const width = ob.max[0] - ob.min[0];
  const w = p.stickWidthMm;
  const xs = [];
  for (const f of STICK_AT[p.sticks]) {
    const x0 = ob.min[0] + f * width;
    const toCenter = Math.sign((ob.min[0] + ob.max[0]) / 2 - x0);
    let x = x0;
    let cut = null;
    // si bajo ese punto no hay material (hueco entre letras), correr el palito hacia el centro; el del medio se
    // corre a un lado y al otro, cada vez más lejos
    for (let i = 0; i < 60; i++) {
      x = toCenter !== 0 ? x0 + toCenter * width * 0.01 * i : x0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * width * 0.01;
      const strip = rectFromBounds(K, t, x - w / 2, ob.min[1] - 1, x + w / 2, ob.max[1] + 1);
      cut = t(outline.intersect(strip));
      if (!cut.isEmpty()) break;
    }
    if (!cut || cut.isEmpty()) continue;
    if (xs.some((o) => Math.abs(o.x - x) < w + 1)) continue;
    xs.push({ x, cut });
  }
  if (xs.length < p.sticks) messages.push({ level: 'warn', code: 'topper.sticksFewer', params: { n: xs.length } });
  return xs.map(({ x, cut }) => {
    const cb = cut.bounds();
    const yEdge = cb.min[1];
    const overlap = Math.max(1, Math.min(4, (cb.max[1] - cb.min[1]) * 0.5));
    return stickShape(K, t, x, yEdge + overlap, yEdge - p.stickLengthMm, w);
  });
}

// ---------------------------------------------------------------------------
// Pieza completa
// ---------------------------------------------------------------------------

function buildItem(K, p, printer, font, lines, fallbackFont, messages, preview) {
  const sc = createScope();
  const t = sc.track;
  try {
    const tol = qualityTol(p.curveQuality);
    const quality = p.curveQuality === 'draft' ? 0.5 : p.curveQuality === 'high' ? 1.6 : 1;
    const textRes = textToCrossSection(K, t, font, {
      lines,
      sizeMode: 'textWidth',
      sizeMm: p.sizeMm,
      letterSpacingMm: p.letterSpacingMm,
      // el interlineado del panel está en "em" (alto de la fuente); text.js usa ascendente + descendente
      lineSpacing: (p.lineSpacing * font.unitsPerEm) / Math.max(1, font.ascender - font.descender),
      align: p.align,
      boldOffsetMm: p.boldOffsetMm,
      uppercase: p.uppercase,
      tolMm: tol,
      fallbackFont,
    });
    if (!textRes.cs) return null;
    if (textRes.missing.length) messages.push({ level: 'warn', code: 'text.missingGlyphs', params: { chars: textRes.missing.join(' ') } });
    const T = textRes.cs;

    const outline = buildOutline(K, t, p, T, quality, textRes.lineBoxes);
    const sticks = buildSticks(K, t, p, outline, messages);
    const S = sticks.length ? t(K.CrossSection.union([outline, ...sticks])) : outline;

    // ---- validaciones 2D
    const n = printer.nozzleMm;
    const opened = t(t(T.offset(-n / 2, 'Round', 2, 16)).offset(n / 2, 'Round', 2, 16));
    if (T.area() > 0 && (T.area() - opened.area()) / T.area() > 0.15) messages.push({ level: 'warn', code: 'text.thin' });
    if (S.decompose().map(t).length > 1) messages.push({ level: 'error', code: 'topper.islands' });

    const zf = (z) => (p.snapToLayers ? snapZ(z, printer) : z);
    const layer = printer.layerHeightMm;
    const H = zf(p.baseThicknessMm);
    const ext = (cs, z0, z1) => {
      if (cs.isEmpty() || z1 - z0 < 1e-6) return null;
      return t(t(cs.extrude(z1 - z0)).translate([0, 0, z0]));
    };

    /** @type {{ colorKey:string, m:any }[]} */
    const solids = [];
    const push = (colorKey, m) => m && solids.push({ colorKey, m });
    let baseM = ext(S, 0, H);
    if (p.relief) {
      push('text', ext(T, H, Math.max(zf(H + p.reliefMm), H + layer)));
    } else {
      // letras al ras: se hunden en la base y quedan a la misma altura (dos colores, cara plana)
      const zFloor = Math.min(zf(Math.max(0.8, H - 1.2)), H - layer);
      const pocket = ext(T, zFloor, H + 1);
      if (pocket && baseM) baseM = t(baseM.subtract(pocket));
      push('text', ext(T, zFloor, H));
    }
    push('base', baseM);

    // ---- agrupar por color
    const keys = [...new Set(solids.map((s) => s.colorKey))];
    const groups = keys.map((k) => {
      const list = solids.filter((s) => s.colorKey === k).map((s) => s.m);
      return { colorKey: k, m: list.length === 1 ? list[0] : t(K.Manifold.union(list)) };
    });

    const parts = groups.map((g) => {
      const bb = g.m.boundingBox();
      return {
        id: g.colorKey,
        label: PART_LABEL[g.colorKey] ?? g.colorKey,
        colorKey: g.colorKey,
        color: p.colors[g.colorKey],
        ...manifoldToMesh(g.m),
        volumeMm3: g.m.volume(),
        zMin: bb.min[2],
        zMax: bb.max[2],
        status: g.m.status(),
        genus: g.m.genus(),
      };
    });
    const analysis = analyzeParts(parts, printer);
    if (analysis.needsMMU && !printer.multiMaterial) messages.push({ level: 'warn', code: 'color.needsMMU' });

    const { merged, box: mb, triangles } = mergeParts(K, t, groups.map((g) => g.m), preview);
    return {
      name: lines.join(' '),
      parts,
      merged,
      sizeMm: [mb.max[0] - mb.min[0], mb.max[1] - mb.min[1], mb.max[2] - mb.min[2]],
      offsetXY: [0, 0],
      bboxXY: [mb.min[0], mb.min[1], mb.max[0], mb.max[1]],
      triangles,
      analysis,
      scale: textRes.scale,
    };
  } finally {
    sc.dispose();
  }
}
