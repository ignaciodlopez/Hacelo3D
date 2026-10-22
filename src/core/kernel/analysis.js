// Información para imprimir: gramos por color, cambios de color con pausa,
// chequeos de tamaño contra la cama.

const EPS = 1e-4;

/**
 * @param {{ colorKey:string, label:string, zMin:number, zMax:number, volumeMm3:number }[]} parts
 * @param {{ layerHeightMm:number, firstLayerMm:number, densityGcm3:number }} printer
 */
export function analyzeParts(parts, printer) {
  const gramsByColor = {};
  for (const p of parts) {
    gramsByColor[p.colorKey] = (gramsByColor[p.colorKey] ?? 0) + (p.volumeMm3 / 1000) * printer.densityGcm3;
  }
  const sorted = [...parts].sort((a, b) => a.zMin - b.zMin || a.zMax - b.zMax);
  let sequential = true;
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      // dos colores distintos que comparten altura necesitan multimaterial
      if (sorted[j].zMin < sorted[i].zMax - EPS) sequential = false;
    }
  }
  /** @type {{zMm:number, layer:number, toColorKey:string}[] | null} */
  let colorChanges = null;
  if (sequential) {
    colorChanges = sorted.slice(1).map((p) => ({
      zMm: round(p.zMin, 3),
      layer: Math.round((p.zMin - printer.firstLayerMm) / printer.layerHeightMm) + 2,
      toColorKey: p.colorKey,
    }));
  }
  return { gramsByColor, colorChanges, needsMMU: parts.length > 1 && !sequential };
}

export function round(n, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** ¿Entra una pieza de (w × h) en la cama? Permite girarla 90°. */
export function fitsBed(w, h, bed) {
  return (w <= bed[0] && h <= bed[1]) || (w <= bed[1] && h <= bed[0]);
}

/**
 * Recorre las caras de una malla y mide cuánta superficie vuela más de lo que el slicer perdona.
 * @param {Float32Array} P  posiciones (x, y, z por vértice)
 * @param {Uint32Array} I  índices de triángulos
 * @param {number} zSkip  se ignoran las caras que no pasan de esta altura (cara de apoyo, cuello, etc.)
 * @param {number} limitNz  componente Z de la normal por debajo de la cual una cara cuenta (p. ej. -0,75 ≈ 48° desde la vertical)
 * @returns {{ fraction:number, worstDeg:number }}  fracción del área que vuela y el peor ángulo medido desde la vertical
 */
export function scanOverhangs(P, I, zSkip, limitNz) {
  let total = 0;
  let bad = 0;
  let worst = 0;
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k] * 3;
    const b = I[k + 1] * 3;
    const c = I[k + 2] * 3;
    if (Math.max(P[a + 2], P[b + 2], P[c + 2]) <= zSkip) continue;
    const ux = P[b] - P[a];
    const uy = P[b + 1] - P[a + 1];
    const uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a];
    const vy = P[c + 1] - P[a + 1];
    const vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue;
    total += len;
    const cz = nz / len;
    if (cz < limitNz) {
      bad += len;
      worst = Math.max(worst, Math.asin(Math.min(1, -cz)));
    }
  }
  return { fraction: total > 0 ? bad / total : 0, worstDeg: Math.round((worst * 180) / Math.PI) };
}
