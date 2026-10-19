// Generación del adorno navideño (esfera). FUNCIÓN PURA: params → BuildResult (sin DOM ni three.js).
//
// Dos piezas de color: el aro (con la argolla, los adornos calados y las dos barras) y el nombre.
// El nombre cruza las barras, que llegan hasta el aro: así todo queda unido. Todo se resuelve en 2D
// (CrossSection) y recién al final se extruye. El centro de la esfera es el origen.

import { createScope } from '../../core/kernel/manifold.js';
import { textToCrossSection } from '../../core/kernel/text.js';
import { circle, rectFromBounds } from '../../core/kernel/shapes2d.js';
import { bridgeLoose } from '../../core/kernel/connect.js';
import { manifoldToMesh } from '../../core/kernel/mesh.js';
import { analyzeParts, fitsBed, round } from '../../core/kernel/analysis.js';
import { normalizePrinter, snapZ } from '../../core/printer/profiles.js';
import { normalizeParams, qualityTol } from './params.js';
import { buildDecor } from './decor.js';

const PART_LABEL = { frame: 'Aro, barras y adornos', name: 'Nombre' };
const MAX_CHARS = 24;
/** El nombre no puede ser más alto que el radio interior (el diseño clásico ronda el 46 % del diámetro interior). */
const NAME_MAX_H_OF_RIN = 1;

/**
 * @param {any} K  módulo manifold-3d ya inicializado
 * @param {any} rawParams
 * @param {{ getFont:(id:string)=>Promise<any>, printer?:any, fallbackFontId?:string }} ctx
 */
