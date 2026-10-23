// Generación del llavero patente. FUNCIÓN PURA: params → BuildResult (sin DOM ni three.js).
//
// Dos estilos de patente argentina, con sus proporciones reales llevadas al ancho del llavero:
// - Mercosur (2016–hoy, 400 × 130): placa blanca, franja azul arriba con "REPÚBLICA ARGENTINA",
//   las estrellas del logo a la izquierda y la bandera a la derecha; caracteres negros (AB 123 CD).
// - Vieja (1994–2016, 294 × 129): placa blanca con un recuadro negro donde van los caracteres (ABC 123);
//   arriba "ARGENTINA" en celeste con el escudo a la izquierda, y cuatro ranuras de sujeción.
// Todo se arma en 2D y al final se extruye: placa abajo y encima, en relieve o embutido, lo de color.
// Lo que en la patente es del color de la placa (la leyenda y las estrellas en la franja, el blanco de la
// bandera, los caracteres en el recuadro) son huecos por los que se ve la placa: así no se pisan colores.

import { createScope } from '../../core/kernel/manifold.js';
import { textToCrossSection } from '../../core/kernel/text.js';
import { circle, ellipse, rectFromBounds, roundedRect } from '../../core/kernel/shapes2d.js';
import { manifoldToMesh } from '../../core/kernel/mesh.js';
import { analyzeParts, fitsBed, round } from '../../core/kernel/analysis.js';
import { normalizePrinter, snapZ } from '../../core/printer/profiles.js';
import { normalizeParams, qualityOf } from './params.js';

const PART_LABEL = { base: 'Placa', text: 'Caracteres', panel: 'Recuadro', band: 'Franja', legend: 'Leyenda', flag: 'Bandera' };
/** Orden de prioridad de los colores: una parte del mismo color que otra anterior se junta con ella. */
const COLOR_ORDER = ['base', 'text', 'panel', 'band', 'legend', 'flag'];
/** Por capas: de abajo hacia arriba. Los caracteres de la Mercosur y la leyenda de la vieja quedan más altos. */
const STACK = { mercosur: ['band', 'flag', 'text'], old: ['panel', 'legend'] };
/**
 * Proporciones de cada estilo, como fracción del alto de la placa. Mercosur: esquinas y franja azul (un poco
 * más alta que en la patente real para que la leyenda se pueda imprimir en un llavero). Vieja: esquinas, lo
 * que queda arriba y abajo del recuadro, su margen a los costados y sus esquinas.
 */
const STYLE = {
  mercosur: { aspect: 400 / 130, corner: 0.075, band: 0.28 },
  old: { aspect: 294 / 129, corner: 0.065, panelTop: 0.2, panelBottom: 0.15, panelSide: 0.044, panelCorner: 0.035 },
};
/** Fuente de la leyenda: gruesa para que salga a 2–3 mm de alto; en la vieja, con serifa como la original. */
const SMALL_FONT = { mercosur: 'lato-black', old: 'arvo' };
/** Por debajo de este alto de letra (mm) la leyenda difícilmente salga con una boquilla de 0,4. */
const SMALL_MIN_MM = 2;
/** Profundidad de las ranuras grabadas de la patente vieja (mm). */
const SLOT_DEPTH = 0.6;
/** Cuánto sobresale del borde el agujero de la orejita (mm). */
const EAR_GAP = 0.4;

/**
 * @param {any} K  módulo manifold-3d ya inicializado
 * @param {any} rawParams
 * @param {{ getFont:(id:string)=>Promise<any>, printer?:any, fallbackFontId?:string }} ctx
 */
export async function build(K, rawParams, ctx) {
  const p = normalizeParams(rawParams);
  const printer = normalizePrinter(ctx.printer);
  const messages = [];
  const old = p.style === 'old';
  const plate = (old ? p.plateOld : p.plateNew).trim();
  if (!plate) return fail(messages, 'plate.empty');
  const legend = (old ? p.topTextOld : p.topText).trim();
  const font = await ctx.getFont(p.fontId);
  const fallbackFont = await ctx.getFont(ctx.fallbackFontId ?? 'lato-bold').catch(() => null);
  const smallFont = legend ? await ctx.getFont(SMALL_FONT[p.style]).catch(() => fallbackFont ?? font) : null;
  const item = buildItem(K, p, printer, { plate, legend, font, fallbackFont, smallFont }, messages);
  if (!item) return fail(messages, 'plate.empty');
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
      scale: item.charScale,
    },
  };
}

