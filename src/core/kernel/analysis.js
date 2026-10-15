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
