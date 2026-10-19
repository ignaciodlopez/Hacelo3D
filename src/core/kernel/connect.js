// Une al resto las partes sueltas de un dibujo 2D (puntos de la i y la j, tildes) con puentecitos finos.
// Sin esto, en una pieza donde las letras no apoyan sobre una base esas partes quedarían flotando.

const MAX_PIECES = 16;

/** Punto más cercano de `p` al segmento a–b. */
function closestOnSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const u = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return [a[0] + u * dx, a[1] + u * dy];
}

/** Par de puntos (uno en cada conjunto de polígonos) con la menor distancia. */
function nearestPair(polysA, polysB) {
  let best = { d: Infinity, p: null, q: null };
  const scan = (verts, segs, swap) => {
    for (const poly of verts) {
      for (const v of poly) {
        for (const sp of segs) {
          for (let i = 0, n = sp.length; i < n; i++) {
            const q = closestOnSegment(v, sp[i], sp[(i + 1) % n]);
            const d = Math.hypot(q[0] - v[0], q[1] - v[1]);
            if (d < best.d) best = swap ? { d, p: q, q: v } : { d, p: v, q };
          }
        }
      }
    }
  };
  scan(polysA, polysB, false);
  scan(polysB, polysA, true);
  return best;
}

/** Cápsula (segmento con puntas redondas) como polígono. */
function capsule(a, b, w, n = 6) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const r = w / 2;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const th = ang - Math.PI / 2 + (i / n) * Math.PI;
    pts.push([b[0] + r * Math.cos(th), b[1] + r * Math.sin(th)]);
  }
  for (let i = 0; i <= n; i++) {
    const th = ang + Math.PI / 2 + (i / n) * Math.PI;
    pts.push([a[0] + r * Math.cos(th), a[1] + r * Math.sin(th)]);
  }
  return pts;
}

/**
 * Puentes que unen las partes sueltas de `shape` con `anchors` (lo que ya está firme: aro, barras…).
 * Una parte suelta es una isla que no toca ni a los anclajes ni a otra parte unida. Solo se unen las
 * chicas (puntos, tildes): si una isla grande está suelta se deja así y el que llama avisa.
 *
 * @param {any} K  módulo manifold-3d
 * @param {(o:any)=>any} t  tracker de memoria
 * @param {any} shape  CrossSection con el dibujo (letras)
 * @param {any|null} anchors  CrossSection de lo firme, o null
 * @param {{ widthMm?: number, maxAreaFrac?: number }} [opts]
 * @returns {{ bridges: any|null, count: number }}
 */
export function bridgeLoose(K, t, shape, anchors, opts = {}) {
  const w = opts.widthMm ?? 2;
  const maxFrac = opts.maxAreaFrac ?? 0.12;
  const total = shape.area();
  let comps = shape.decompose().map(t);
  if (comps.length === 0) return { bridges: null, count: 0 };
  const touches = (a, b) => !t(t(a.offset(0.02, 'Round', 2, 8)).intersect(b)).isEmpty();

  // lo firme: los anclajes más todo lo que ya los toca (directo o en cadena)
  let firm = anchors ?? comps.reduce((best, c) => (c.area() > best.area() ? c : best));
  if (!anchors) comps = comps.filter((c) => c !== firm);
  for (let moved = true; moved; ) {
    moved = false;
    for (const c of [...comps]) {
      if (touches(c, firm)) {
        firm = t(K.CrossSection.union([firm, c]));
        comps = comps.filter((x) => x !== c);
        moved = true;
      }
    }
  }

  const bridges = [];
  for (let guard = 0; comps.length && guard < MAX_PIECES; guard++) {
    const firmPolys = firm.toPolygons();
    let pick = null;
    for (const c of comps) {
      if (c.area() > total * maxFrac) continue;
      const pair = nearestPair(c.toPolygons(), firmPolys);
      if (!pick || pair.d < pick.pair.d) pick = { c, pair };
    }
    if (!pick || !pick.pair.p) break;
    const bridge = t(new K.CrossSection([capsule(pick.pair.p, pick.pair.q, w)], 'NonZero'));
    bridges.push(bridge);
    firm = t(K.CrossSection.union([firm, pick.c, bridge]));
    comps = comps.filter((x) => x !== pick.c);
  }
  if (!bridges.length) return { bridges: null, count: 0 };
  return { bridges: t(K.CrossSection.union(bridges)), count: bridges.length };
}
