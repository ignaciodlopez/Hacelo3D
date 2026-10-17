// Siluetas de la chapita. Cada forma devuelve un CrossSection centrado en el origen que ocupa
// exactamente ancho × alto. Las de "proporción libre" usan los dos valores; las de proporción
// fija (huella, corazón…) toman el ancho y calculan el alto.
//
// Las formas de varias partes (huella, flor, gato…) se arman unidas y se suavizan con un
// cierre/apertura morfológico (offset redondeado): el resultado es siempre UNA sola pieza
// sin esquinas vivas ni muescas finas que no se puedan imprimir.

import { circle, ellipse, roundedRect, rectFromBounds, fillHoles, segmentsFor } from '../../core/kernel/shapes2d.js';

/** Formas cuyo alto se puede elegir; el resto lo calcula a partir del ancho. */
export const FREE_SHAPES = ['bone', 'rounded', 'oval'];
export const SHAPES = ['bone', 'rounded', 'oval', 'circle', 'heart', 'paw', 'cat', 'star', 'shield', 'hexagon', 'flower', 'cloud', 'house', 'fish', 'icon'];

const SEG = 32;

/** Apertura (redondea esquinas convexas) y cierre (rellena muescas) con radios en las unidades de `cs`. */
function smooth(t, cs, open, close) {
  let out = cs;
  if (close > 0) out = t(t(out.offset(close, 'Round', 2, SEG)).offset(-close, 'Round', 2, SEG));
  if (open > 0) out = t(t(out.offset(-open, 'Round', 2, SEG)).offset(open, 'Round', 2, SEG));
  return out;
}

const polygon = (K, t, pts) => t(new K.CrossSection([pts], 'NonZero'));
const union = (K, t, list) => t(K.CrossSection.union(list));

/** Elipse girada `deg` grados, centrada en (cx, cy). */
function tiltedEllipse(K, t, rx, ry, cx, cy, deg) {
  const e = ellipse(K, t, rx, ry, 0, 0, 1);
  return t(t(e.rotate(deg)).translate([cx, cy]));
}

/** Pasa el contorno a un CrossSection de bbox W × H centrado en el origen. */
function fit(t, cs, W, H) {
  const b = cs.bounds();
  const bw = b.max[0] - b.min[0];
  const bh = b.max[1] - b.min[1];
  const moved = t(cs.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]));
  return t(moved.scale([W / bw, H / bh]));
}

/** Proporción alto/ancho de una forma de proporción fija (unidades de unit). */
function aspectOf(cs) {
  const b = cs.bounds();
  return (b.max[1] - b.min[1]) / (b.max[0] - b.min[0]);
}

// ---------------------------------------------------------------------------
// formas de proporción fija: se dibujan en una caja de ~1 de ancho (para un perro, usá el ícono "Perro")
// ---------------------------------------------------------------------------

const UNIT = {
  heart(K, t) {
    const pts = [];
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      pts.push([16 * Math.sin(a) ** 3, 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)]);
    }
    return smooth(t, polygon(K, t, pts.map(([x, y]) => [x / 32, y / 32])), 0.02, 0);
  },

  paw(K, t) {
    // Almohadilla grande (triángulo redondeado) y cuatro dedos ovalados bien separados, cada uno unido a la
    // almohadilla por un cuello angosto: así se lee como huella y sigue siendo una sola pieza.
    const pad = t(K.CrossSection.hull([circle(K, t, 0.2, -0.18, -0.25, 1), circle(K, t, 0.2, 0.18, -0.25, 1), circle(K, t, 0.23, 0, -0.03, 1)]));
    const toes = [
      [tiltedEllipse(K, t, 0.11, 0.145, -0.38, 0.05, 25), -0.38, 0.05],
      [tiltedEllipse(K, t, 0.11, 0.155, -0.155, 0.255, 8), -0.155, 0.255],
      [tiltedEllipse(K, t, 0.11, 0.155, 0.155, 0.255, -8), 0.155, 0.255],
      [tiltedEllipse(K, t, 0.11, 0.145, 0.38, 0.05, -25), 0.38, 0.05],
    ];
    const necks = toes.map(([toe, x, y]) => t(K.CrossSection.hull([toe, circle(K, t, 0.06, x * 0.45, y * 0.45 - 0.011, 1)])));
    return smooth(t, union(K, t, [pad, ...necks]), 0, 0.012);
  },

  cat(K, t) {
    const face = ellipse(K, t, 0.42, 0.34, 0, -0.08, 1);
    const ears = [
      polygon(K, t, [[-0.41, 0.03], [-0.34, 0.4], [-0.07, 0.22]]),
      polygon(K, t, [[0.41, 0.03], [0.34, 0.4], [0.07, 0.22]]),
    ];
    return smooth(t, union(K, t, [face, ...ears]), 0.04, 0.03);
  },

  star(K, t) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.5 : 0.23;
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return smooth(t, polygon(K, t, pts), 0.045, 0.02);
  },

  shield(K, t) {
    // lados rectos y punta redondeada abajo
    const pts = [[-0.5, 0.45], [0.5, 0.45], [0.5, 0.0]];
    const quad = (p0, p1, p2, n) => {
      for (let i = 1; i <= n; i++) {
        const s = i / n;
        const u = 1 - s;
        pts.push([u * u * p0[0] + 2 * u * s * p1[0] + s * s * p2[0], u * u * p0[1] + 2 * u * s * p1[1] + s * s * p2[1]]);
      }
    };
    quad([0.5, 0.0], [0.5, -0.36], [0, -0.56], 24);
    quad([0, -0.56], [-0.5, -0.36], [-0.5, 0.0], 24);
    return smooth(t, polygon(K, t, pts), 0.07, 0);
  },

  hexagon(K, t) {
    const pts = [];
    for (let i = 0; i < 6; i++) pts.push([0.5 * Math.cos((i * Math.PI) / 3), 0.5 * Math.sin((i * Math.PI) / 3)]);
    return smooth(t, polygon(K, t, pts), 0.05, 0);
  },

  flower(K, t) {
    const petals = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + Math.PI / 6;
      petals.push(circle(K, t, 0.2, 0.29 * Math.cos(a), 0.29 * Math.sin(a), 1));
    }
    return smooth(t, union(K, t, [circle(K, t, 0.24, 0, 0, 1), ...petals]), 0, 0.04);
  },

  cloud(K, t) {
    // Nube de ícono clásica (medida sobre una referencia): cuatro arcos de círculo —izquierda, grande, mediano y
    // punta derecha— que se cortan en muescas vivas, sobre una base plana con los extremos redondeados.
    const arc = (r, x, y) => t(t(K.CrossSection.circle(r, 128)).translate([x, y]));
    const arcs = [arc(0.156, -0.339, -0.11), arc(0.252, -0.094, 0.013), arc(0.21, 0.223, -0.088), arc(0.121, 0.379, -0.146)];
    const FLOOR = -0.266;
    // el relleno de abajo une los arcos sin llegar a las muescas
    const body = rectFromBounds(K, t, -0.339, FLOOR, 0.379, -0.07);
    const above = rectFromBounds(K, t, -1, FLOOR, 1, 1);
    const cloud = t(t(K.CrossSection.union([...arcs, body])).intersect(above));
    return smooth(t, cloud, 0.004, 0.005);
  },

  house(K, t) {
    const body = polygon(K, t, [[-0.37, -0.42], [0.37, -0.42], [0.37, 0.1], [-0.37, 0.1]]);
    const roof = polygon(K, t, [[-0.5, 0.06], [0, 0.5], [0.5, 0.06]]);
    return smooth(t, union(K, t, [body, roof]), 0.04, 0.02);
  },

  fish(K, t) {
    const body = ellipse(K, t, 0.36, 0.21, -0.1, 0, 1);
    const tail = polygon(K, t, [[0.12, 0.0], [0.5, 0.22], [0.5, -0.22]]);
    return smooth(t, union(K, t, [body, tail]), 0.035, 0.05);
  },
};

