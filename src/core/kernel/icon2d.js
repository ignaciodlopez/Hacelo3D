// Íconos en 2D (CrossSection) compartidos por las herramientas: pegados a un texto o solos.
// `iconPolys` son los contornos del ícono sin normalizar (ver core/ui/iconPolygons.js).

/** Pega el ícono antes/después del texto. Devuelve un textRes nuevo (mismo formato). */
export function addIcon(K, t, p, textRes, iconPolys) {
  if (!iconPolys || !p.icon) return textRes;
  const raw = t(new K.CrossSection(iconPolys, 'NonZero'));
  const rb = raw.bounds();
  const h0 = rb.max[1] - rb.min[1];
  if (!(h0 > 0)) return textRes;
  const cap = textRes.capHeightMm || 10;
  const s = (p.iconScale * cap) / h0;
  const ic = t(t(raw.translate([-(rb.min[0] + rb.max[0]) / 2, -(rb.min[1] + rb.max[1]) / 2])).scale(s));
  const iw = (rb.max[0] - rb.min[0]) * s;
  const gap = 0.3 * cap;
  const bb = textRes.bbox;
  const cy = (bb.minY + bb.maxY) / 2;
  const pieces = [textRes.cs];
  if (p.iconPosition !== 'after') pieces.push(t(ic.translate([bb.minX - gap - iw / 2, cy])));
  if (p.iconPosition !== 'before') pieces.push(t(ic.translate([bb.maxX + gap + iw / 2, cy])));
  let cs = t(K.CrossSection.union(pieces));
  const b = cs.bounds();
  const cx = (b.min[0] + b.max[0]) / 2;
  const cyy = (b.min[1] + b.max[1]) / 2;
  cs = t(cs.translate([-cx, -cyy]));
  const shift = (box) => box && { minX: box.minX - cx, maxX: box.maxX - cx, minY: box.minY - cyy, maxY: box.maxY - cyy };
  return {
    ...textRes,
    cs,
    bbox: { minX: b.min[0] - cx, minY: b.min[1] - cyy, maxX: b.max[0] - cx, maxY: b.max[1] - cyy },
    lineBoxes: textRes.lineBoxes.map(shift),
  };
}

/**
 * Ícono solo, centrado en el origen y escalado para que su lado mayor mida `sizeMm`.
 * @returns {{ cs: any, bbox: { minX: number, minY: number, maxX: number, maxY: number } } | null}
 */
export function iconAlone(K, t, iconPolys, sizeMm) {
  if (!iconPolys || !iconPolys.length) return null;
  const raw = t(new K.CrossSection(iconPolys, 'NonZero'));
  if (raw.isEmpty()) return null;
  const rb = raw.bounds();
  const w = rb.max[0] - rb.min[0];
  const h = rb.max[1] - rb.min[1];
  const big = Math.max(w, h);
  if (!(big > 0)) return null;
  const s = sizeMm / big;
  const cs = t(t(raw.translate([-(rb.min[0] + rb.max[0]) / 2, -(rb.min[1] + rb.max[1]) / 2])).scale(s));
  return { cs, bbox: { minX: (-w * s) / 2, maxX: (w * s) / 2, minY: (-h * s) / 2, maxY: (h * s) / 2 } };
}
