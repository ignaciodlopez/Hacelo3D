// Generación de la chapita para mascotas. FUNCIÓN PURA: params → BuildResult (sin DOM ni three.js).
//
// Se imprime acostada: placa abajo (color de la base) y encima, en el color de las letras, el texto
// y el borde elevado. Con el texto "en relieve" es UN solo cambio de color (sin AMS: pausa en la capa
// donde termina la placa). El texto se ajusta solo al lugar que deja la forma: se agranda o se achica
// hasta ocupar el espacio libre, lejos del borde y de los agujeros.

import { createScope } from '../../core/kernel/manifold.js';
import { textToCrossSection } from '../../core/kernel/text.js';
import { manifoldToMesh, mergeParts } from '../../core/kernel/mesh.js';
import { analyzeParts, fitsBed, round } from '../../core/kernel/analysis.js';
import { normalizePrinter, snapZ } from '../../core/printer/profiles.js';
import { normalizeParams, qualityOf } from './params.js';
import { buildShape } from './shapes.js';
import { buildAttach } from './attach.js';

const PART_LABEL = { base: 'Base', text: 'Letras', border: 'Borde' };
/** Escala mínima y máxima del bloque de texto respecto de los tamaños pedidos. */
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
/** Cuánto más puede crecer una línea sobre las demás cuando sobra lugar a su altura (modo automático). */
const MAX_LINE_GROW = 1.8;

/**
 * @param {any} K  módulo manifold-3d ya inicializado
 * @param {any} rawParams
 * @param {{ getFont:(id:string)=>Promise<any>, printer?:any, fallbackFontId?:string, iconPolys?:Record<string, number[][][]> }} ctx
 */
export async function build(K, rawParams, ctx) {
  const p = normalizeParams(rawParams);
  const printer = normalizePrinter(ctx.printer);
  const messages = [];
  const lines = [
    { key: 'name', text: p.name, cap: p.nameSizeMm },
    { key: 'phone', text: p.phone, cap: p.phoneSizeMm },
    { key: 'extra', text: p.extra, cap: p.extraSizeMm },
  ].filter((l) => l.text.trim() !== '');
  const iconPolys = p.shape === 'icon' && p.icon ? (ctx.iconPolys?.[p.icon] ?? null) : null;
  if (p.shape === 'icon' && !iconPolys) return fail(messages, 'tag.noIcon');
  const font = lines.length ? await ctx.getFont(p.fontId) : null;
  const fallbackFont = lines.length ? await ctx.getFont(ctx.fallbackFontId ?? 'lato-bold').catch(() => null) : null;
  const item = buildItem(K, p, printer, { lines, font, fallbackFont, iconPolys, preview: !!ctx.preview }, messages);
  if (!item) return fail(messages, 'tag.noIcon');
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
      scale: item.textScale,
    },
  };
}

function fail(messages, code) {
  messages.push({ level: 'error', code });
  return { items: [], messages, info: { colorChanges: null, gramsByColor: {}, needsMMU: false, triangles: 0, scale: 0 } };
}

/** Centroide (ponderado por área) de un CrossSection; los huecos restan. */
function centroid(cs) {
  let A = 0;
  let X = 0;
  let Y = 0;
  for (const poly of cs.toPolygons()) {
    for (let i = 0, n = poly.length; i < n; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % n];
      const cr = p[0] * q[1] - q[0] * p[1];
      A += cr;
      X += (p[0] + q[0]) * cr;
      Y += (p[1] + q[1]) * cr;
    }
  }
  if (Math.abs(A) < 1e-9) {
    const b = cs.bounds();
    return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];
  }
  return [X / (3 * A), Y / (3 * A)];
}

/**
 * Apila las líneas (ya centradas cada una) una debajo de otra, centradas en el origen. La línea i va a escala
 * `k · ms[i]` y el espacio entre extremos es `k · gap` mm.
 */
function stackLines(K, t, rows, gap, k = 1, ms = null) {
  const sc = rows.map((_, i) => k * (ms ? ms[i] : 1));
  const hs = rows.map((r, i) => (r.bbox.maxY - r.bbox.minY) * sc[i]);
  const total = hs.reduce((a, b) => a + b, 0) + gap * k * (rows.length - 1);
  let top = total / 2;
  const pieces = rows.map((r, i) => {
    const y = top - hs[i] / 2;
    top -= hs[i] + gap * k;
    return t(t(r.cs.scale([sc[i], sc[i]])).translate([0, y]));
  });
  return t(K.CrossSection.union(pieces));
}

