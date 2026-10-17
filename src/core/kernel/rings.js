// Sólidos "por anillos": una pila de contornos horizontales con la MISMA cantidad de vértices,
// cosidos entre sí. Sirve para piezas de revolución con relieve (pantallas de lámpara, roscas):
// es mucho más rápido que hacerlas con booleanas y la malla sale cerrada por construcción.
//
// Cada anillo es un Float64Array [x0, y0, x1, y1, …] en sentido antihorario visto desde arriba,
// con el vértice j en el ángulo 2πj/S (contornos "estrellados" respecto del eje Z).

/**
 * Tubo de pared: anillos exteriores e interiores a las mismas alturas; tapas en anillo abajo y arriba.
 * @param {any} K  módulo manifold-3d
 * @param {number[]} zs  alturas crecientes
 * @param {Float64Array[]} outer
 * @param {Float64Array[]} inner
 */
export function tubeFromRings(K, zs, outer, inner) {
  const n = zs.length;
  const S = outer[0].length / 2;
  const pos = new Float32Array(n * S * 2 * 3);
  const put = (ring, i, base) => {
    for (let j = 0; j < S; j++) {
      const o = (base + j) * 3;
      pos[o] = ring[j * 2];
      pos[o + 1] = ring[j * 2 + 1];
      pos[o + 2] = zs[i];
    }
  };
  for (let i = 0; i < n; i++) {
    put(outer[i], i, i * S);
    put(inner[i], i, (n + i) * S);
  }
  const O = (i, j) => i * S + (j % S);
  const I = (i, j) => (n + i) * S + (j % S);
  const tri = new Uint32Array(((n - 1) * S * 4 + S * 4) * 3);
  let k = 0;
  const add = (a, b, c) => {
    tri[k++] = a;
    tri[k++] = b;
    tri[k++] = c;
  };
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < S; j++) {
      add(O(i, j), O(i, j + 1), O(i + 1, j + 1));
      add(O(i, j), O(i + 1, j + 1), O(i + 1, j));
      add(I(i, j), I(i + 1, j + 1), I(i, j + 1));
      add(I(i, j), I(i + 1, j), I(i + 1, j + 1));
    }
  }
  const top = n - 1;
  for (let j = 0; j < S; j++) {
    add(O(0, j), I(0, j), O(0, j + 1));
    add(O(0, j + 1), I(0, j), I(0, j + 1));
    add(O(top, j), O(top, j + 1), I(top, j));
    add(O(top, j + 1), I(top, j + 1), I(top, j));
  }
  return new K.Manifold(new K.Mesh({ numProp: 3, vertProperties: pos, triVerts: tri }));
}

/**
 * Sólido macizo: anillos exteriores con tapas planas (abanico desde el eje) abajo y arriba.
 * @param {any} K
 * @param {number[]} zs
 * @param {Float64Array[]} outer
 */
export function solidFromRings(K, zs, outer) {
  const n = zs.length;
  const S = outer[0].length / 2;
  const pos = new Float32Array((n * S + 2) * 3);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < S; j++) {
      const o = (i * S + j) * 3;
      pos[o] = outer[i][j * 2];
      pos[o + 1] = outer[i][j * 2 + 1];
      pos[o + 2] = zs[i];
    }
  }
  const cb = n * S;
  const ct = cb + 1;
  pos[cb * 3 + 2] = zs[0];
  pos[ct * 3 + 2] = zs[n - 1];
  const O = (i, j) => i * S + (j % S);
  const tri = new Uint32Array(((n - 1) * S * 2 + S * 2) * 3);
  let k = 0;
  const add = (a, b, c) => {
    tri[k++] = a;
    tri[k++] = b;
    tri[k++] = c;
  };
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < S; j++) {
      add(O(i, j), O(i, j + 1), O(i + 1, j + 1));
      add(O(i, j), O(i + 1, j + 1), O(i + 1, j));
    }
  }
  for (let j = 0; j < S; j++) {
    add(cb, O(0, j + 1), O(0, j));
    add(ct, O(n - 1, j), O(n - 1, j + 1));
  }
  return new K.Manifold(new K.Mesh({ numProp: 3, vertProperties: pos, triVerts: tri }));
}

