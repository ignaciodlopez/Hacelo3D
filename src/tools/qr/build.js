// Generación de la placa con código QR. FUNCIÓN PURA: params → BuildResult (sin DOM ni three.js).
//
// El QR lo calcula `qrcode-generator` (matriz de módulos oscuros/claros); acá solo se convierte a
// geometría: base (placa redondeada, con oreja opcional) + módulos oscuros en relieve o al ras.

import qrcode from 'qrcode-generator';
import { createScope } from '../../core/kernel/manifold.js';
import { textToCrossSection } from '../../core/kernel/text.js';
import { circle, roundedRect } from '../../core/kernel/shapes2d.js';
import { magnetPockets, magnetDepth } from '../../core/kernel/magnets.js';
import { manifoldToMesh, mergeParts } from '../../core/kernel/mesh.js';
import { analyzeParts, fitsBed, round } from '../../core/kernel/analysis.js';
import { normalizePrinter, snapZ } from '../../core/printer/profiles.js';
import { normalizeParams, qualityTol } from './params.js';
import { buildPayload } from './payload.js';

// la librería codifica en Latin-1 por defecto: acá todo va en UTF-8 (tildes, ñ, emojis)
qrcode.stringToBytes = (s) => Array.from(new TextEncoder().encode(s));

const PART_LABEL = { base: 'Base', code: 'Código' };

/** Matriz del QR: `dark(fila, columna)`. Lanza si el contenido no entra en la versión máxima. */
export function encodeQr(data, ecc) {
  const qr = qrcode(0, ecc);
  qr.addData(data, 'Byte');
  qr.make();
  return { n: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
}

/** Luminancia relativa (0 = negro, 1 = blanco) de un color #rrggbb. */
export function luminance(hex) {
  const ch = (i) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
}

/**
 * @param {any} K  módulo manifold-3d ya inicializado
 * @param {any} rawParams
 * @param {{ getFont:(id:string)=>Promise<any>, printer?:any, fallbackFontId?:string }} ctx
 */
export async function build(K, rawParams, ctx) {
  const p = normalizeParams(rawParams);
  const printer = normalizePrinter(ctx.printer);
  const messages = [];
  const { data, title } = buildPayload(p);
  if (!data) return fail(messages, 'qr.empty');
  let qr;
  try {
    qr = encodeQr(data, p.ecc);
  } catch {
    return fail(messages, 'qr.tooLong');
  }
  const label = p.label.trim();
  const font = label ? await ctx.getFont(p.fontId) : null;
  const fallbackFont = label ? await ctx.getFont(ctx.fallbackFontId ?? 'lato-bold').catch(() => null) : null;
  const item = buildItem(K, p, printer, qr, label, font, fallbackFont, title, messages, !!ctx.preview);
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
      scale: item.moduleMm,
    },
  };
}

function fail(messages, code) {
  messages.push({ level: 'error', code });
  return { items: [], messages, info: { colorChanges: null, gramsByColor: {}, needsMMU: false, triangles: 0, scale: 0 } };
}

/** Módulos oscuros como rectángulos (se unen en tiras horizontales para reducir polígonos). QR: x ∈ [-S/2, S/2], y ∈ [0, S]. */
function modulePolygons(qr, size) {
  const m = size / qr.n;
  const polys = [];
  for (let r = 0; r < qr.n; r++) {
    const y1 = size - r * m;
    const y0 = y1 - m;
    let c = 0;
    while (c < qr.n) {
      if (!qr.dark(r, c)) {
        c++;
        continue;
      }
      let end = c;
      while (end + 1 < qr.n && qr.dark(r, end + 1)) end++;
      const x0 = -size / 2 + c * m;
      const x1 = -size / 2 + (end + 1) * m;
      polys.push([
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ]);
      c = end + 1;
    }
  }
  return { polys, m };
}