// ---------------------------------------------------------------------------

/**
 * @param {any} K
 * @param {(o:any)=>any} t
 * @param {{ shape:string, widthMm:number, heightMm:number, cornerRadiusMm:number, iconPolys?:number[][][]|null }} o
 * @returns {{ cs:any, widthMm:number, heightMm:number } | null}  null si falta el ícono
 */
export function buildShape(K, t, o) {
  const W = o.widthMm;
  let H = o.heightMm;
  const q = 1.6;
  switch (o.shape) {
    case 'rounded':
      return { cs: roundedRect(K, t, W, H, o.cornerRadiusMm, 0, 0, q), widthMm: W, heightMm: H };
    case 'oval':
      return { cs: ellipse(K, t, W / 2, H / 2, 0, 0, q), widthMm: W, heightMm: H };
    case 'circle':
      return { cs: circle(K, t, W / 2, 0, 0, q), widthMm: W, heightMm: W };
    case 'bone': {
      // la barra tiene que caber entre los dos nudos: con poco ancho se baja el alto
      H = Math.min(H, W / 1.7);
      // nudos grandes (casi tangentes arriba y abajo, con apenas una muesca en la punta) y barra gruesa
      const r = H * 0.3;
      const barH = H * 0.6;
      const dx = W / 2 - r;
      const dy = H / 2 - r;
      const bar = roundedRect(K, t, 2 * dx, barH, barH * 0.2, 0, 0, q);
      const knobs = [-1, 1].flatMap((sx) => [-1, 1].map((sy) => circle(K, t, r, sx * dx, sy * dy, q)));
      // el cierre redondea el encuentro entre cada nudo y la barra
      const raw = union(K, t, [bar, ...knobs]);
      return { cs: fit(t, smooth(t, raw, 0, H * 0.1), W, H), widthMm: W, heightMm: H };
    }
    case 'icon': {
      if (!o.iconPolys || !o.iconPolys.length) return null;
      const raw = t(new K.CrossSection(o.iconPolys, 'NonZero'));
      if (raw.isEmpty()) return null;
      const rb = raw.bounds();
      const w0 = rb.max[0] - rb.min[0];
      const h0 = rb.max[1] - rb.min[1];
      const s = W / Math.max(w0, h0);
      const scaled = t(t(raw.translate([-(rb.min[0] + rb.max[0]) / 2, -(rb.min[1] + rb.max[1]) / 2])).scale(s));
      // los íconos tienen huecos y piezas sueltas (ojos, dedos): se rellenan y se funden
      const solid = smooth(t, fillHoles(K, t, smooth(t, scaled, 0, W * 0.05)), W * 0.012, 0);
      const b = solid.bounds();
      return { cs: solid, widthMm: b.max[0] - b.min[0], heightMm: b.max[1] - b.min[1] };
    }
    default: {
      const make = UNIT[o.shape] ?? UNIT.heart;
      const unit = fillHoles(K, t, make(K, t));
      const H2 = W * aspectOf(unit);
      return { cs: fit(t, unit, W, H2), widthMm: W, heightMm: H2 };
    }
  }
}

export { segmentsFor };
