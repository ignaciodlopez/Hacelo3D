// Texto → CrossSection (2D). Interfaz aislada para poder cambiar opentype.js
// por harfbuzz más adelante (ver PLAN.md §1, "TextShaper").
//
// Convenciones: unidades en mm, Y hacia arriba. La baseline de la primera
// línea está en y = 0 y las siguientes van hacia abajo.

/** @typedef {{ minX: number, minY: number, maxX: number, maxY: number }} Box */

/**
 * @typedef {Object} TextOptions
 * @property {string[]} lines
 * @property {'textWidth'|'textHeight'|'capHeight'} [sizeMode]
 * @property {number} [sizeMm]
 * @property {number} [scale]            mm por unidad de fuente; si viene, ignora sizeMode/sizeMm
 * @property {number} [letterSpacingMm]
 * @property {number} [lineSpacing]
 * @property {'left'|'center'|'right'} [align]
 * @property {number} [boldOffsetMm]
 * @property {number} [tolMm]            tolerancia de aplanado de curvas
 * @property {boolean} [uppercase]
 * @property {any} [fallbackFont]        fuente de respaldo para caracteres que falten
 */

const pathCache = new WeakMap();

/** Comandos del glifo en unidades de fuente (y hacia abajo, como los devuelve opentype). */
function glyphCommands(font, glyph) {
  let perFont = pathCache.get(font);
  if (!perFont) {
    perFont = new Map();
    pathCache.set(font, perFont);
  }
  let cmds = perFont.get(glyph.index);
  if (!cmds) {
    cmds = glyph.getPath(0, 0, font.unitsPerEm).commands;
    perFont.set(glyph.index, cmds);
  }
  return cmds;
}

/** Alto de mayúscula en unidades de fuente. */
export function fontCapHeight(font) {
  const cap = font.tables?.os2?.sCapHeight;
  if (cap && cap > 0) return cap;
  const h = font.charToGlyph('H');
  return h && h.index !== 0 ? h.getBoundingBox().y2 : font.ascender * 0.7;
}

