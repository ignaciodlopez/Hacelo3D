// Adornos 2D que cuelgan del aro: copos de nieve y estrellas (diseños propios, generados con código).
// Todo en mm, con el centro de la esfera en el origen. `K` es manifold-3d y `t` el tracker de memoria.

const RAD = Math.PI / 180;

/** Posición (grados, antihorario desde +X) de cada adorno según la cantidad. Los primeros son los más grandes. */
const ANGLES = {
  1: [125],
  2: [128, -55],
  3: [128, 50, -58],
  4: [128, 50, -58, -122],
};
/** Tamaño relativo de cada adorno: el segundo es más chico y fino, como en los diseños clásicos. */
const SIZE_K = [1, 0.74, 1, 0.88];
/** Estilo de cada adorno cuando se elige "variados". */
const MIX = ['fat', 'fine', 'classic', 'fat'];

/** Brazo de un copo, en unidades del radio R. `w` es el ancho del eje y `bw` el de las ramitas. */
const STYLES = {
  classic: { w: 0.15, bw: 0.11, angle: 52, branches: [[0.4, 0.38], [0.68, 0.28]], core: 0 },
  fat: { w: 0.22, bw: 0.17, angle: 50, branches: [[0.52, 0.36]], core: 0.2 },
  fine: { w: 0.105, bw: 0.085, angle: 55, branches: [[0.28, 0.24], [0.5, 0.3], [0.72, 0.2]], core: 0 },
};
/** Ancho mínimo de un trazo (mm): menos que eso no se imprime bien con boquilla de 0,4. */
const MIN_STROKE_MM = 1.6;

/** Cápsula (segmento con puntas redondas) como polígono antihorario. */
function capsule(x0, y0, x1, y1, w, n = 7) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const r = w / 2;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const th = a - Math.PI / 2 + (i / n) * Math.PI;
    pts.push([x1 + r * Math.cos(th), y1 + r * Math.sin(th)]);
  }
  for (let i = 0; i <= n; i++) {
    const th = a + Math.PI / 2 + (i / n) * Math.PI;
    pts.push([x0 + r * Math.cos(th), y0 + r * Math.sin(th)]);
  }
  return pts;
}

function circlePoly(r, n = 24) {
  return Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * 2 * Math.PI), r * Math.sin((i / n) * 2 * Math.PI)]);
}

/** Copo de nieve de 6 brazos y radio R, centrado en el origen. */
function snowflakePolys(R, style, rotDeg) {
  const st = STYLES[style] ?? STYLES.classic;
  const sw = Math.max(st.w * R, MIN_STROKE_MM);
  const bw = Math.max(st.bw * R, MIN_STROKE_MM);
  const polys = [];
  for (let k = 0; k < 6; k++) {
    const a = (rotDeg + k * 60) * RAD;
    const rot = (x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    const seg = (x0, y0, x1, y1, w) => {
      const [ax, ay] = rot(x0, y0);
      const [bx, by] = rot(x1, y1);
      polys.push(capsule(ax, ay, bx, by, w));
    };
    seg(0, 0, R - sw / 2, 0, sw);
    for (const [tt, len] of st.branches) {
      const bx = tt * R;
      const dx = len * R * Math.cos(st.angle * RAD);
      const dy = len * R * Math.sin(st.angle * RAD);
      seg(bx, 0, bx + dx, dy, bw);
      seg(bx, 0, bx + dx, -dy, bw);
    }
  }
  if (st.core > 0) polys.push(circlePoly(st.core * R));
  return polys;
}

/** Estrella de 5 puntas con puntas redondeadas (se redondea después con offset). */
function starPoly(R, rotDeg) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? R : R * 0.46;
    const a = (rotDeg + 90 + i * 36) * RAD;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

/**
 * Adornos del aro, todos juntos (puede venir vacío). Se superponen con el aro: el que llama los
 * recorta contra el círculo exterior y contra el nombre.
 * @returns {any|null} CrossSection o null si no hay adornos
 */
export function buildDecor(K, t, p, { rIn }) {
  const n = p.decoration === 'none' ? 0 : p.decoCount;
  if (n === 0) return null;
  const angles = ANGLES[n];
  const pieces = [];
  for (let i = 0; i < n; i++) {
    const seed = p.decoSeed;
    // la variación mueve y gira cada adorno de forma repetible (misma semilla → mismo resultado)
    const shift = seed ? (((seed * 37 + i * 53) % 60) - 30) * 0.5 : 0;
    const R = (p.decoSizeMm * SIZE_K[i]) * (1 + (seed ? 0.1 * Math.sin(seed * (i + 1.7)) : 0));
    const rot = (i * 17 + seed * 23) % 60;
    const ang = (angles[i] + shift) * RAD;
    const style = p.decoStyle === 'mix' ? MIX[i] : p.decoStyle;
    let cs;
    if (p.decoration === 'stars') {
      const star = t(new K.CrossSection([starPoly(R, rot)], 'NonZero'));
      cs = t(t(star.offset(-R * 0.06, 'Miter', 2, 8)).offset(R * 0.06, 'Round', 2, 12));
    } else {
      cs = t(new K.CrossSection(snowflakePolys(R, style, rot), 'NonZero'));
    }
    // el centro queda adentro del aro: las puntas que llegan al borde lo tocan y el adorno nace de él
    const cr = rIn - 0.45 * R;
    pieces.push(t(cs.translate([cr * Math.cos(ang), cr * Math.sin(ang)])));
  }
  return t(K.CrossSection.union(pieces));
}