export async function build(K, rawParams, ctx) {
  const p = normalizeParams(rawParams);
  const printer = normalizePrinter(ctx.printer);
  const messages = [];
  const name = p.name.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
  if (name === '') {
    messages.push({ level: 'error', code: 'ornament.empty' });
    return { items: [], messages, info: emptyInfo() };
  }
  const font = await ctx.getFont(p.fontId);
  const fallbackFont = await ctx.getFont(ctx.fallbackFontId ?? 'lato-bold').catch(() => null);
  const item = buildItem(K, p, printer, font, name, fallbackFont, messages);
  if (!item) {
    messages.push({ level: 'error', code: 'ornament.empty' });
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
// Pieza completa
// ---------------------------------------------------------------------------

function buildItem(K, p, printer, font, name, fallbackFont, messages) {
  const sc = createScope();
  const t = sc.track;
  try {
    const tol = qualityTol(p.curveQuality);
    const quality = p.curveQuality === 'draft' ? 0.5 : p.curveQuality === 'high' ? 1.6 : 1;
    const rOut = p.diameterMm / 2;
    const rIn = Math.max(rOut - p.ringWidthMm, 1);
    const disc = (r) => circle(K, t, r, 0, 0, quality);

    // ---- nombre
    const textOpts = {
      lines: [name],
      letterSpacingMm: p.letterSpacingMm,
      boldOffsetMm: p.boldOffsetMm,
      uppercase: p.uppercase,
      tolMm: tol,
      fallbackFont,
    };
    const maxW = Math.max(10, 2 * rOut - 2);
    let textRes = textToCrossSection(K, t, font, { ...textOpts, sizeMode: 'textWidth', sizeMm: Math.min(p.nameWidthMm, maxW) });
    if (!textRes.cs) return null;
    const maxH = rIn * NAME_MAX_H_OF_RIN;
    const h0 = textRes.bbox.maxY - textRes.bbox.minY;
    if (h0 > maxH) {
      // nombres cortos: a ese ancho las letras saldrían altísimas; se limita el alto
      textRes = textToCrossSection(K, t, font, { ...textOpts, sizeMode: 'textHeight', sizeMm: maxH });
      messages.push({ level: 'info', code: 'ornament.nameShrunk', params: { w: round(textRes.bbox.maxX - textRes.bbox.minX, 0) } });
    }
    if (textRes.missing.length) messages.push({ level: 'warn', code: 'text.missingGlyphs', params: { chars: textRes.missing.join(' ') } });
    const dy = p.nameOffsetYMm;
    // lo que sobresale del círculo exterior se recorta al ras
    let T = t(t(t(textRes.cs.translate([0, dy])).intersect(disc(rOut))).simplify(tol / 4));

    // ---- validaciones del texto
    const n = printer.nozzleMm;
    const opened = t(t(T.offset(-n / 2, 'Round', 2, 16)).offset(n / 2, 'Round', 2, 16));
    if (T.area() > 0 && (T.area() - opened.area()) / T.area() > 0.15) messages.push({ level: 'warn', code: 'text.thin' });

    // ---- barras: arriba de la altura de la x (o de las mayúsculas) y debajo de la línea base
    let bars = null;
    if (p.bars) {
      const hasLower = !p.uppercase && /[a-záéíóúüñ]/.test(name);
      const baseline = textRes.baselineYs[0] + dy;
      const top = baseline + (hasLower ? textRes.xHeightMm : textRes.capHeightMm);
      const w = p.barWidthMm;
      const strip = (y0, y1) => rectFromBounds(K, t, -rIn - 1, y0, rIn + 1, y1);
      const pieces = [strip(top + p.barGapMm, top + p.barGapMm + w), strip(baseline - p.barGapMm - w, baseline - p.barGapMm)];
      // llegan justo hasta el aro (mismo círculo que el hueco del aro: sin solapes entre colores)
      bars = t(t(K.CrossSection.union(pieces)).intersect(disc(rIn)));
      if (bars.isEmpty()) bars = null;
    }

    // ---- aro, argolla y adornos
    const ring = t(disc(rOut).subtract(disc(rIn)));
    let solid = ring;
    let hole = null;
    if (p.loop) {
      const rl = p.loopHoleMm / 2 + p.loopWallMm;
      const cy = Math.max(rOut + 0.1 * rl, rIn + 0.8 + p.loopHoleMm / 2);
      const loopDisc = t(circle(K, t, rl, 0, cy, quality));
      hole = t(circle(K, t, p.loopHoleMm / 2, 0, cy, quality));
      solid = t(K.CrossSection.union([ring, loopDisc]));
    }
    // puntos de la i/j y tildes: se unen al resto con un puentecito para que no queden flotando
    if (p.bridgeLoose) {
      const anchors = bars ? t(K.CrossSection.union([solid, bars])) : solid;
      const { bridges, count } = bridgeLoose(K, t, T, anchors, { widthMm: Math.max(2, 4 * n) });
      if (bridges) {
        T = t(K.CrossSection.union([T, bridges]));
        messages.push({ level: 'info', code: 'ornament.bridged', params: { n: count } });
      }
    }

    let frame = solid;
    const decor = buildDecor(K, t, p, { rIn });
    if (decor) {
      // los adornos no esquivan el nombre: se funden con él (el nombre se monta encima)
      const clipped = t(decor.intersect(disc(rOut)));
      // solo quedan los adornos que tocan el aro o las barras
      const anchor = t(t(bars ? K.CrossSection.union([solid, bars]) : solid).offset(0.1, 'Round', 2, 8));
      const kept = clipped
        .decompose()
        .map(t)
        .filter((c) => !t(c.intersect(anchor)).isEmpty());
      if (kept.length) frame = t(K.CrossSection.union([solid, ...kept]));
    }
    if (hole) frame = t(frame.subtract(hole));

    const zf = (z) => (p.snapToLayers ? snapZ(z, printer) : z);
    const ringH = zf(p.thicknessMm);
    const nameH = zf(p.nameHeightMm);
    const barH = zf(p.barHeightMm);
    // ---- piezas conectadas: el nombre (con sus barras) tiene que tocar el aro
    const everything = t(K.CrossSection.union([frame, T, ...(bars ? [bars] : [])]));
    if (everything.decompose().map(t).length > 1) messages.push({ level: 'warn', code: 'ornament.loose' });

    const ext = (cs, z0, z1) => {
      if (cs.isEmpty() || z1 - z0 < 1e-6) return null;
      return t(t(cs.extrude(z1 - z0)).translate([0, 0, z0]));
    };
    /** @type {{ colorKey:string, m:any }[]} */
    const solids = [];
    const push = (colorKey, m) => m && solids.push({ colorKey, m });
    // el nombre no esquiva las partes del aro (aro, barras, adornos): donde las cruza se monta encima,
    // arrancando a la altura de ellas, así queda agarrado y no solo pegado de costado
    push('frame', ext(frame, 0, ringH));
    if (bars) push('frame', ext(bars, 0, barH));
    const white = t(K.Manifold.union(solids.map((s) => s.m)));
    const nameM = ext(T, 0, nameH);
    if (nameM) push('name', t(nameM.subtract(white)));

    // ---- agrupar por color
    const keys = [...new Set(solids.map((s) => s.colorKey))];
    const groups = keys.map((k) => {
      const list = solids.filter((s) => s.colorKey === k).map((s) => s.m);
      return { colorKey: k, m: list.length === 1 ? list[0] : t(K.Manifold.union(list)) };
    });
    const merged = groups.length === 1 ? groups[0].m : t(K.Manifold.union(groups.map((g) => g.m)));

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
    const mb = merged.boundingBox();
    const analysis = analyzeParts(parts, printer);
    if (analysis.needsMMU && !printer.multiMaterial) messages.push({ level: 'warn', code: 'color.needsMMU' });

    const mergedMesh = manifoldToMesh(merged);
    return {
      name,
      parts,
      merged: { ...mergedMesh, status: merged.status(), genus: merged.genus(), volumeMm3: merged.volume() },
      sizeMm: [mb.max[0] - mb.min[0], mb.max[1] - mb.min[1], mb.max[2] - mb.min[2]],
      offsetXY: [0, 0],
      bboxXY: [mb.min[0], mb.min[1], mb.max[0], mb.max[1]],
      triangles: mergedMesh.indices.length / 3,
      analysis,
      scale: textRes.scale,
    };
  } finally {
    sc.dispose();
  }
}
