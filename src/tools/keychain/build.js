// Generación del llavero. FUNCIÓN PURA: params → BuildResult. No toca DOM ni three.js,
// así corre igual en un Web Worker y en Node (tests).
//
// Todo el diseño se resuelve en 2D (CrossSection) y recién al final se extruye.

import { createScope } from '../../core/kernel/manifold.js';
import { textToCrossSection } from '../../core/kernel/text.js';
import { circle, roundedRect, rectFromBounds, fillHoles, closing, segmentsFor, fitShapeAround } from '../../core/kernel/shapes2d.js';
import { manifoldToMesh, mergeParts } from '../../core/kernel/mesh.js';
import { analyzeParts, fitsBed, round } from '../../core/kernel/analysis.js';
import { addIcon } from '../../core/kernel/icon2d.js';
import { normalizePrinter, snapZ } from '../../core/printer/profiles.js';
import { normalizeParams, qualityTol, splitBatch } from './params.js';
import { layoutPlates } from './layout.js';

const RING_DEG = { left: 180, right: 0, top: 90, topLeft: 135, topRight: 45 };
const PART_LABEL = { base: 'Base', text: 'Letras', accent: 'Contorno', border: 'Borde' };
const MAX_LINES = 3;
const MAX_CHARS = 40;
const MAX_BATCH = 200;

/**
 * @param {any} K  módulo manifold-3d ya inicializado
 * @param {any} rawParams
 * @param {{ getFont:(id:string)=>Promise<any>, printer?:any, preview?:boolean }} ctx  `preview`: sin la pieza unida (ver mergeParts)
 */