function buildItem(K, p, printer, qr, label, font, fallbackFont, title, messages, preview) {
  const sc = createScope();
  const t = sc.track;
  try {
    const tol = qualityTol(p.curveQuality);
    const quality = p.curveQuality === 'draft' ? 0.5 : p.curveQuality === 'high' ? 1.6 : 1;
    const S = p.sizeMm;
    const { polys, m } = modulePolygons(qr, S);

    // ---- avisos de lectura
    if (m < 2 * printer.nozzleMm) messages.push({ level: 'warn', code: 'qr.smallModules', params: { mm: round(m, 2), min: round(2 * printer.nozzleMm, 2) } });
    if (p.marginMm < 2 * m) messages.push({ level: 'warn', code: 'qr.smallQuiet', params: { mm: round(2 * m, 1) } });
    const lumBase = luminance(p.colors.base);
    const lumCode = luminance(p.colors.code);
    if (Math.abs(lumBase - lumCode) < 0.3) messages.push({ level: 'warn', code: 'qr.lowContrast' });
    else if (lumBase < lumCode) messages.push({ level: 'info', code: 'qr.inverted' });

    // ---- 2D: código + texto opcional
    const codeCs = t(new K.CrossSection(polys, 'NonZero'));
    let content = codeCs;
    let box = { minX: -S / 2, maxX: S / 2, minY: 0, maxY: S };
    if (label) {
      const textRes = textToCrossSection(K, t, font, {
        lines: [label],
        sizeMode: 'capHeight',
        sizeMm: p.labelSizeMm,
        align: 'center',
        tolMm: tol,
        fallbackFont,
      });
      if (textRes.missing.length) messages.push({ level: 'warn', code: 'text.missingGlyphs', params: { chars: textRes.missing.join(' ') } });
      if (textRes.cs) {
        const bb = textRes.bbox;
        const w = bb.maxX - bb.minX;
        const h = bb.maxY - bb.minY;
        const gap = Math.max(2.5, p.marginMm * 0.6);
        const cy = -gap - h / 2;
        const placed = t(textRes.cs.translate([0, cy]));
        content = t(K.CrossSection.union([codeCs, placed]));
        box = { minX: Math.min(box.minX, -w / 2), maxX: Math.max(box.maxX, w / 2), minY: cy - h / 2, maxY: S };
      }
    }

    // ---- placa (+ oreja con agujero)
    const pw = box.maxX - box.minX + 2 * p.marginMm;
    const ph = box.maxY - box.minY + 2 * p.marginMm;
    const pcx = (box.minX + box.maxX) / 2;
    const pcy = (box.minY + box.maxY) / 2;
    // las esquinas redondeadas no pueden comerse el módulo de la esquina del código
    const radius = Math.min(p.cornerRadiusMm, p.marginMm * 3.2);
    const plate = roundedRect(K, t, pw, ph, radius, pcx, pcy, quality);
    let body = plate;
    let hole = null;
    if (p.ring !== 'none') {
      const R = p.ringOuterMm / 2;
      const Rh = p.ringHoleMm / 2;
      const off = Rh + 0.8; // pared mínima entre el agujero y el borde de la placa
      const c = p.ring === 'top' ? [pcx, pcy + ph / 2 + off] : [pcx - pw / 2 - off, pcy];
      hole = circle(K, t, Rh, c[0], c[1], quality);
      body = t(K.CrossSection.union([plate, circle(K, t, R, c[0], c[1], quality)]));
      body = t(body.subtract(hole));
    }

    // ---- 3D
    const zf = (z) => (p.snapToLayers ? snapZ(z, printer) : z);
    const layer = printer.layerHeightMm;
    let H = zf(p.baseThicknessMm);

    // ---- imanes en la cara de atrás: huecos ciegos desde z = 0; sobre el hueco queda una "tapa" de 0,8 mm
    const mag = magnetPockets(K, t, { count: p.magnets, diameterMm: p.magnetDiameterMm, clearanceMm: p.magnetClearanceMm, box: { cx: pcx, cy: pcy, w: pw, h: ph }, quality });
    const magDepth = mag.cs ? zf(magnetDepth(p.magnetThicknessMm, p.magnetClearanceMm)) : 0;
    if (mag.skipped) messages.push({ level: 'warn', code: 'magnet.noRoom', params: { n: mag.skipped } });
    if (mag.cs) {
      // el código al ras también se hunde desde adelante: los dos huecos no pueden tocarse
      const needH = zf(magDepth + 0.8 + (p.style === 'flush' ? p.reliefMm : 0));
      if (H < needH - 1e-6) {
        H = needH;
        messages.push({ level: 'info', code: 'magnet.thickened', params: { mm: round(H, 1) } });
      }
    }
    const ext = (cs, z0, z1) => {
      if (cs.isEmpty() || z1 - z0 < 1e-6) return null;
      return t(t(cs.extrude(z1 - z0)).translate([0, 0, z0]));
    };
    /** @type {{ colorKey:string, m:any }[]} */
    const solids = [];
    const push = (colorKey, mesh) => mesh && solids.push({ colorKey, m: mesh });
    let baseM = ext(body, 0, H);
    if (baseM && mag.cs) baseM = t(baseM.subtract(t(t(mag.cs.extrude(magDepth + 1)).translate([0, 0, -1]))));
    if (p.style === 'relief') {
      push('code', ext(content, H, Math.max(zf(H + p.reliefMm), H + layer)));
    } else {
      // al ras: el código se hunde en la base y queda a la misma altura (dos colores, cara plana)
      const zFloor = Math.min(zf(Math.max(0.8, H - p.reliefMm)), H - layer);
      const pocket = ext(content, zFloor, H + 1);
      if (pocket && baseM) baseM = t(baseM.subtract(pocket));
      push('code', ext(content, zFloor, H));
    }
    push('base', baseM);

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
      name: title,
      parts,
      merged,
      sizeMm: [mb.max[0] - mb.min[0], mb.max[1] - mb.min[1], mb.max[2] - mb.min[2]],
      offsetXY: [0, 0],
      bboxXY: [mb.min[0], mb.min[1], mb.max[0], mb.max[1]],
      triangles,
      analysis,
      moduleMm: m,
      modules: qr.n,
    };
  } finally {
    sc.dispose();
  }
}