/** Quita los caracteres que ni la fuente ni la de respaldo tienen (y los informa). */
function sanitizeLine(font, fallback, line, missing) {
  let out = '';
  for (const ch of line.replace(/\t/g, ' ')) {
    if (font.charToGlyphIndex(ch) === 0 && !(fallback && fallback.charToGlyphIndex(ch) !== 0)) {
      if (!missing.includes(ch)) missing.push(ch);
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Texto → glifos `{ glyph, font, k }`. `k` escala los glifos de la fuente de respaldo
 * para igualar el alto de mayúscula de la fuente principal.
 *
 * Con ligaduras si la fuente las tiene. Algunas fuentes traen tablas GSUB que
 * opentype.js no soporta y lanza una excepción: en ese caso (o si hay que mezclar
 * con la fuente de respaldo) se mapea carácter por carácter, sin ligaduras.
 */
function shape(font, line, fallback, k) {
  const needsFallback = fallback && [...line].some((ch) => font.charToGlyphIndex(ch) === 0 && fallback.charToGlyphIndex(ch) !== 0);
  if (!needsFallback) {
    try {
      return font.stringToGlyphs(line).map((glyph) => ({ glyph, font, k: 1 }));
    } catch {
      return Array.from(line, (ch) => ({ glyph: font.charToGlyph(ch), font, k: 1 }));
    }
  }
  return Array.from(line, (ch) =>
    font.charToGlyphIndex(ch) !== 0 ? { glyph: font.charToGlyph(ch), font, k: 1 } : { glyph: fallback.charToGlyph(ch), font: fallback, k },
  );
}

/**
 * Posiciona los glifos para una escala dada (mm por unidad de fuente).
 * No toca manifold: sirve para medir y resolver la escala.
 */
function layout(font, lines, s, o) {
  const lineH = o.lineSpacing * (font.ascender - font.descender) * s;
  const rows = lines.map((line) => {
    const glyphs = line ? shape(font, line, o.fallbackFont, o.fbK) : [];
    const placed = [];
    let x = 0;
    glyphs.forEach((g, i) => {
      placed.push({ ...g, x });
      x += g.glyph.advanceWidth * s * g.k;
      if (i < glyphs.length - 1) {
        const next = glyphs[i + 1];
        const kern = g.font === next.font ? font.getKerningValue(g.glyph, next.glyph) * s : 0;
        x += kern + o.letterSpacingMm;
      }
    });
    return { placed, adv: x };
  });
  const maxAdv = Math.max(0, ...rows.map((r) => r.adv));
  const boxes = [];
  let all = null;
  rows.forEach((row, li) => {
    const ox = o.align === 'left' ? 0 : o.align === 'right' ? maxAdv - row.adv : (maxAdv - row.adv) / 2;
    const baseY = -li * lineH;
    row.ox = ox;
    row.baseY = baseY;
    let box = null;
    for (const p of row.placed) {
      if (glyphCommands(p.font, p.glyph).length === 0) continue;
      const b = p.glyph.getBoundingBox();
      const sg = s * p.k;
      const gb = {
        minX: ox + p.x + b.x1 * sg,
        maxX: ox + p.x + b.x2 * sg,
        minY: baseY + b.y1 * sg,
        maxY: baseY + b.y2 * sg,
      };
      box = box ? union(box, gb) : gb;
    }
    boxes.push(box);
    if (box) all = all ? union(all, box) : box;
  });
  return { rows, boxes, bbox: all };
}

function union(a, b) {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function solveScale(font, lines, o) {
  const grow = 2 * o.boldOffsetMm;
  if (o.sizeMode === 'capHeight') return o.sizeMm / fontCapHeight(font);
  const measure = (s) => {
    const { bbox } = layout(font, lines, s, o);
    if (!bbox) return 0;
    return (o.sizeMode === 'textHeight' ? bbox.maxY - bbox.minY : bbox.maxX - bbox.minX) + grow;
  };
  const target = o.sizeMm;
  const unit = measure(1);
  if (unit <= 0) return 0.01;
  let s = Math.max(1e-4, (target - grow) / Math.max(unit - grow, 1e-6));
  if (o.sizeMode === 'textHeight') return Math.max(1e-4, (target - grow) / (unit - grow));
  // el ancho depende del espaciado (mm absolutos): refinar con secante
  for (let i = 0; i < 5; i++) {
    const m = measure(s);
    if (Math.abs(m - target) < 1e-3) break;
    const m2 = measure(s * 1.01);
    const slope = (m2 - m) / (s * 0.01);
    if (!(slope > 1e-9)) break;
    s = Math.max(1e-4, s + (target - m) / slope);
  }
  return s;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Aplana comandos M/L/Q/C/Z a polígonos (en las mismas unidades de los comandos). */
function flatten(commands, tol) {
  /** @type {number[][][]} */
  const contours = [];
  let cur = null;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const close = () => {
    if (cur && cur.length >= 3) contours.push(cur);
    cur = null;
  };
  for (const c of commands) {
    switch (c.type) {
      case 'M':
        close();
        cur = [[c.x, c.y]];
        cx = sx = c.x;
        cy = sy = c.y;
        break;
      case 'L':
        cur?.push([c.x, c.y]);
        cx = c.x;
        cy = c.y;
        break;
      case 'Q': {
        const d = dist(cx + c.x, cy + c.y, 2 * c.x1, 2 * c.y1);
        const n = Math.min(48, Math.max(1, Math.ceil(Math.sqrt(d / (4 * tol)))));
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          const u = 1 - t;
          cur?.push([u * u * cx + 2 * u * t * c.x1 + t * t * c.x, u * u * cy + 2 * u * t * c.y1 + t * t * c.y]);
        }
        cx = c.x;
        cy = c.y;
        break;
      }
      case 'C': {
        const d1 = dist(cx + c.x2, cy + c.y2, 2 * c.x1, 2 * c.y1);
        const d2 = dist(c.x1 + c.x, c.y1 + c.y, 2 * c.x2, 2 * c.y2);
        const n = Math.min(64, Math.max(1, Math.ceil(Math.sqrt((3 * Math.max(d1, d2)) / (4 * tol)))));
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          const u = 1 - t;
          cur?.push([
            u * u * u * cx + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
            u * u * u * cy + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
          ]);
        }
        cx = c.x;
        cy = c.y;
        break;
      }
      case 'Z':
        close();
        cx = sx;
        cy = sy;
        break;
    }
  }
  close();
  // quitar el punto final duplicado si cierra sobre el inicial
  for (const poly of contours) {
    const a = poly[0];
    const b = poly[poly.length - 1];
    if (poly.length > 3 && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) poly.pop();
  }
  return contours;
}

/**
 * Genera la forma 2D del texto, centrada en el origen.
 * @param {any} K  módulo manifold-3d
 * @param {(o:any)=>any} t  tracker de memoria
 * @param {any} font  fuente opentype.js
 * @param {TextOptions} opts
 * @returns {{ cs: any|null, scale: number, capHeightMm: number, lineBoxes: (Box|null)[], bbox: Box|null, missing: string[] }}
 */
export function textToCrossSection(K, t, font, opts) {
  const o = {
    sizeMode: 'textWidth',
    sizeMm: 50,
    letterSpacingMm: 0,
    lineSpacing: 1,
    align: 'center',
    boldOffsetMm: 0,
    tolMm: 0.03,
    uppercase: false,
    ...opts,
  };
  const missing = [];
  o.fbK = o.fallbackFont ? fontCapHeight(font) / fontCapHeight(o.fallbackFont) : 1;
  const lines = o.lines.map((l) => sanitizeLine(font, o.fallbackFont, o.uppercase ? l.toLocaleUpperCase('es') : l, missing));
  if (lines.every((l) => l.trim() === '')) {
    return { cs: null, scale: 0, capHeightMm: 0, lineBoxes: [], bbox: null, missing };
  }
  const s = o.scale ?? solveScale(font, lines, o);
  const lay = layout(font, lines, s, o);

  const pieces = [];
  for (const row of lay.rows) {
    for (const p of row.placed) {
      const cmds = glyphCommands(p.font, p.glyph);
      if (cmds.length === 0) continue;
      const sg = s * p.k;
      const contours = flatten(cmds, Math.max(o.tolMm / sg, 0.05));
      if (contours.length === 0) continue;
      const ox = row.ox + p.x;
      const polys = contours.map((poly) => poly.map(([x, y]) => [ox + x * sg, row.baseY - y * sg]));
      pieces.push(t(new K.CrossSection(polys, 'NonZero')));
    }
  }
  let cs = t(K.CrossSection.union(pieces));
  if (o.boldOffsetMm > 0) cs = t(cs.offset(o.boldOffsetMm, 'Round', 2, 32));
  cs = t(cs.simplify(o.tolMm / 4));

  const b = cs.bounds();
  const cx = (b.min[0] + b.max[0]) / 2;
  const cy = (b.min[1] + b.max[1]) / 2;
  cs = t(cs.translate([-cx, -cy]));
  const grow = o.boldOffsetMm;
  const lineBoxes = lay.boxes.map((box) =>
    box && {
      minX: box.minX - cx - grow,
      maxX: box.maxX - cx + grow,
      minY: box.minY - cy - grow,
      maxY: box.maxY - cy + grow,
    },
  );
  return {
    cs,
    scale: s,
    capHeightMm: fontCapHeight(font) * s,
    lineBoxes,
    bbox: { minX: b.min[0] - cx, minY: b.min[1] - cy, maxX: b.max[0] - cx, maxY: b.max[1] - cy },
    missing,
  };
}
