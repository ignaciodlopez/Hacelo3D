// Generación del organizador de escritorio. FUNCIÓN PURA: params → BuildResult (sin DOM ni three.js).
//
// Una sola pieza, parada y sin soportes, de un solo color (ver layout.js):
//   - base: una chapa plana de esquinas redondeadas, común a los dos módulos
//   - lapicero: una taza alta de esquinas redondeadas con el borde de arriba suave, y divisiones opcionales
//   - soporte de celular: una placa inclinada hacia atrás con un labio adelante y un respaldo vertical atrás; entre la
//     placa y el respaldo queda un túnel que aligera la pieza y termina en punta (sin puentes)
// Todas las cavidades se abren hacia arriba. El frente es la cara de -Y; el centro de la base está en el origen (en
// planta) y apoya en z = 0.

import { createScope } from '../../core/kernel/manifold.js';
import { roundedRect, segmentsFor } from '../../core/kernel/shapes2d.js';
import { manifoldToMesh, mergeParts } from '../../core/kernel/mesh.js';
import { analyzeParts, fitsBed, round } from '../../core/kernel/analysis.js';
import { normalizePrinter, snapZ } from '../../core/printer/profiles.js';
import { normalizeParams, qualityOf } from './params.js';
import { layoutDesk, OVERLAP } from './layout.js';

const PART_LABEL = { base: 'Pieza' };
/** Chaflán de entrada de la taza (mm). */
const CHAMFER = 0.6;
/** Lo que queda como mínimo de plano arriba de una pared entre el canto redondeado y el chaflán (mm). */
const MIN_RIM = 0.9;

/** Los puntos en sentido antihorario (el área con signo es positiva). */
function ccw(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    a += x0 * y1 - x1 * y0;
  }
  return a < 0 ? [...points].reverse() : points;
}

/**
 * @param {any} K  módulo manifold-3d ya inicializado
 * @param {any} rawParams
 * @param {{ printer?:any, preview?:boolean }} ctx
 */
