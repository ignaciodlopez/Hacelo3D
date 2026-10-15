// Íconos del catálogo: lista (icons.json) y conversión SVG → polígonos.
// SVGLoader usa DOMParser, que no existe en workers: se convierte acá (hilo principal)
// y los polígonos viajan al worker junto con el pedido de generación.

import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

const BASE = import.meta.env.BASE_URL;
const cache = new Map();
let catalogPromise = null;

export function loadIconCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(`${BASE}icons/icons.json`)
      .then((r) => r.json())
      .catch(() => []);
  }
  return catalogPromise;
}

export const iconUrl = (entry) => `${BASE}icons/${entry.file}`;

function toPolygon(points) {
  const poly = points.map((p) => [p.x, -p.y]); // el SVG tiene Y hacia abajo
  const a = poly[0];
  const b = poly[poly.length - 1];
  if (poly.length > 3 && a[0] === b[0] && a[1] === b[1]) poly.pop();
  return poly;
}

/** @returns {Promise<number[][][] | null>} contornos [x,y] del ícono (sin normalizar) */
export async function loadIconPolygons(id) {
  if (cache.has(id)) return cache.get(id);
  const entry = (await loadIconCatalog()).find((i) => i.id === id);
  if (!entry) return null;
  try {
    const text = await (await fetch(iconUrl(entry))).text();
    const data = new SVGLoader().parse(text);
    const polys = [];
    for (const path of data.paths) {
      for (const shape of SVGLoader.createShapes(path)) {
        const { shape: outer, holes } = shape.extractPoints(10);
        if (outer.length >= 3) polys.push(toPolygon(outer));
        for (const hole of holes) if (hole.length >= 3) polys.push(toPolygon(hole));
      }
    }
    cache.set(id, polys);
    return polys;
  } catch {
    return null;
  }
}