/** Anillo con radio r(θ) en S ángulos uniformes. */
export function polarRing(S, radiusAt) {
  const ring = new Float64Array(S * 2);
  for (let j = 0; j < S; j++) {
    const a = (2 * Math.PI * j) / S;
    const r = radiusAt(a, j);
    ring[j * 2] = r * Math.cos(a);
    ring[j * 2 + 1] = r * Math.sin(a);
  }
  return ring;
}

/** Radios de un anillo (distancia de cada vértice al eje). */
export function ringRadii(ring) {
  const S = ring.length / 2;
  const out = new Float64Array(S);
  for (let j = 0; j < S; j++) out[j] = Math.hypot(ring[j * 2], ring[j * 2 + 1]);
  return out;
}

/** Interpola dos anillos vértice a vértice (mismos ángulos). */
export function lerpRing(a, b, u) {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * u;
  return out;
}

/**
 * Desplaza un anillo hacia adentro `dist` mm en horizontal (como lo ve el slicer: grosor de pared
 * real en XY, no radial) y lo vuelve a muestrear en los mismos S ángulos. El offset lo hace Clipper
 * (vía manifold), así que no se cruza aunque el relieve tenga crestas finas.
 * @returns {Float64Array|null}  null si el anillo desaparece al achicarlo
 */
export function insetRing(K, ring, dist) {
  const S = ring.length / 2;
  const pts = [];
  for (let j = 0; j < S; j++) pts.push([ring[j * 2], ring[j * 2 + 1]]);
  const cs = new K.CrossSection([pts], 'Positive');
  const off = cs.offset(-dist, 'Round', 2, 16);
  const polys = off.toPolygons();
  cs.delete();
  off.delete();
  if (!polys.length) return null;
  // el contorno más grande (con un relieve muy profundo pueden quedar islas sueltas)
  let best = polys[0];
  let bestA = -Infinity;
  for (const p of polys) {
    let a = 0;
    for (let i = 0; i < p.length; i++) {
      const q = p[(i + 1) % p.length];
      a += p[i][0] * q[1] - q[0] * p[i][1];
    }
    if (a > bestA) {
      bestA = a;
      best = p;
    }
  }
  return resampleRadial(best, S);
}

/** Corta el contorno con S rayos desde el eje y se queda con el corte más alejado de cada rayo. */
function resampleRadial(poly, S) {
  const step = (2 * Math.PI) / S;
  const r = new Float64Array(S).fill(-1);
  const m = poly.length;
  for (let i = 0; i < m; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % m];
    let a0 = Math.atan2(p[1], p[0]);
    let a1 = Math.atan2(q[1], q[0]);
    let lo = Math.min(a0, a1);
    let hi = Math.max(a0, a1);
    // el lado cruza el corte de ±π: se recorre por el camino corto
    const wrap = hi - lo > Math.PI;
    if (wrap) [lo, hi] = [hi, lo + 2 * Math.PI];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-9; k++) {
      const a = k * step;
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      const den = cx * dy - cy * dx;
      if (Math.abs(den) < 1e-12) continue;
      const d = (p[0] * dy - p[1] * dx) / den;
      const j = ((k % S) + S) % S;
      if (d > r[j]) r[j] = d;
    }
  }
  // rayos sin corte (no debería pasar): se completan con el vecino
  for (let j = 0; j < S; j++) if (r[j] < 0) r[j] = r[(j + S - 1) % S] > 0 ? r[(j + S - 1) % S] : 0;
  const out = new Float64Array(S * 2);
  for (let j = 0; j < S; j++) {
    out[j * 2] = r[j] * Math.cos(j * step);
    out[j * 2 + 1] = r[j] * Math.sin(j * step);
  }
  return out;
}
