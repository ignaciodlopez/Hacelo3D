// Huecos para imanes en la cara de atrás de una pieza (heladera, pizarra, etc.).
// Compartido por las herramientas: calcula las posiciones y la forma 2D de los huecos; cada
// herramienta los resta de su base (hueco ciego, abierto hacia la cama).

import { circle } from './shapes2d.js';

/** Pared mínima entre un hueco y el borde de la pieza, y entre huecos (mm). */
const WALL = 1.2;

/** Posiciones (fracción del ancho/alto desde el centro) según la cantidad. */
const LAYOUT = { 1: [[0, 0]], 2: [[-0.25, 0], [0.25, 0]], 4: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]] };

/**
 * @param {any} K  módulo manifold-3d
 * @param {(o:any)=>any} t  tracker de memoria
 * @param {{ count: number, diameterMm: number, clearanceMm: number, box: { cx:number, cy:number, w:number, h:number }, quality?: number }} o
 *   `box` es el rectángulo de la pieza donde pueden ir los huecos.
 * @returns {{ cs: any|null, placed: number, skipped: number, radius: number }}
 *   `radius` es el radio del hueco (imán + holgura). Los que no entran con pared suficiente se omiten.
 */
export function magnetPockets(K, t, o) {
  const count = [1, 2, 4].includes(o.count) ? o.count : 0;
  const radius = (o.diameterMm + o.clearanceMm) / 2;
  if (!count) return { cs: null, placed: 0, skipped: 0, radius };
  const { cx, cy, w, h } = o.box;
  const centers = LAYOUT[count].map(([fx, fy]) => [cx + fx * w, cy + fy * h]);
  const fits = centers.filter(([x, y], i) => {
    const inside = Math.abs(x - cx) + radius + WALL <= w / 2 && Math.abs(y - cy) + radius + WALL <= h / 2;
    const apart = centers.every(([x2, y2], j) => j === i || Math.hypot(x - x2, y - y2) >= 2 * radius + WALL);
    return inside && apart;
  });
  if (!fits.length) return { cs: null, placed: 0, skipped: count, radius };
  const cs = t(K.CrossSection.union(fits.map(([x, y]) => circle(K, t, radius, x, y, o.quality ?? 1))));
  return { cs, placed: fits.length, skipped: count - fits.length, radius };
}

/** Profundidad del hueco (mm): grosor del imán + holgura. */
export const magnetDepth = (thicknessMm, clearanceMm) => thicknessMm + clearanceMm;
