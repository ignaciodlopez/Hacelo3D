import { circle, ellipse, roundedRect, polyArea } from '../../core/kernel/shapes2d.js';
import { FLARE_KNEE, elongatedHandle, flareEase, flareRate, handleProfile } from './handles.js';

/** Pendiente máxima (Δ horizontal / Δz) de cualquier cara que mire hacia abajo: apenas menos de 45°. */
const MAX_SLOPE = 0.97;
/** Separación media entre puntos de un anillo (mm). */
const RING_STEP = 0.6;
const NECK_STEP = 0.15;
/** Redondeo del canto de la cabeza: cuánto se mete la cara que apoya en la cama (mm). */
const EDGE_ROUND = 1.2;
/** Separación máxima entre anillos (mm) y giro máximo del perfil entre dos anillos (radianes, ≈ 3°). */
const RING_RISE = 1.6;
const RING_TURN = 0.05;

const ccw = (poly) => (polyArea(poly) < 0 ? [...poly].reverse() : poly);

/**
 * Corte de los rayos desde (cx, cy) con un contorno convexo antihorario que rodea al centro: devuelve
 * ángulo → punto. El lado se busca por bisección sobre los ángulos de los vértices.
 */
function rayCaster(poly, cx, cy) {
  const angles = poly.map(([x, y]) => Math.atan2(y - cy, x - cx));
  const first = angles.indexOf(Math.min(...angles));
  const pts = [...poly.slice(first), ...poly.slice(0, first)];
  const a = [...angles.slice(first), ...angles.slice(0, first)];
  return (theta) => {
    let t = theta;
    while (t < a[0]) t += 2 * Math.PI;
    while (t >= a[0] + 2 * Math.PI) t -= 2 * Math.PI;
    let lo = 0;
    let hi = a.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (a[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    const [ax, ay] = pts[lo];
    const [bx, by] = pts[(lo + 1) % pts.length];
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);
    const ex = bx - ax;
    const ey = by - ay;
    const den = dx * ey - dy * ex;
    const dist = Math.abs(den) < 1e-12 ? Math.hypot(ax - cx, ay - cy) : ((ax - cx) * ey - (ay - cy) * ex) / den;
    return [cx + dx * dist, cy + dy * dist];
  };
}

/** Normales exteriores (unitarias) de un anillo antihorario. */
function normals(ring) {
  return ring.map((_, i) => {
    const [px, py] = ring[(i + ring.length - 1) % ring.length];
    const [nx, ny] = ring[(i + 1) % ring.length];
    const len = Math.hypot(nx - px, ny - py) || 1;
    return [(ny - py) / len, -(nx - px) / len];
  });
}

/** Cuánto sale hacia afuera el anillo `b` respecto de `a`, por mm de alto (la pendiente de voladizo entre ambos). */
function outwardSlope(a, b, dz) {
  const n = normals(b);
  return b.reduce((worst, [x, y], i) => Math.max(worst, ((x - a[i][0]) * n[i][0] + (y - a[i][1]) * n[i][1]) / dz), 0);
}

/**
 * Peso del largo frente al giro al repartir los puntos de un contorno. Con solo el giro, cada punto del cuello se une
 * con el punto de la placa que mira hacia el mismo lado (suma de Minkowski): las secciones intermedias son convexas y
 * lisas, sin ondas; un poco de largo reparte los lados rectos de la placa sobre un tramo del cuello en vez de un punto.
 */
const LENGTH_SHARE = 0.25;

/**
 * `count` puntos por cuadrante sobre un contorno convexo, simétrico y centrado en (cx, cy), repartidos según una
 * medida que suma giro y algo de largo (LENGTH_SHARE). Con la misma cuenta en dos siluetas distintas, cada punto
 * de una se corresponde con el de la otra que tiene casi la misma normal: esquinas con esquinas, lados con lados.
 */
function sampleContour(poly, cx, cy, count) {
  const cast = rayCaster(poly, cx, cy);
  const angleOf = ([x, y]) => {
    const a = Math.atan2(y - cy, x - cx);
    return a < 0 ? a + 2 * Math.PI : a;
  };
  const out = [];
  for (let q = 0; q < 4; q++) {
    const a0 = (q * Math.PI) / 2;
    const a1 = a0 + Math.PI / 2;
    const inside = poly.filter((pt) => angleOf(pt) > a0 + 1e-9 && angleOf(pt) < a1 - 1e-9).sort((a, b) => angleOf(a) - angleOf(b));
    const line = [cast(a0), ...inside, cast(a1)];
    const len = [];
    const dir = [];
    for (let i = 1; i < line.length; i++) {
      len.push(Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
      dir.push(Math.atan2(line[i][1] - line[i - 1][1], line[i][0] - line[i - 1][0]));
    }
    const total = len.reduce((a, b) => a + b, 0) || 1;
    const turnAt = (i) => {
      if (i <= 0 || i >= dir.length || len[i] < 1e-9 || len[i - 1] < 1e-9) return 0;
      const d = dir[i] - dir[i - 1];
      return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
    };
    // el giro de cada vértice se reparte entre sus dos lados: la medida crece sin saltos
    const raw = len.map((l, i) => (LENGTH_SHARE * l) / total + (turnAt(i) + turnAt(i + 1)) / Math.PI);
    // y su densidad (medida por mm) se suaviza a lo largo del contorno: si cambia de golpe (donde un lado recto se
    // vuelve esquina), el anillo intermedio quiebra su tangente y queda un pliegue que baja en diagonal hasta la placa
    const mid = len.map((l, i) => len.slice(0, i).reduce((a, b) => a + b, 0) + l / 2);
    const reach = Math.max(2, 0.15 * total);
    const weight = len.map((l, i) => {
      let num = 0;
      let den = 0;
      len.forEach((lj, j) => {
        const k = Math.max(0, 1 - Math.abs(mid[i] - mid[j]) / reach) * lj;
        num += k * (lj > 1e-9 ? raw[j] / lj : 0);
        den += k;
      });
      return den > 0 ? (num / den) * l : raw[i];
    });
    const sum = weight.reduce((a, b) => a + b, 0);
    let i = 0;
    let before = 0;
    for (let k = 0; k < count; k++) {
      const target = (k / count) * sum;
      while (i < weight.length - 1 && before + weight[i] < target) before += weight[i++];
      const f = weight[i] > 0 ? Math.min(1, (target - before) / weight[i]) : 0;
      out.push([line[i][0] + (line[i + 1][0] - line[i][0]) * f, line[i][1] + (line[i + 1][1] - line[i][1]) * f]);
    }
  }
  return out;
}

/**
 * Sólido a partir de anillos `{ z, pts }` con la misma cantidad de puntos y orden antihorario, cerrado con abanicos
 * desde el centro (cada sección tiene que ser convexa). Una única malla de vértices compartidos: sin booleanas entre
 * tramos, sin microseparaciones ni aristas de unión.
 */
function ringSolid(K, t, rings, cx, cy) {
  const count = rings[0].pts.length;
  const positions = [];
  const indices = [];
  for (const { z, pts } of rings) for (const [x, y] of pts) positions.push(x, y, z);
  const dist = (u, v) => Math.hypot(positions[u * 3] - positions[v * 3], positions[u * 3 + 1] - positions[v * 3 + 1], positions[u * 3 + 2] - positions[v * 3 + 2]);
  for (let ring = 0; ring < rings.length - 1; ring++) for (let j = 0; j < count; j++) {
    const a = ring * count + j;
    const b = ring * count + (j + 1) % count;
    // cada cuadrilátero se parte por su diagonal más corta: si está alabeado, el pliegue es el menor posible
    if (dist(a, b + count) <= dist(b, a + count)) indices.push(a, b, b + count, a, b + count, a + count);
    else indices.push(a, b, a + count, b, b + count, a + count);
  }
  const bottomCenter = positions.length / 3;
  const topCenter = bottomCenter + 1;
  positions.push(cx, cy, rings[0].z, cx, cy, rings.at(-1).z);
  const topRing = (rings.length - 1) * count;
  for (let j = 0; j < count; j++) {
    const next = (j + 1) % count;
    indices.push(bottomCenter, next, j, topCenter, topRing + j, topRing + next);
  }
  return t(new K.Manifold(new K.Mesh({ numProp: 3, vertProperties: Float32Array.from(positions), triVerts: Uint32Array.from(indices) })));
}

/**
 * Alturas (mm) de los anillos del mango: más juntos donde el perfil se curva, más separados donde es casi recto.
 * Así ninguna arista entre anillos marca un quiebre y no se gastan triángulos en tramos lisos.
 */
function ringHeights(profile, height, reach) {
  const pts = profile.map(([z, r]) => [z * height, r * reach]);
  const kept = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [lz, lr] = kept.at(-1);
    const [z, r] = pts[i];
    const [nz, nr] = pts[i + 1];
    const turn = Math.abs(Math.atan2(nr - r, nz - z) - Math.atan2(r - lr, z - lz));
    if (turn > RING_TURN || Math.hypot(nz - lz, nr - lr) > RING_RISE) kept.push(pts[i]);
  }
  kept.push(pts.at(-1));
  return kept.map(([z]) => z);
}

/** Radio del perfil a la altura relativa z (interpolación lineal entre muestras ya suaves). */
function radiusAt(profile, z) {
  let i = 1;
  while (i < profile.length - 1 && profile[i][0] < z) i++;
  const [z0, r0] = profile[i - 1];
  const [z1, r1] = profile[i];
  return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0 || 1);
}