export async function build(K, rawParams, ctx) {
  const p0 = normalizeParams(rawParams);
  const printer = normalizePrinter(ctx.printer);
  const zf = (z) => (p0.snapToLayers ? snapZ(z, printer) : z);
  // alturas alineadas a la capa: la base, el alto de cada módulo y el tope del labio
  const B = zf(p0.baseMm);
  const p = { ...p0, baseMm: B, cupHeightMm: zf(p0.cupHeightMm), phoneHeightMm: zf(p0.phoneHeightMm), phoneLipMm: zf(B + p0.phoneLipMm) - B };

  const messages = [];
  const lay = layoutDesk(p);
  messages.push(...lay.messages);
  if (!lay.ok) return fail(messages);

  const sc = createScope();
  const t = sc.track;
  try {
    const { seg } = qualityOf(p.curveQuality);
    const wall = p.wallMm;
    const { width: W, depth: D } = lay;
    const rOut = Math.max(0.01, Math.min(p.cornerRadiusMm, W / 2 - 0.5, D / 2 - 0.5));

    /** Caja entre dos esquinas. */
    const box = (x0, x1, y0, y1, z0, z1) => t(t(K.Manifold.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    /** Perfil en el plano YZ (puntos [y, z]) extruido a lo largo de X, de x0 a x1. */
    const alongX = (points, x0, x1) => t(t(t(t(new K.CrossSection([ccw(points)], 'NonZero')).extrude(x1 - x0)).rotate([90, 0, 90])).translate([x0, 0, 0]));

    // Bloques con esquinas verticales redondeadas y el canto de arriba redondeado: el casco convexo de cuatro "pucks"
    // (cilindros con el borde de arriba redondeado). Abajo quedan planos y verticales: se imprimen sin soportes.
    const rEdge = Math.min(p.edgeRadiusMm, Math.max(0, wall - CHAMFER - MIN_RIM));
    const pucks = new Map();
    const puck = (r, h) => {
      const key = `${r.toFixed(3)}|${h.toFixed(3)}`;
      if (!pucks.has(key)) {
        const f = Math.min(rEdge, r, h / 2);
        const pts = [[0, 0], [r, 0]];
        if (f > 0.05) {
          const n = Math.max(4, Math.round(6 * seg) + 2);
          for (let i = 0; i <= n; i++) {
            const a = (i / n) * (Math.PI / 2);
            pts.push([r - f + f * Math.cos(a), h - f + f * Math.sin(a)]);
          }
        } else pts.push([r, h]);
        pts.push([0, h]);
        pucks.set(key, t(K.Manifold.revolve(t(new K.CrossSection([pts], 'NonZero')), segmentsFor(r, seg))));
      }
      return pucks.get(key);
    };
    /** Bloque entre dos esquinas, de altura `h`. */
    const soft = (x0, x1, y0, y1, h) => {
      const r = Math.max(0.01, Math.min(rOut, (x1 - x0) / 2, (y1 - y0) / 2));
      const at = (x, y) => t(puck(r, h).translate([x, y, 0]));
      return t(K.Manifold.hull([at(x0 + r, y0 + r), at(x1 - r, y0 + r), at(x1 - r, y1 - r), at(x0 + r, y1 - r)]));
    };

    const adds = [soft(-W / 2, W / 2, -D / 2, D / 2, B)];

    // ---- lapicero: la taza, hueca hasta la base
    if (lay.cup) {
      const c = lay.cup;
      const cw = c.x1 - c.x0;
      const cx = (c.x0 + c.x1) / 2;
      const rc = Math.max(0.01, Math.min(rOut, cw / 2, D / 2));
      const iw = cw - 2 * wall;
      const id = D - 2 * wall;
      const ri = Math.max(0.5, Math.min(rc - wall, iw / 2, id / 2));
      // esquinas de adentro concéntricas con las de afuera (pared pareja) y chaflán de entrada a 45°
      const shape = roundedRect(K, t, iw, id, ri, 0, 0, seg);
      const cavity = t(t(shape.extrude(c.height - B + 1)).translate([cx, 0, B]));
      const cone = t(t(shape.extrude(CHAMFER + 0.01, 0, 0, [(iw / 2 + CHAMFER) / (iw / 2), (id / 2 + CHAMFER) / (id / 2)])).translate([cx, 0, c.height - CHAMFER]));
      let cup = t(soft(c.x0, c.x1, c.y0, c.y1, c.height).subtract(t(K.Manifold.union([cavity, cone]))));
      if (c.dividers > 0) {
        // divisiones a lo ancho, de la altura de la taza; se meten un poco en las paredes para que la unión sea volumétrica
        const n = c.dividers;
        const slot = (iw - n * wall) / (n + 1);
        const walls = Array.from({ length: n }, (_, i) => {
          const x0 = cx - iw / 2 + (i + 1) * slot + i * wall;
          return box(x0, x0 + wall, -id / 2 - 0.5, id / 2 + 0.5, B - 0.5, c.height);
        });
        cup = t(K.Manifold.union([cup, ...walls]));
      }
      adds.push(cup);
    }

    // ---- soporte de celular: placa inclinada con su cuña, túnel y labio
    if (lay.stand) {
      const s = lay.stand;
      const along = (pts, x0, x1) => alongX(pts.map(([y, z]) => [y + s.shiftY, z]), x0, x1);
      // del lado del lapicero el soporte se mete en su pared; el otro extremo queda a ras de la base
      const cupLeft = !!lay.cup && lay.cup.x1 <= s.x0 + 1e-6;
      const cupRight = !!lay.cup && lay.cup.x0 >= s.x1 - 1e-6;
      const x0 = cupLeft ? s.x0 - OVERLAP : s.x0;
      const x1 = cupRight ? s.x1 + OVERLAP : s.x1;
      let body = along(s.outer, x0, x1);
      // el túnel sale por el extremo libre; del lado del lapicero lo cierra la pared de la taza
      if (s.cavity) body = t(body.subtract(along(s.cavity, cupLeft ? x0 : s.x0 - 1, cupRight ? x1 : s.x1 + 1)));
      adds.push(body, along(s.lip, x0, x1));
    }

    const base = t(K.Manifold.union(adds));
    const item = makeItem({ K, t, p, printer, preview: !!ctx.preview }, 'escritorio', [['base', base]]);
    const [sx, sy] = item.sizeMm;
    if (!fitsBed(sx, sy, printer.bed)) messages.push({ level: 'warn', code: 'size.bedOverflow', params: { w: round(sx, 1), h: round(sy, 1) } });
    return {
      items: [item],
      plates: null,
      bed: null,
      messages,
      info: { colorChanges: item.analysis.colorChanges, gramsByColor: item.analysis.gramsByColor, needsMMU: item.analysis.needsMMU, triangles: item.triangles, sizeMm: [W, D, lay.height] },
    };
  } finally {
    sc.dispose();
  }
}

function fail(messages) {
  return { items: [], messages, info: { colorChanges: null, gramsByColor: {}, needsMMU: false, triangles: 0 } };
}

/** Una pieza con sus partes de color: `[colorKey, manifold|null]`. */
function makeItem(env, name, list) {
  const { K, t, p } = env;
  const groups = list.filter(([, m]) => m && !m.isEmpty());
  const parts = groups.map(([colorKey, m]) => {
    const bb = m.boundingBox();
    return {
      id: colorKey,
      label: PART_LABEL[colorKey],
      colorKey,
      color: p.colors[colorKey],
      ...manifoldToMesh(m),
      volumeMm3: m.volume(),
      zMin: bb.min[2],
      zMax: bb.max[2],
      status: m.status(),
      genus: m.genus(),
    };
  });
  const { merged, box: mb, triangles } = mergeParts(K, t, groups.map(([, m]) => m), env.preview);
  return {
    name,
    parts,
    merged,
    sizeMm: [mb.max[0] - mb.min[0], mb.max[1] - mb.min[1], mb.max[2] - mb.min[2]],
    offsetXY: [0, 0],
    bboxXY: [mb.min[0], mb.min[1], mb.max[0], mb.max[1]],
    triangles,
    analysis: analyzeParts(parts, env.printer),
  };
}