function fail(messages, code) {
  messages.push({ level: 'error', code });
  return { items: [], messages, info: { colorChanges: null, gramsByColor: {}, needsMMU: false, triangles: 0, scale: 0 } };
}

/** Estrella de cinco puntas centrada en (cx, cy) con radio exterior `r`. */
function star(K, t, cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return t(new K.CrossSection([pts], 'NonZero'));
}

/**
 * Escudo argentino simplificado, de alto `h` centrado en (cx, cy): óvalo con la mitad de arriba llena y el
 * sol encima. A 3–5 mm de alto el detalle real (manos, gorro, laureles) no se imprime.
 */
function shield(K, t, cx, cy, h, seg) {
  const ry = h * 0.32;
  const rx = ry * 0.85;
  const oy = cy - h * 0.12;
  const w = Math.max(0.45, h * 0.08);
  const inner = ellipse(K, t, rx - w, ry - w, cx, oy, seg);
  const ring = t(ellipse(K, t, rx, ry, cx, oy, seg).subtract(inner));
  const upper = t(inner.intersect(rectFromBounds(K, t, cx - rx, oy, cx + rx, oy + ry)));
  // sol naciente: medio disco apoyado sobre el óvalo (un disco entero parece una cabeza)
  const sunR = rx * 0.8;
  const top = oy + ry - w / 2;
  const sun = t(circle(K, t, sunR, cx, top, seg).intersect(rectFromBounds(K, t, cx - sunR, top, cx + sunR, top + sunR)));
  return { cs: t(K.CrossSection.union([ring, upper, sun])), halfW: rx };
}

/**
 * Una línea de texto en mayúsculas centrada en (cx, cy) —centrada sobre el alto de las mayúsculas, así una
 * tilde no la corre— que entra en `maxW` × `maxH`. `stretch` ensancha las letras.
 * Devuelve la forma y el alto de mayúscula que quedó.
 */
function fitLine(K, t, font, text, o) {
  const r = textToCrossSection(K, t, font, {
    lines: [text],
    sizeMode: 'capHeight',
    sizeMm: o.capMm,
    letterSpacingMm: o.letterSpacingMm ?? 0,
    boldOffsetMm: o.boldOffsetMm ?? 0,
    uppercase: true,
    tolMm: o.tolMm,
    fallbackFont: o.fallbackFont,
  });
  if (!r.cs) return null;
  const sx = o.stretch ?? 1;
  const w = (r.bbox.maxX - r.bbox.minX) * sx;
  const h = r.bbox.maxY - r.bbox.minY;
  const k = Math.min(1, o.maxW / w, o.maxH / h);
  // el bloque viene centrado en su caja: se lleva el centro de las mayúsculas a (cx, cy)
  const capMid = (r.baselineYs[0] + r.capHeightMm / 2) * k;
  const cs = t(t(r.cs.scale([sx * k, k])).translate([o.cx, o.cy - capMid]));
  return { cs, capMm: r.capHeightMm * k, missing: r.missing };
}

