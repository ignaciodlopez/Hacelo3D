// Formas 2D básicas sobre CrossSection. `K` es el módulo de manifold-3d y
// `t` la función `track` del scope que libera la memoria WASM.

/** Cantidad de segmentos para un círculo de radio r (≈ 1 cada 0.4 mm de perímetro). */
export function segmentsFor(r, quality = 1) {
  return Math.max(32, Math.min(256, Math.ceil(((2 * Math.PI * r) / 0.4) * quality)));
}

export function circle(K, t, r, cx = 0, cy = 0, quality = 1) {
  return t(t(K.CrossSection.circle(r, segmentsFor(r, quality))).translate([cx, cy]));
}

/** Rectángulo redondeado centrado en (cx, cy). Con radio >= alto/2 queda cápsula. */
export function roundedRect(K, t, w, h, radius, cx = 0, cy = 0, quality = 1) {
  const r = Math.max(0.01, Math.min(radius, w / 2, h / 2));
  const dx = w / 2 - r;
  const dy = h / 2 - r;
  const corners = [
    circle(K, t, r, cx - dx, cy - dy, quality),
    circle(K, t, r, cx + dx, cy - dy, quality),
    circle(K, t, r, cx + dx, cy + dy, quality),
    circle(K, t, r, cx - dx, cy + dy, quality),
  ];
  return t(K.CrossSection.hull(corners));
}

export function ellipse(K, t, rx, ry, cx = 0, cy = 0, quality = 1) {
  const unit = t(K.CrossSection.circle(1, segmentsFor(Math.max(rx, ry), quality)));
  return t(t(unit.scale([rx, ry])).translate([cx, cy]));
}

/** Rectángulo axis-aligned a partir de límites. */
export function rectFromBounds(K, t, minX, minY, maxX, maxY) {
  return t(t(K.CrossSection.square([maxX - minX, maxY - minY], false)).translate([minX, minY]));
}

/** Se queda solo con los contornos exteriores (rellena huecos internos). */
export function fillHoles(K, t, cs) {
  const parts = cs.decompose();
  const filled = parts.map((p) => {
    t(p);
    const polys = p.toPolygons();
    // el contorno exterior es el de mayor área absoluta
    let best = polys[0];
    let bestA = -1;
    for (const poly of polys) {
      const a = Math.abs(polyArea(poly));
      if (a > bestA) {
        bestA = a;
        best = poly;
      }
    }
    return t(new K.CrossSection([best], 'NonZero'));
  });
  if (filled.length === 0) return t(new K.CrossSection([], 'NonZero'));
  return t(K.CrossSection.union(filled));
}

export function polyArea(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Cierre morfológico: rellena muescas más angostas que 2·r. */
export function closing(t, cs, r) {
  if (r <= 0) return cs;
  const grown = t(cs.offset(r, 'Round', 2, 48));
  return t(grown.offset(-r, 'Round', 2, 48));
}

// ---------------------------------------------------------------------------
// Formas "decorativas" con ajuste automático alrededor del texto
// ---------------------------------------------------------------------------

function sampleQuad(p0, p1, p2, n = 10) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
  return out;
}

/** Polígono → CrossSection normalizado: alto 1, centrado en el bbox. Devuelve también el desplazamiento del centroide. */
function normalizeUnit(K, t, polys) {
  const raw = t(new K.CrossSection(polys, 'NonZero'));
  const b = raw.bounds();
  const h = b.max[1] - b.min[1];
  const cx = (b.min[0] + b.max[0]) / 2;
  const cy = (b.min[1] + b.max[1]) / 2;
  const unit = t(t(raw.translate([-cx, -cy])).scale(1 / h));
  // centroide por área
  let A = 0;
  let Cy = 0;
  for (const poly of unit.toPolygons()) {
    for (let i = 0, n = poly.length; i < n; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % n];
      const cr = p[0] * q[1] - q[0] * p[1];
      A += cr;
      Cy += (p[1] + q[1]) * cr;
    }
  }
  const oy = A !== 0 ? Cy / (3 * A) : 0;
  return { unit, oy };
}