function buildItem(K, p, printer, src, messages) {
  const sc = createScope();
  const t = sc.track;
  try {
    const { tol, seg } = qualityOf(p.curveQuality);
    const rimMm = p.rim ? p.rimWidthMm : 0;

    // ---- silueta + sujeción
    const shape = buildShape(K, t, { shape: p.shape, widthMm: p.widthMm, heightMm: p.heightMm, cornerRadiusMm: p.cornerRadiusMm, iconPolys: src.iconPolys });
    if (!shape) return null;
    const { full, warns } = buildAttach(K, t, p, shape.cs, { rimMm: Math.max(rimMm, 0.8), quality: seg });
    messages.push(...warns);
    if (full.decompose().map(t).length > 1) messages.push({ level: 'error', code: 'tag.islands' });

    // ---- lugar libre para el texto: la silueta achicada por el borde y el margen
    const gapToEdge = rimMm + p.textMarginMm;
    const field = t(full.offset(-gapToEdge, 'Round', 2, 32));
    // el centro del bloque se toma sobre el cuerpo (sin la orejita), para que no lo corra hacia ella
    const bodyField = t(t(shape.cs.offset(-gapToEdge, 'Round', 2, 32)).intersect(field));
    // el bloque se centra en el centroide del lugar libre (no en el centro de su caja): en formas que no son
    // simétricas de arriba abajo, como la nube o la casita, el texto va hacia donde hay más espacio
    const [gx0, gy] = centroid(bodyField.isEmpty() ? field : bodyField);
    // En horizontal se centra en el cuerpo principal: sin las partes angostas (la cola del pez, un cuello) que
    // corren el centroide hacia donde no entra el texto. Se abre el lugar libre y se toma el pedazo más grande.
    const gx = (() => {
      const src = bodyField.isEmpty() ? field : bodyField;
      const b = src.bounds();
      const r = 0.25 * Math.min(b.max[0] - b.min[0], b.max[1] - b.min[1]);
      if (!(r > 0.5)) return gx0;
      const opened = t(t(src.offset(-r, 'Round', 2, 32)).offset(r, 'Round', 2, 32));
      const pieces = opened.decompose().map(t);
      if (!pieces.length) return gx0;
      const main = pieces.reduce((a, c) => (c.area() > a.area() ? c : a));
      return centroid(main)[0];
    })();
    // En una forma simétrica de arriba abajo (círculo, óvalo, huesito, hexágono…) el texto se centra en la forma, no en
    // el lugar que dejan los agujeros: un bloque corrido hacia arriba o abajo se ve torcido aunque sea un poco más grande.
    const sb = shape.cs.bounds();
    const mirrored = t(shape.cs.mirror([0, 1]));
    const asym = t(shape.cs.subtract(mirrored)).area() + t(mirrored.subtract(shape.cs)).area();
    const symmetric = asym < 0.005 * shape.cs.area();
    const yCenter = (sb.min[1] + sb.max[1]) / 2;
    const cx = gx;
    const cy = (symmetric ? yCenter : gy) + p.textOffsetYMm;

    // ---- texto
    let T = null;
    let textScale = 0;
    let lineScales = [];
    if (src.lines.length && !field.isEmpty()) {
      const rows = [];
      const missing = [];
      for (const l of src.lines) {
        const r = textToCrossSection(K, t, src.font, {
          lines: [l.text],
          sizeMode: 'capHeight',
          sizeMm: l.cap,
          boldOffsetMm: p.boldOffsetMm,
          letterSpacingMm: p.letterSpacingMm,
          uppercase: p.uppercase,
          tolMm: tol,
          fallbackFont: src.fallbackFont,
        });
        for (const ch of r.missing) if (!missing.includes(ch)) missing.push(ch);
        if (r.cs) rows.push({ ...r, key: l.key, cap: l.cap });
      }
      if (missing.length) messages.push({ level: 'warn', code: 'text.missingGlyphs', params: { chars: missing.join(' ') } });
      if (rows.length) {
        const at = (k, y, ms = null) => t(t(stackLines(K, t, rows, p.lineGapMm, k, ms)).translate([cx, y]));
        const fits = (k, y, ms = null) => t(at(k, y, ms).subtract(field)).area() < 0.02;
        const maxS = p.textSizing === 'auto' ? MAX_SCALE : 1;
        /** Mayor escala que entra con el bloque centrado a la altura `y` (0 si ni la mínima entra). */
        const solve = (y, iters) => {
          if (fits(maxS, y)) return maxS;
          if (!fits(MIN_SCALE, y)) return 0;
          let lo = MIN_SCALE;
          let hi = maxS;
          for (let i = 0; i < iters; i++) {
            const mid = (lo + hi) / 2;
            if (fits(mid, y)) lo = mid;
            else hi = mid;
          }
          return lo;
        };
        // Sin corrimiento manual se prueban varias alturas y se elige la que deja el texto más grande
        // (la casita o la nube tienen el lugar ancho lejos del centro). Con empate, la más cercana al centro.
        let y0 = cy;
        if (p.textOffsetYMm === 0) {
          const fb = field.bounds();
          const span = (fb.max[1] - fb.min[1]) / 2;
          const scored = Array.from({ length: 13 }, (_, k) => gy + ((k - 6) / 6) * span).map((y) => ({ y, k: solve(y, 8) }));
          const best = Math.max(...scored.map((c) => c.k));
          if (best > 0) {
            // se acepta perder hasta un 10 % de tamaño a cambio de que el texto quede centrado y no pegado a un borde
            const ok = scored.filter((c) => c.k >= best * 0.9);
            // con empate se toma el medio del tramo posible (centro de la pared de la casita); si ahí no entra, el más cercano al centroide
            const mid = (Math.min(...ok.map((c) => c.y)) + Math.max(...ok.map((c) => c.y))) / 2;
            y0 = solve(mid, 8) >= best * 0.9 ? mid : ok.sort((a, b) => Math.abs(a.y - gy) - Math.abs(b.y - gy))[0].y;
          }
          // forma simétrica: centrado en la forma, mientras no cueste más de un 15 % de tamaño
          if (symmetric && best > 0 && solve(yCenter, 8) >= best * 0.85) y0 = yCenter;
        }
        let s = solve(y0, 14);
        let clipped = false;
        if (s === 0) {
          // ni al mínimo entra: se recorta a la zona libre para que nunca se salga de la placa ni tape un agujero
          s = MIN_SCALE;
          clipped = true;
          messages.push({ level: 'warn', code: 'tag.textTooBig' });
        }
        const shrunkPct = !clipped && p.textSizing === 'fixed' && s < 0.995 ? Math.round(s * 100) : null;
        // En automático cada línea crece por su cuenta hasta usar el lugar que tiene a su altura (el nombre, más corto,
        // puede ser más grande que el teléfono en un círculo, donde manda el ancho de la línea más larga).
        // Al crecer una línea el bloque puede correrse un poco (así la línea más ancha se queda donde el lugar es más
        // ancho y la otra crece hacia donde hay espacio, p. ej. el nombre hacia arriba en un círculo).
        let ms = rows.map(() => 1);
        if (!clipped && p.textSizing === 'auto' && rows.length > 1 && s < maxS) {
          // en una forma simétrica el bloque se queda centrado mientras crece
          const SHIFTS = symmetric ? [0] : [0, 1, -1, 2, -2, 4, -4];
          /** Primera altura (cerca de y0) donde el bloque con las escalas `m` entra, o null. */
          const place = (m) => {
            for (const d of SHIFTS) if (fits(s, y0 + d, m)) return y0 + d;
            return null;
          };
          for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i < rows.length; i++) {
              const trial = (m) => ms.map((v, j) => (j === i ? m : v));
              let lo = ms[i];
              let hi = MAX_LINE_GROW;
              const top = place(trial(hi));
              if (top != null) {
                ms = trial(hi);
                y0 = top;
                continue;
              }
              let yLo = y0;
              for (let it = 0; it < 8; it++) {
                const mid = (lo + hi) / 2;
                const at0 = place(trial(mid));
                if (at0 != null) {
                  lo = mid;
                  yLo = at0;
                } else hi = mid;
              }
              ms = trial(lo);
              y0 = yLo;
            }
          }
        }
        textScale = s;
        lineScales = ms.map((m) => m * s);
        T = clipped ? t(at(s, y0, ms).intersect(field)) : at(s, y0, ms);
        // el alto de letra que realmente sale (puede ser menor que el pedido si no entra): siempre se informa
        if (!clipped) {
          const caps = {};
          rows.forEach((row, i) => (caps[row.key] = row.cap * lineScales[i]));
          const fmt = (v) => (v == null ? '—' : v.toFixed(1));
          messages.push({
            level: 'info',
            code: shrunkPct ? 'tag.textSizesShrunk' : 'tag.textSizes',
            params: { name: fmt(caps.name), phone: fmt(caps.phone), extra: caps.extra != null ? ` · extra ${fmt(caps.extra)} mm` : '', pct: shrunkPct ?? 100 },
          });
        }
        // trazos más finos que la boquilla no salen
        const n = printer.nozzleMm;
        const opened = t(t(T.offset(-n / 2, 'Round', 2, 16)).offset(n / 2, 'Round', 2, 16));
        if (T.area() > 0 && (T.area() - opened.area()) / T.area() > 0.15) messages.push({ level: 'warn', code: 'text.thin' });
      }
    } else if (src.lines.length) {
      // la forma es tan chica (o el borde y el margen tan anchos) que no queda lugar libre: sin esto el texto desaparecía sin aviso
      messages.push({ level: 'warn', code: 'tag.textTooBig' });
    }

    // ---- alturas (todas al borde de capa)
    const zf = (z) => (p.snapToLayers ? snapZ(z, printer) : z);
    const layer = printer.layerHeightMm;
    const H = zf(p.plateThicknessMm);
    const zTop = Math.max(zf(H + p.reliefMm), H + layer);
    const zRim = Math.max(zf(H + p.rimHeightMm), H + layer);
    const ext = (cs, z0, z1) => (!cs || cs.isEmpty() || z1 - z0 < 1e-6 ? null : t(t(cs.extrude(z1 - z0)).translate([0, 0, z0])));

    // el borde sin color propio usa el de las letras; lo que quede del color de la placa se junta con ella
    const colorOf = (k) => (k === 'border' ? (p.colors.border ?? p.colors.text) : p.colors[k]);
    const keyFor = (k) => (k !== 'base' && colorOf(k) === p.colors.base ? 'base' : k);
    if (T && p.textStyle === 'inlay' && p.colors.text === p.colors.base) messages.push({ level: 'warn', code: 'tag.inlaySameColor' });

    /** @type {{ colorKey:string, m:any }[]} */
    const solids = [];
    const push = (colorKey, m) => m && solids.push({ colorKey: keyFor(colorKey), m });

    let baseM = ext(full, 0, H);
    if (T && p.textStyle === 'raised') {
      push('text', ext(T, H, zTop));
    } else if (T) {
      // embutido o grabado: la cara de arriba queda plana, la placa conserva al menos 0,8 mm de piso
      let zFloor = zf(H - p.engraveDepthMm);
      if (zFloor < 0.8) {
        zFloor = zf(0.8);
        messages.push({ level: 'warn', code: 'engrave.thinFloor' });
      }
      zFloor = Math.min(zFloor, H - layer);
      const pocket = ext(T, zFloor, H + 1);
      if (pocket && baseM) baseM = t(baseM.subtract(pocket));
      if (p.textStyle === 'inlay') push('text', ext(T, zFloor, H));
    }
    push('base', baseM);

    if (rimMm > 0) {
      const ring2d = t(full.subtract(t(full.offset(-rimMm, 'Round', 2, 32))));
      const sameColor = !p.colors.border || p.colors.border === p.colors.text;
      push(sameColor ? 'text' : 'border', ext(ring2d, H, zRim));
    }

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

    const { merged, box: mb, triangles } = mergeParts(K, t, groups.map((g) => g.m), src.preview);
    return {
      name: p.name.trim() || 'chapita',
      parts,
      merged,
      sizeMm: [mb.max[0] - mb.min[0], mb.max[1] - mb.min[1], mb.max[2] - mb.min[2]],
      offsetXY: [0, 0],
      bboxXY: [mb.min[0], mb.min[1], mb.max[0], mb.max[1]],
      triangles,
      analysis,
      textScale,
      lineScales,
    };
  } finally {
    sc.dispose();
  }
}