/**
 * Mango y ensanche hasta la placa, en una sola malla de anillos. Se imprime con la cabeza sobre la cama:
 * - la cabeza tiene el canto redondeado (la cara plana queda en la palma y en la cama, sin pata de elefante);
 * - el perfil del mango termina vertical y el ensanche arranca vertical: la unión no tiene arista;
 * - el ensanche lleva cada punto del cuello a su punto de la placa (ver `sampleContour`) con una sola curva
 *   (`flareEase`) para todo el contorno: es monótono (sin bultos) y su alto es el mínimo que respeta MAX_SLOPE.
 * La cabeza puede superar el lado corto de una placa angosta: ahí el ensanche se cierra hacia adentro.
 */
export function buildHandle(K, t, p, plate, quality, ceilZ) {
  if (p.handle === 'none') return null;
  const pb = plate.bounds();
  const pw = pb.max[0] - pb.min[0];
  const ph = pb.max[1] - pb.min[1];
  const cx = (pb.min[0] + pb.max[0]) / 2;
  const cy = (pb.min[1] + pb.max[1]) / 2;
  const elongated = elongatedHandle(p.handle);
  // Un sello angosto también necesita una cabeza que se pueda agarrar: el límite usa el lado mayor.
  const maxWidth = Math.max(pw, ph) * 0.9;
  let w = elongated ? Math.min(p.handleLengthMm, pw * 0.9) : Math.min(p.handleWidthMm, maxWidth);
  let h = elongated ? Math.min(p.handleWidthMm, maxWidth) : w;
  const makeSection = () => (p.handle === 'ergonomic'
    ? ellipse(K, t, w / 2, h / 2, 0, 0, quality)
    : elongated ? roundedRect(K, t, w, h, Math.min(h / 2, 8), 0, 0, quality) : circle(K, t, w / 2, 0, 0, quality));
  // La barra y el bloque se entallan principalmente a lo ancho, sin perder el apoyo longitudinal.
  const xy = (r) => [elongated && p.handle !== 'ergonomic' ? 0.75 + 0.25 * r : r, r];
  const profile = handleProfile(p.handle, 32);
  const plateCcw = ccw(plate.toPolygons().reduce((a, b) => (Math.abs(polyArea(b)) > Math.abs(polyArea(a)) ? b : a)));
  let contour = ccw(makeSection().toPolygons()[0]);
  // La cabeza puede salirse de una placa angosta, el cuello no: el ensanche tendría que volver hacia adentro en
  // pocos mm y quedaría un escalón colgando sobre la placa. Mientras el cuello no entre con 5 % de aire, se angosta
  // el mango en el eje en que se sale (en la barra, casi siempre el ancho; el largo no se toca).
  const plateCast = rayCaster(plateCcw, cx, cy);
  const [nsx, nsy] = xy(profile.at(-1)[1]);
  for (let pass = 0; pass < 6; pass++) {
    let worst = null;
    for (const [x, y] of contour) {
      const [px, py] = plateCast(Math.atan2(y * nsy, x * nsx));
      const fit = Math.hypot(px - cx, py - cy) / (Math.hypot(x * nsx, y * nsy) || 1);
      // qué lado de la placa queda justo: el de arriba/abajo (se angosta el ancho) o el de los extremos (el largo)
      if (!worst || fit < worst.fit) worst = { fit, acrossWidth: Math.abs(py - cy) / (ph / 2) >= Math.abs(px - cx) / (pw / 2) };
    }
    if (worst.fit >= 1 / 0.95) break;
    const k = 0.95 * worst.fit;
    if (p.handle === 'knob' || p.handle === 'mushroom') w = h = w * k;
    else if (worst.acrossWidth) h *= k;
    else w *= k;
    contour = ccw(makeSection().toPolygons()[0]);
  }

  // alto mínimo para que ningún tramo del perfil vuele más de MAX_SLOPE
  let minHeight = 0;
  for (let i = 1; i < profile.length; i++) {
    const [z0, r0] = profile[i - 1];
    const [z1, r1] = profile[i];
    if (r1 <= r0) continue;
    const [ax, ay] = xy(r0);
    const [bx, by] = xy(r1);
    const growth = Math.max(...contour.map(([x, y]) => Math.hypot(x * (bx - ax), y * (by - ay))));
    minHeight = Math.max(minHeight, growth / (z1 - z0) / MAX_SLOPE);
  }
  const height = ceilZ(Math.max(p.handleHeightMm, minHeight));

  const [nx, ny] = xy(profile.at(-1)[1]);
  const neckPoly = contour.map(([x, y]) => [cx + x * nx, cy + y * ny]);
  const perimeter = (poly) => poly.reduce((sum, [x, y], i) => sum + Math.hypot(x - poly[(i + 1) % poly.length][0], y - poly[(i + 1) % poly.length][1]), 0);
  // misma cuenta en el cuello y en la placa: la que pide la placa, sin amontonar puntos en un cuello chico (las
  // caras de centésimas de mm no se imprimen y su normal es puro redondeo)
  const count = Math.max(16, Math.min(120, Math.ceil(perimeter(plateCcw) / 4 / RING_STEP), Math.ceil(perimeter(neckPoly) / 4 / NECK_STEP)));
  // la sección sin escalar, con los puntos que le tocan al cuello; cada anillo del mango es esta sección escalada
  const unit = sampleContour(neckPoly, cx, cy, count).map(([x, y]) => [(x - cx) / nx, (y - cy) / ny]);
  const ringAt = (r) => {
    const [sx, sy] = xy(r);
    return unit.map(([x, y]) => [cx + x * sx, cy + y * sy]);
  };

  // ---- canto redondeado de la cabeza: se mete c·(1 − z/L)² hacia adentro, con la pendiente inicial justa para que,
  // sumada a la del perfil, no pase de MAX_SLOPE
  const ringZs = ringHeights(profile, height, elongated && p.handle !== 'ergonomic' ? Math.max(w / 8, h / 2) : Math.max(w, h) / 2);
  const reach = 0.3 * height;
  const bare = Array.from({ length: 41 }, (_, k) => (reach * k) / 40).map((z) => ({ z, pts: ringAt(radiusAt(profile, z / height)) }));
  let lean = 0;
  for (let i = 1; i < bare.length; i++) lean = Math.max(lean, outwardSlope(bare[i - 1].pts, bare[i].pts, bare[i].z - bare[i - 1].z));
  // margen del 10 %: el canto y el perfil se curvan a la vez
  const room = 0.9 * (MAX_SLOPE - lean);
  let round = room < 0.15 ? 0 : EDGE_ROUND;
  let span = round ? (2 * round) / room : 0;
  if (span > reach) {
    round *= reach / span;
    span = reach;
  }
  const zs = [...ringZs, ...Array.from({ length: 12 }, (_, k) => span * (k / 12) ** 1.5)]
    .sort((a, b) => a - b)
    .filter((z, i, all) => i === 0 || z - all[i - 1] > 0.05);
  const handleRings = zs.map((z) => {
    const pts = ringAt(radiusAt(profile, z / height));
    if (z >= span) return { z, pts };
    const inset = round * (1 - z / span) ** 2;
    const n = normals(pts);
    return { z, pts: pts.map(([x, y], i) => [x - n[i][0] * inset, y - n[i][1] * inset]) };
  });

  // ---- ensanche: alto mínimo para que ninguna cara pase de MAX_SLOPE
  const neckRing = handleRings.at(-1).pts;
  // 0.1 mm hacia adentro del borde de la placa: el ensanche no toca su arista
  const plateRing = sampleContour(plateCcw, cx, cy, count);
  const plateNormals = normals(plateRing);
  const topRing = plateRing.map(([x, y], i) => [x - plateNormals[i][0] * 0.1, y - plateNormals[i][1] * 0.1]);
  const flareRing = (s) => {
    const e = flareEase(s);
    return neckRing.map(([x, y], i) => [x + (topRing[i][0] - x) * e, y + (topRing[i][1] - y) * e]);
  };
  let worst = 0;
  for (let k = 1; k <= 64; k++) {
    const s = k / 64;
    const rate = flareRate(s);
    const n = normals(flareRing(s));
    neckRing.forEach(([x, y], i) => {
      worst = Math.max(worst, rate * ((topRing[i][0] - x) * n[i][0] + (topRing[i][1] - y) * n[i][1]));
    });
  }
  const transitionHeight = worst / MAX_SLOPE + 0.05;

  /**
   * El sólido completo con la placa empezando en z1. El ensanche termina 0.03 mm dentro de la placa: su borde cruza
   * la cara de abajo de la placa en vez de apoyarse sobre ella (un anillo justo en ese plano deja aristas de
   * micras en la unión).
   */
  const solid = (z1) => {
    const rise = z1 + 0.03 - height;
    // el redondeo junto al cuello lleva anillos cada pocos grados de giro; el tramo recto, cada RING_STEP (si se
    // espacian más, los cuadriláteros alabeados de las esquinas marcan pliegues en diagonal)
    const straight = Math.max(2, Math.min(40, Math.ceil((rise * (1 - FLARE_KNEE)) / RING_STEP)));
    const steps = [...Array.from({ length: 10 }, (_, k) => (FLARE_KNEE * (k + 1)) / 10), ...Array.from({ length: straight }, (_, k) => FLARE_KNEE + ((1 - FLARE_KNEE) * (k + 1)) / straight)];
    const rings = [...handleRings];
    for (const s of steps) rings.push({ z: height + rise * s, pts: flareRing(s) });
    rings.push({ z: z1 + 0.06, pts: topRing });
    return ringSolid(K, t, rings, cx, cy);
  };

  return {
    solid,
    height,
    transitionHeight,
    heightAdjusted: height > p.handleHeightMm + 0.65,
    sizeAdjusted: (elongated && w < p.handleLengthMm - 0.1) || h < p.handleWidthMm - 0.1,
    width: h,
    length: w,
  };
}