export async function build(K, rawParams, ctx) {
  const p = normalizeParams(rawParams);
  const printer = normalizePrinter(ctx.printer);
  const messages = [];
  const batch = p.mode === 'batch';
  const names = (batch ? splitBatch(p.batchText, p.batchSeparator) : [p.text]).filter((n) => n.trim() !== '').slice(0, MAX_BATCH);
  if (names.length === 0) {
    messages.push({ level: 'error', code: 'text.empty' });
    return { items: [], messages, info: emptyInfo() };
  }
  const font = await ctx.getFont(p.fontId);
  const iconPolys = p.icon ? (ctx.iconPolys?.[p.icon] ?? null) : null;
  const fallbackFont = await ctx.getFont(ctx.fallbackFontId ?? 'lato-bold').catch(() => null);
  const env = { messages, iconPolys, fallbackFont, forceScale: undefined, preview: !!ctx.preview, scaleOnly: false };
  if (batch && p.batchUniform === 'sameScale' && names.length > 1) {
    // mismo tamaño de letra para todos: el nombre más largo define la escala (para eso alcanza la silueta, sin la pieza)
    const scales = [];
    for (const name of names) {
      const it = buildItem(K, p, printer, font, name, { ...env, messages: [], scaleOnly: true });
      if (it) scales.push(it.scale);
    }
    if (scales.length) env.forceScale = Math.min(...scales);
  }
  const items = [];
  for (const name of names) {
    const item = buildItem(K, p, printer, font, name, env);
    if (item) items.push(item);
  }
  if (items.length === 0) {
    messages.push({ level: 'error', code: 'text.empty' });
    return { items: [], messages, info: emptyInfo() };
  }
  const first = items[0];
  let plates = null;
  if (batch) {
    const lay = layoutPlates(items, printer.bed);
    items.forEach((it, i) => {
      it.offsetXY = lay.offsets[i];
      it.plate = lay.plates.findIndex((pl) => pl.items.includes(i));
    });
    plates = lay.plates;
    if (lay.overflow.length) {
      const o = items[lay.overflow[0]].sizeMm;
      messages.push({ level: 'warn', code: 'size.bedOverflow', params: { w: round(o[0], 1), h: round(o[1], 1) } });
    }
  } else {
    const [sx, sy] = first.sizeMm;
    if (!fitsBed(sx, sy, printer.bed)) messages.push({ level: 'warn', code: 'size.bedOverflow', params: { w: round(sx, 1), h: round(sy, 1) } });
  }
  return {
    items,
    plates,
    bed: batch ? printer.bed : null,
    messages: dedupe(messages),
    info: {
      colorChanges: first.analysis.colorChanges,
      gramsByColor: first.analysis.gramsByColor,
      needsMMU: first.analysis.needsMMU,
      triangles: items.reduce((n, it) => n + it.triangles, 0),
      scale: first.scale,
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
// Silueta 2D
// ---------------------------------------------------------------------------

function buildOutline(K, t, p, T, textBox, quality) {
  const m = p.marginMm;
  if (p.shape === 'rounded') {
    const w = textBox.maxX - textBox.minX + 2 * m;
    const h = textBox.maxY - textBox.minY + 2 * m;
    return roundedRect(K, t, w, h, p.cornerRadiusMm, (textBox.minX + textBox.maxX) / 2, (textBox.minY + textBox.maxY) / 2, quality);
  }
  const grown = t(T.offset(m, 'Round', 2, segmentsFor(m, quality)));
  if (p.shape !== 'follow') return fitShapeAround(K, t, p.shape, grown, quality);
  let o = p.smoothMm > 0 ? closing(t, grown, p.smoothMm) : grown;
  if (p.fillCounters) o = fillHoles(K, t, o);
  return o;
}

/**
 * Argolla / fijación. Todo se calcula en un marco local donde la argolla mira hacia -X
 * (se rota el contorno), midiendo el borde REAL a la altura de la argolla y no el
 * mínimo global; luego se rota de vuelta lo agregado.
 *  - tab: oreja circular con agujero + cuello
 *  - slot: oreja rectangular redondeada con ranura para cinta
 *  - internal: agujero dentro del cuerpo (sin oreja)
 */
function buildRing(K, t, p, printer, outline, T, textRes, quality, messages) {
  if (p.ringType === 'none') return { S: outline, hole: null };
  const deg = RING_DEG[p.ringPosition];
  const theta = 180 - deg;
  const th = (theta * Math.PI) / 180;
  const rot = ([x, y]) => [x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th)];
  const minWall = Math.max(1, 2 * printer.nozzleMm);
  const isSlot = p.ringType === 'slot';
  const isInternal = p.ringType === 'internal';
  const R = p.ringOuterMm / 2;
  const Rh = p.ringHoleMm / 2;
  // ranura: alto en X local, largo a lo largo del borde (Y local)
  const holeW = p.slotHeightMm;
  const holeH = p.slotWidthMm;
  const wall = Math.min(4, Math.max(1.2, (p.ringOuterMm - p.ringHoleMm) / 2));
  const tabW = isSlot ? holeW + 2 * wall : 2 * R;
  const tabH = isSlot ? holeH + 2 * wall : 2 * R;
  const halfY = tabH / 2;

  const ob = outline.bounds();
  const fb = textRes.bbox;
  let anchor;
  switch (p.ringPosition) {
    case 'left':
    case 'right':
      anchor = [0, (fb.minY + fb.maxY) / 2];
      break;
    case 'top':
      anchor = [(fb.minX + fb.maxX) / 2, 0];
      break;
    case 'topLeft':
      anchor = [ob.min[0] + R, ob.max[1] - R];
      break;
    default:
      anchor = [ob.max[0] - R, ob.max[1] - R];
  }
  const aL = rot(anchor);
  const outL = t(outline.rotate(theta));
  const TL = t(T.rotate(theta));
  const strip = rectFromBounds(K, t, -1000, aL[1] - halfY, 1000, aL[1] + halfY);
  const cut = t(outL.intersect(strip));
  const xEdge = cut.isEmpty() ? outL.bounds().min[0] : cut.bounds().min[0];
  const overlap = 0.35 * tabW;

  const holeAt = (c, grow = 0) =>
    isSlot
      ? roundedRect(K, t, holeW + 2 * grow, holeH + 2 * grow, Math.min(holeW, holeH) / 2 + grow, c[0], c[1], quality)
      : circle(K, t, Rh + grow, c[0], c[1], quality);

  let cL;
  if (isInternal) {
    cL = [xEdge + Rh + minWall + 0.2, aL[1]];
    // el borde real puede ser curvo: entrar hasta que el agujero con su pared quede dentro del contorno
    for (let i = 0; i < 80; i++) {
      if (t(holeAt(cL, minWall).subtract(outL)).area() <= 1e-3) break;
      cL = [cL[0] + 0.25, cL[1]];
    }
    const guard = holeAt(cL, minWall);
    if (!t(guard.intersect(TL)).isEmpty() || t(guard.subtract(outL)).area() > 1e-3) messages.push({ level: 'warn', code: 'ring.noRoom' });
  } else {
    cL = [xEdge - tabW / 2 + overlap, aL[1]];
    // alejar del texto hasta cumplir la pared mínima
    for (let i = 0; i < 80; i++) {
      if (t(holeAt(cL, minWall).intersect(TL)).isEmpty()) break;
      cL = [cL[0] - 0.25, cL[1]];
    }
  }
  const off = rot([p.ringOffsetXMm, p.ringOffsetYMm]);
  cL = [cL[0] + off[0], cL[1] + off[1]];

  const holeL = holeAt(cL, 0);
  const holeG = t(holeL.rotate(-theta));
  if (isInternal) return { S: t(outline.subtract(holeG)), hole: holeG };

  const tabL = isSlot ? roundedRect(K, t, tabW, tabH, Math.min(tabW, tabH) / 2, cL[0], cL[1], quality) : circle(K, t, R, cL[0], cL[1], quality);
  // cuello: hull(oreja + tramo cercano del borde) recortado a la franja de la oreja
  const near = t(outL.intersect(rectFromBounds(K, t, xEdge, cL[1] - halfY, xEdge + overlap + tabW / 2, cL[1] + halfY)));
  let body = t(outline.add(t(tabL.rotate(-theta))));
  if (!near.isEmpty()) {
    const hull = t(K.CrossSection.hull([tabL, near]));
    const stripN = rectFromBounds(K, t, -1000, cL[1] - halfY, 1000, cL[1] + halfY);
    body = t(body.add(t(t(hull.intersect(stripN)).rotate(-theta))));
  }
  return { S: t(body.subtract(holeG)), hole: holeG };
}

/** Texto + contorno + argolla. Si `scaleOverride` viene, se usa en vez de resolver el tamaño. */
function makeSilhouette(K, t, p, printer, font, lines, scaleOverride, quality, tol, env) {
  const modeForText = p.sizeMode === 'overallWidth' ? 'textWidth' : p.sizeMode;
  const ringFixed = p.ringType === 'tab' || p.ringType === 'slot' ? p.ringOuterMm * 0.65 : 0;
  const fixed = p.marginMm * 2 + ringFixed;
  const sizeForText = p.sizeMode === 'overallWidth' ? Math.max(5, p.sizeMm - fixed) : p.sizeMm;
  let textRes = textToCrossSection(K, t, font, {
    lines,
    sizeMode: modeForText,
    sizeMm: sizeForText,
    scale: scaleOverride,
    letterSpacingMm: p.letterSpacingMm,
    lineSpacing: p.lineSpacing,
    align: p.align,
    boldOffsetMm: p.boldOffsetMm,
    uppercase: p.uppercase,
    tolMm: tol,
    fallbackFont: env.fallbackFont,
  });
  if (!textRes.cs) return null;
  textRes = addIcon(K, t, p, textRes, env.iconPolys);
  const T = textRes.cs;
  const outline = buildOutline(K, t, p, T, textRes.bbox, quality);
  const ring = buildRing(K, t, p, printer, outline, T, textRes, quality, env.messages);
  return { textRes, T, outline, S: ring.S, hole: ring.hole };
}

// ---------------------------------------------------------------------------
// Pieza completa
// ---------------------------------------------------------------------------

function buildItem(K, p, printer, font, name, env) {
  const sc = createScope();
  const t = sc.track;
  const messages = env.messages;
  try {
    const lines = name
      .split('\n')
      .slice(0, MAX_LINES)
      .map((l) => l.slice(0, MAX_CHARS));
    const tol = qualityTol(p.curveQuality);
    const quality = p.curveQuality === 'draft' ? 0.5 : p.curveQuality === 'high' ? 1.6 : 1;

    let sil = makeSilhouette(K, t, p, printer, font, lines, env.forceScale, quality, tol, env);
    if (!sil) return null;
    if (p.sizeMode === 'overallWidth' && env.forceScale == null) {
      const ringFixed = p.ringType === 'tab' || p.ringType === 'slot' ? p.ringOuterMm * 0.65 : 0;
      if (p.sizeMm <= p.marginMm * 2 + ringFixed + 2) messages.push({ level: 'error', code: 'size.tooSmall' });
      // el margen y la argolla no escalan: corregir la escala del texto iterando
      for (let i = 0; i < 4; i++) {
        const sb = sil.S.bounds();
        const W = sb.max[0] - sb.min[0];
        if (Math.abs(W - p.sizeMm) < 0.05) break;
        const wText = sil.textRes.bbox.maxX - sil.textRes.bbox.minX;
        const s = Math.max(1e-4, sil.textRes.scale * (1 + (p.sizeMm - W) / Math.max(wText, 1e-6)));
        sil = makeSilhouette(K, t, p, printer, font, lines, s, quality, tol, { ...env, messages: [] }) ?? sil;
      }
    }
    const { textRes, T, S, hole } = sil;
    if (env.scaleOnly) return { scale: textRes.scale };
    if (textRes.missing.length) messages.push({ level: 'warn', code: 'text.missingGlyphs', params: { chars: textRes.missing.join(' ') } });

    // ---- validaciones 2D
    const n = printer.nozzleMm;
    const opened = t(t(T.offset(-n / 2, 'Round', 2, 16)).offset(n / 2, 'Round', 2, 16));
    if (T.area() > 0 && (T.area() - opened.area()) / T.area() > 0.15) messages.push({ level: 'warn', code: 'text.thin' });
    if (S.decompose().map(t).length > 1) messages.push({ level: 'error', code: 'shape.islands' });
    // la ranura usa sus propias medidas (ancho y alto), no las de la oreja ni las del agujero
    if (p.ringType === 'tab' && (p.ringOuterMm - p.ringHoleMm) / 2 < 1.5) messages.push({ level: 'warn', code: 'ring.thinWall' });
    if ((p.ringType === 'tab' || p.ringType === 'internal') && p.ringHoleMm < 3.5) messages.push({ level: 'warn', code: 'ring.smallHole' });

    const Tp = hole ? t(T.subtract(hole)) : T; // el texto nunca invade el agujero
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
    if (p.letterStyle === 'relief') {
      const zTop = Math.max(zf(H + p.reliefMm), H + layer);
      if (p.textEffect === 'outline') {
        const zO = Math.max(zf(H + p.textOutlineHeightMm), H + layer);
        const ring2d = t(t(T.offset(p.textOutlineMm, 'Round', 2, 32)).intersect(S));
        push('accent', ext(ring2d, H, zO));
        push('text', ext(Tp, zO, zO + (zTop - H)));
      } else {
        push('text', ext(Tp, H, zTop));
        if (p.textEffect === 'shadow') {
          const moved = t(T.translate([p.shadowDxMm, p.shadowDyMm]));
          const sh = t(t(moved.intersect(S)).subtract(T));
          push('accent', ext(sh, H, Math.max(zf(H + p.reliefMm * 0.6), H + layer)));
        }
      }
    } else {
      // engraved / flush: la cara superior queda plana
      let zFloor = zf(H - p.engraveDepthMm);
      if (zFloor < 0.8) {
        zFloor = zf(0.8);
        messages.push({ level: 'warn', code: 'engrave.thinFloor' });
      }
      zFloor = Math.min(zFloor, H - layer);
      const pocket = ext(Tp, zFloor, H + 1);
      if (pocket && baseM) baseM = t(baseM.subtract(pocket));
      if (p.letterStyle === 'flush') push('text', ext(Tp, zFloor, H));
    }
    push('base', baseM);

    if (p.border) {
      const bh = p.borderHeightMm ?? p.reliefMm;
      const zB = Math.max(zf(H + bh), H + layer);
      let b2d = t(S.subtract(t(S.offset(-p.borderWidthMm, 'Round', 2, 32))));
      if (hole && !p.borderAroundHole) b2d = t(b2d.subtract(t(hole.offset(p.borderWidthMm + 0.01, 'Round', 2, 32))));
      if (!t(b2d.intersect(t(T.offset(0.4, 'Round', 2, 16)))).isEmpty()) messages.push({ level: 'warn', code: 'border.touchesText' });
      b2d = t(b2d.subtract(Tp));
      const sameColor = !p.colors.border || p.colors.border === p.colors.text;
      push(sameColor ? 'text' : 'border', ext(b2d, H, zB));
    }

    // ---- agrupar por color
    const keys = [...new Set(solids.map((s) => s.colorKey))];
    let groups = keys.map((k) => {
      const list = solids.filter((s) => s.colorKey === k).map((s) => s.m);
      return { colorKey: k, m: list.length === 1 ? list[0] : t(K.Manifold.union(list)) };
    });
    if (p.faceDown && p.letterStyle !== 'relief') {
      const top = Math.max(...groups.map((g) => g.m.boundingBox().max[2]));
      const flip = (m) => t(t(m.rotate([180, 0, 0])).translate([0, 0, top]));
      groups = groups.map((g) => ({ ...g, m: flip(g.m) }));
    }

    const colorOf = (k) => (k === 'border' ? p.colors.border : p.colors[k]);
    const parts = groups.map((g) => {
      const bb = g.m.boundingBox();
      return {
        id: g.colorKey,
        label: PART_LABEL[g.colorKey] ?? g.colorKey,
        colorKey: g.colorKey,
        color: colorOf(g.colorKey),
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

    const { merged, box: mb, triangles } = mergeParts(K, t, groups.map((g) => g.m), env.preview);
    return {
      name,
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