/** Definiciones de formas (coordenadas arbitrarias; se normalizan). `stretch` = estiramiento horizontal máximo permitido. */
const UNIT_SHAPES = {
  heart: { stretchMax: 1.7, stretchK: 0.55, polys: () => {
    const pts = [];
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push([16 * Math.sin(a) ** 3, 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)]);
    }
    return [pts];
  } },
  hexagon: { stretchMax: 3.2, stretchK: 0.7, polys: () => {
    const pts = [];
    for (let i = 0; i < 6; i++) pts.push([Math.cos((i * Math.PI) / 3), Math.sin((i * Math.PI) / 3)]);
    return [pts];
  } },
  badge: { stretchMax: 2.2, stretchK: 0.6, polys: () => {
    // escudo: tapa recta arriba, lados rectos y punta redondeada abajo
    const pts = [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.05]];
    pts.push(...sampleQuad([0.5, -0.05], [0.5, -0.38], [0, -0.55], 14));
    pts.push(...sampleQuad([0, -0.55], [-0.5, -0.38], [-0.5, -0.05], 14));
    return [pts];
  } },
};

function unitShape(K, t, name) {
  if (name === 'cloud') {
    // unión de círculos sobre una base alargada
    const c = (r, x, y) => circle(K, t, r, x, y, 1);
    const base = roundedRect(K, t, 1.0, 0.42, 0.21, 0, -0.14, 1);
    const cs = t(K.CrossSection.union([base, c(0.2, -0.3, 0.02), c(0.3, 0.0, 0.1), c(0.22, 0.3, 0.0), c(0.16, -0.12, 0.0)]));
    const polys = cs.toPolygons();
    return normalizeUnit(K, t, polys);
  }
  if (name === 'tag') {
    // etiqueta de valija: esquinas del lado izquierdo recortadas
    const c = 0.28;
    const poly = [[-0.5 + c, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5 + c, -0.5], [-0.5, -0.5 + c], [-0.5, 0.5 - c]];
    const r = t(new K.CrossSection([poly], 'NonZero'));
    const rounded = t(t(r.offset(-0.06, 'Round', 2, 24)).offset(0.06, 'Round', 2, 24));
    return normalizeUnit(K, t, rounded.toPolygons());
  }
  const def = UNIT_SHAPES[name];
  return normalizeUnit(K, t, def.polys());
}

const STRETCH = { cloud: [2.6, 0.6], tag: [3.5, 0.9], ...Object.fromEntries(Object.entries(UNIT_SHAPES).map(([k, v]) => [k, [v.stretchMax, v.stretchK]])) };

/**
 * Escala uniforme mínima de una forma decorativa que contiene `Tm` (texto + margen).
 * Ajuste por búsqueda binaria: la forma alrededor del texto es la más chica posible.
 * @param {'heart'|'hexagon'|'badge'|'cloud'|'tag'|'ellipse'|'circle'} name
 */
export function fitShapeAround(K, t, name, Tm, quality = 1) {
  const b = Tm.bounds();
  const w = b.max[0] - b.min[0];
  const hgt = b.max[1] - b.min[1];
  const cx = (b.min[0] + b.max[0]) / 2;
  const cy = (b.min[1] + b.max[1]) / 2;
  const aspect = w / Math.max(hgt, 1e-6);

  let unit;
  let oy = 0;
  let ax;
  if (name === 'circle' || name === 'ellipse') {
    unit = t(K.CrossSection.circle(0.5, Math.max(48, Math.round(128 * quality))));
    ax = name === 'circle' ? 1 : Math.max(1, Math.min(aspect, 6));
  } else {
    const u = unitShape(K, t, name);
    unit = u.unit;
    oy = u.oy;
    const [max, k] = STRETCH[name];
    ax = Math.max(1, Math.min(max, aspect * k));
  }
  const make = (s) => t(t(unit.scale([ax * s, s])).translate([cx, cy - oy * s]));
  const contains = (s) => t(Tm.subtract(make(s))).area() < 1e-3;

  let hi = Math.max(w / ax, hgt) * 0.8;
  let guard = 0;
  while (!contains(hi) && guard++ < 40) hi *= 1.4;
  let lo = hi / 1.4;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (contains(mid)) hi = mid;
    else lo = mid;
  }
  return make(hi * 1.002);
}
