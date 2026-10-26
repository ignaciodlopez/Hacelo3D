// Catálogos de dibujos SVG (íconos y logos de marcas): lista (<carpeta>/<carpeta>.json) y conversión SVG → polígonos.
// SVGLoader usa DOMParser, que no existe en workers: se convierte acá (hilo principal)
// y los polígonos viajan al worker junto con el pedido de generación.

import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

const BASE = import.meta.env.BASE_URL;

function toPolygon(points) {
  const poly = points.map((p) => [p.x, -p.y]); // el SVG tiene Y hacia abajo
  const a = poly[0];
  const b = poly[poly.length - 1];
  if (poly.length > 3 && a[0] === b[0] && a[1] === b[1]) poly.pop();
  return poly;
}

/** Catálogo de `public/<dir>/<dir>.json`: entradas `{ id, name, tags, file }`. */
function svgCatalog(dir) {
  const cache = new Map();
  let catalogPromise = null;
  const load = () => {
    if (!catalogPromise) {
      catalogPromise = fetch(`${BASE}${dir}/${dir}.json`)
        .then((r) => r.json())
        .catch(() => []);
    }
    return catalogPromise;
  };
  const url = (entry) => `${BASE}${dir}/${entry.file}`;
  /** @returns {Promise<number[][][] | null>} contornos [x,y] del dibujo (sin normalizar) */
  async function polygons(id) {
    if (cache.has(id)) return cache.get(id);
    const entry = (await load()).find((i) => i.id === id);
    if (!entry) return null;
    try {
      const text = await (await fetch(url(entry))).text();
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
  return { load, url, polygons };
}

const icons = svgCatalog('icons');
export const loadIconCatalog = icons.load;
export const iconUrl = icons.url;
export const loadIconPolygons = icons.polygons;

/** Logos de marcas (organizadores de taller): public/logos/, ver src/tools/organizer/brands.js. */
const logos = svgCatalog('logos');
export const loadLogoCatalog = logos.load;
export const logoUrl = logos.url;
export const loadLogoPolygons = logos.polygons;