function buildItem(K, p, printer, src, messages) {
  const sc = createScope();
  const t = sc.track;
  try {
    const { tol, seg } = qualityOf(p.curveQuality);
    const old = p.style === 'old';
    const st = STYLE[p.style];
    const W = p.widthMm;
    const Hp = W / st.aspect;
    const rC = st.corner * Hp;
    const bw = p.border ? p.borderWidthMm : 0;
    const gap = Math.max(0.8, 0.04 * Hp);
    const yTop = Hp / 2;
    const yBot = -Hp / 2;
    const body = roundedRect(K, t, W, Hp, rC, 0, 0, seg);
    const inner = bw > 0 ? t(body.offset(-bw, 'Round', 2, 32)) : body;
    const innerTop = yTop - bw;
    const sideIn = Math.max(gap, rC * 0.6); // las esquinas redondeadas se comen los costados de arriba
    const xL = -W / 2 + bw + sideIn;
    const xR = W / 2 - bw - sideIn;
    const missing = [];
    const addMissing = (m) => m && m.forEach((ch) => !missing.includes(ch) && missing.push(ch));

    // ---- franja (Mercosur) o recuadro (vieja): de ahí sale el lugar para los caracteres
    const panel = old
      ? (() => {
          const px = Math.max(bw + 0.6, st.panelSide * Hp);
          const y1 = yTop - st.panelTop * Hp;
          const y0 = yBot + st.panelBottom * Hp;
          return { x0: -W / 2 + px, x1: W / 2 - px, y0, y1, cs: roundedRect(K, t, W - 2 * px, y1 - y0, st.panelCorner * Hp, 0, (y0 + y1) / 2, seg) };
        })()
      : null;
    const bandY0 = old ? null : yTop - st.band * Hp;
    // en la vieja los caracteres llenan el recuadro casi de lado a lado; en la Mercosur llevan el doble de aire a los costados
    const zone = old
      ? { x0: panel.x0 + gap * 0.6, x1: panel.x1 - gap * 0.6, y0: panel.y0 + gap * 0.6, y1: panel.y1 - gap * 0.6 }
      : { x0: -W / 2 + bw + 2 * gap, x1: W / 2 - bw - 2 * gap, y0: yBot + bw + gap, y1: bandY0 - gap };

    // ---- sujeción: orejita afuera de la placa o agujero adentro (que le quita lugar a los caracteres)
    const hr = p.ringHoleMm / 2;
    let full = body;
    let hole = null;
    if (p.attach === 'ring') {
      if (p.ringWallMm < 1.6) messages.push({ level: 'warn', code: 'ring.thinWall' });
      const d = hr + EAR_GAP;
      const [cx, cy] = p.ringSide === 'top' ? [0, yTop + d] : p.ringSide === 'right' ? [W / 2 + d, 0] : [-W / 2 - d, 0];
      const ear = circle(K, t, hr + p.ringWallMm, cx, cy, seg);
      const blended = t(K.CrossSection.union([body, ear]));
      // el cierre redondea el encuentro de la orejita con la placa
      full = t(t(blended.offset(1, 'Round', 2, 32)).offset(-1, 'Round', 2, 32));
      full = t(full.subtract(circle(K, t, hr, cx, cy, seg)));
    } else if (p.attach === 'inside') {
      // adentro va siempre a un costado, a la altura de los caracteres: arriba chocaría con la franja o la leyenda
      const sgn = p.ringSide === 'right' ? 1 : -1;
      const cx = sgn * (W / 2 - bw - gap - hr);
      const cy = (zone.y0 + zone.y1) / 2;
      hole = circle(K, t, hr, cx, cy, seg);
      full = t(body.subtract(hole));
      if (sgn < 0) zone.x0 = Math.max(zone.x0, cx + hr + gap);
      else zone.x1 = Math.min(zone.x1, cx - hr - gap);
    }
    if (p.ringHoleMm < 3.5 && p.attach !== 'none') messages.push({ level: 'warn', code: 'ring.smallHole' });

    // ---- caracteres de la patente
    const chars = fitLine(K, t, src.font, src.plate, {
      capMm: ((zone.y1 - zone.y0) * p.charFill) / 100,
      maxW: zone.x1 - zone.x0,
      maxH: zone.y1 - zone.y0,
      cx: (zone.x0 + zone.x1) / 2,
      cy: (zone.y0 + zone.y1) / 2,
      stretch: p.charWidth / 100,
      tolMm: tol,
      letterSpacingMm: p.letterSpacingMm,
      boldOffsetMm: p.boldOffsetMm,
      fallbackFont: src.fallbackFont,
    });
    if (!chars) return null;
    addMissing(chars.missing);
    messages.push({ level: 'info', code: 'plate.charSize', params: { mm: round(chars.capMm, 1) } });

    // ---- leyenda de arriba, centrada en la placa entre lo que haya a los costados
    let smallCap = null;
    const legendLine = (half, cy, capMm, maxH, letterSpacingMm) => {
      if (!src.legend || !src.smallFont || half <= 0) return null;
      const l = fitLine(K, t, src.smallFont, src.legend, { capMm, maxW: 2 * half, maxH, cx: 0, cy, tolMm: tol, letterSpacingMm, fallbackFont: src.fallbackFont });
      if (!l) return null;
      addMissing(l.missing);
      smallCap = l.capMm;
      return l.cs;
    };

    /** Capas de color, de más a menos prioridad (lo anterior tapa a lo siguiente). */
    const layers = [];
    const border = bw > 0 ? t(body.subtract(inner)) : null;
    let slots = null;
    /** Zona de la franja o del recuadro: en relieve con AMS, sus huecos se rellenan del color de la placa. */
    let frame = null;
    if (!old) {
      const bh = innerTop - bandY0;
      const cy = (bandY0 + innerTop) / 2;
      const holes = [];
      let left = xL;
      let right = xR;
      if (p.showStars) {
        // las cuatro estrellas de la Cruz del Sur del logo del Mercosur
        const s = bh * 0.85;
        const r = s * 0.22;
        const at = (fx, fy) => [xL + fx * s, bandY0 + (bh - s) / 2 + fy * s];
        for (const [fx, fy] of [[0.5, 0.8], [0.18, 0.5], [0.8, 0.45], [0.45, 0.17]]) holes.push(star(K, t, ...at(fx, fy), r));
        left = xL + s + gap;
      }
      let flag = null;
      if (p.showFlag) {
        // bandera argentina: franjas celestes con la del medio hueca (se ve la placa)
        const fh = bh * 0.66;
        const fw = fh * 1.6;
        const fx0 = xR - fw;
        holes.push(rectFromBounds(K, t, fx0, cy - fh / 2, xR, cy + fh / 2));
        flag = t(K.CrossSection.union([rectFromBounds(K, t, fx0, cy + fh / 6, xR, cy + fh / 2), rectFromBounds(K, t, fx0, cy - fh / 2, xR, cy - fh / 6)]));
        right = xR - fw - gap;
      }
      const leg = legendLine(Math.min(-left, right), cy, bh * 0.5, bh * 0.8, bh * 0.04);
      if (leg) holes.push(leg);
      const band = t(inner.intersect(rectFromBounds(K, t, -W, bandY0, W, yTop + 1)));
      frame = band;
      layers.push(['text', t(K.CrossSection.union([chars.cs, ...(border ? [border] : [])]))]);
      layers.push(['band', holes.length ? t(band.subtract(t(K.CrossSection.union(holes)))) : band]);
      layers.push(['flag', flag]);
    } else {
      const stripH = innerTop - panel.y1;
      const cy = (panel.y1 + innerTop) / 2;
      const legendParts = [];
      let left = xL;
      if (p.showShield) {
        const sx = Math.max(-W / 2 + 0.093 * W, xL + stripH * 0.35);
        const sh = shield(K, t, sx, cy, stripH * 0.8, seg);
        legendParts.push(sh.cs);
        left = sx + sh.halfW + gap;
      }
      const leg = legendLine(Math.min(-left, xR), cy, stripH * 0.5, stripH * 0.8, stripH * 0.03);
      if (leg) legendParts.push(leg);
      if (p.showSlots) {
        // las cuatro ranuras de la chapa, grabadas en la placa
        const sw = 0.054 * W;
        const sh = Math.max(0.8, 0.038 * Hp);
        const at = [
          [-0.275 * W, yTop - Math.max(0.055 * Hp, bw + sh / 2 + 0.3)],
          [0.275 * W, yTop - Math.max(0.055 * Hp, bw + sh / 2 + 0.3)],
          [-0.275 * W, yBot + Math.max(0.065 * Hp, bw + sh / 2 + 0.3)],
          [0.275 * W, yBot + Math.max(0.065 * Hp, bw + sh / 2 + 0.3)],
        ];
        slots = t(K.CrossSection.union(at.map(([x, y]) => roundedRect(K, t, sw, sh, sh / 2, x, y, seg))));
      }
      // los caracteres se calan en el recuadro: se ven del color de la placa
      frame = panel.cs;
      layers.push(['panel', t(K.CrossSection.union([t(panel.cs.subtract(chars.cs)), ...(border ? [border] : [])]))]);
      layers.push(['legend', legendParts.length ? t(K.CrossSection.union(legendParts)) : null]);
    }
    if (smallCap != null && smallCap < SMALL_MIN_MM) messages.push({ level: 'warn', code: 'plate.smallText', params: { mm: round(smallCap, 1) } });
    if (missing.length) messages.push({ level: 'warn', code: 'text.missingGlyphs', params: { chars: missing.join(' ') } });

    // ---- nada de color pisa el agujero ni las ranuras
    const keepOut = [hole && t(hole.offset(0.8, 'Round', 2, 32)), slots && t(slots.offset(0.3, 'Round', 2, 32))].filter(Boolean);
    const avoid = keepOut.length ? t(K.CrossSection.union(keepOut)) : null;
    const decor = [];
    let taken = null;
    for (const [key, cs] of layers) {
      if (!cs || cs.isEmpty()) continue;
      let c = t(cs.intersect(body));
      if (avoid) c = t(c.subtract(avoid));
      if (taken) c = t(c.subtract(taken));
      if (c.isEmpty()) continue;
      decor.push({ key, cs: c });
      taken = taken ? t(K.CrossSection.union([taken, c])) : c;
    }
    const n = printer.nozzleMm;
    const all = taken;
    if (all) {
      const opened = t(t(all.offset(-n / 2, 'Round', 2, 16)).offset(n / 2, 'Round', 2, 16));
      if ((all.area() - opened.area()) / all.area() > 0.15) messages.push({ level: 'warn', code: 'text.thin' });
    }

    // ---- alturas (todas al borde de capa)
    const zf = (z) => (p.snapToLayers ? snapZ(z, printer) : z);
    const layer = printer.layerHeightMm;
    const H = zf(p.plateThicknessMm);
    const ext = (cs, z0, z1) => (!cs || cs.isEmpty() || z1 - z0 < 1e-6 ? null : t(t(cs.extrude(z1 - z0)).translate([0, 0, z0])));

    const c = p.colors;
    const palette = old ? { base: c.oldBase, panel: c.oldPanel, legend: c.oldLegend } : { base: c.base, text: c.text, band: c.band, flag: c.flag };
    const colorOf = (k) => palette[k];
    const keyFor = (k) => COLOR_ORDER.find((o) => o in palette && palette[o] === palette[k]) ?? k;

    /** @type {{ colorKey:string, m:any }[]} */
    const solids = [];
    const push = (k, m) => m && solids.push({ colorKey: keyFor(k), m });
    let baseM = ext(full, 0, H);
    if (slots && baseM) baseM = t(baseM.subtract(ext(slots, Math.min(zf(H - SLOT_DEPTH), H - layer), H + 1)));
    if (p.colorMode === 'layers') {
      // por capas (sin AMS): cada color es un escalón sobre el anterior y cada capa de impresión tiene un solo color.
      // Lo de arriba se apoya en un pedestal de los colores de abajo, que solo se ve como una rayita en el costado.
      const step = Math.max(zf(p.layerStepMm), layer);
      const levels = [];
      for (const k of STACK[p.style]) {
        const d = decor.find((x) => x.key === k);
        if (!d) continue;
        const key = keyFor(k);
        const lv = levels.find((l) => l.key === key);
        if (lv) lv.cs = t(K.CrossSection.union([lv.cs, d.cs]));
        else levels.push({ key, cs: d.cs });
      }
      // lo que es del color de la placa va primero: sigue a la placa sin cambiar de filamento
      levels.sort((a, b) => (a.key === 'base' ? 0 : 1) - (b.key === 'base' ? 0 : 1));
      levels.forEach((lv, i) => {
        const foot = i === levels.length - 1 ? lv.cs : t(K.CrossSection.union(levels.slice(i).map((l) => l.cs)));
        push(lv.key, ext(foot, H + i * step, H + (i + 1) * step));
      });
    } else if (p.textStyle === 'raised') {
      const zTop = Math.max(zf(H + p.reliefMm), H + layer);
      for (const d of decor) push(d.key, ext(d.cs, H, zTop));
      // con AMS todo lo de color queda a la misma altura: los huecos de la franja o del recuadro (leyenda, estrellas,
      // blanco de la bandera, caracteres de la vieja) se rellenan del color de la placa en vez de quedar más abajo
      if (frame) {
        let fill = all ? t(frame.subtract(all)) : frame;
        if (avoid) fill = t(fill.subtract(avoid));
        push('base', ext(fill, H, zTop));
      }
    } else if (all) {
      // embutido: la cara de arriba queda plana; la placa conserva al menos 0,8 mm de piso
      let zFloor = zf(H - p.reliefMm);
      if (zFloor < 0.8) {
        zFloor = zf(0.8);
        messages.push({ level: 'warn', code: 'engrave.thinFloor' });
      }
      zFloor = Math.min(zFloor, H - layer);
      const pocket = ext(all, zFloor, H + 1);
      if (pocket && baseM) baseM = t(baseM.subtract(pocket));
      for (const d of decor) push(d.key, ext(d.cs, zFloor, H));
    }
    push('base', baseM);

    // ---- agrupar por color
    const keys = COLOR_ORDER.filter((k) => solids.some((s) => s.colorKey === k));
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
        color: colorOf(g.colorKey),
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
      name: src.plate,
      parts,
      merged: { ...mergedMesh, status: merged.status(), genus: merged.genus(), volumeMm3: merged.volume() },
      sizeMm: [mb.max[0] - mb.min[0], mb.max[1] - mb.min[1], mb.max[2] - mb.min[2]],
      offsetXY: [0, 0],
      bboxXY: [mb.min[0], mb.min[1], mb.max[0], mb.max[1]],
      triangles: mergedMesh.indices.length / 3,
      analysis,
      charScale: chars.capMm,
    };
  } finally {
    sc.dispose();
  }
}
