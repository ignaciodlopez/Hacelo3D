// Generación del mate. FUNCIÓN PURA: params → BuildResult (sin DOM ni three.js).
//
// Una sola pieza: el cuerpo del mate con un hueco que es el negativo del interior de aluminio (ver mate.js).
// Se imprime parado, con la boca hacia arriba y sin soportes mientras la silueta no se abra demasiado.

import { createScope } from '../../core/kernel/manifold.js';
import { manifoldToMesh } from '../../core/kernel/mesh.js';
import { analyzeParts, fitsBed, round, scanOverhangs } from '../../core/kernel/analysis.js';
import { normalizePrinter } from '../../core/printer/profiles.js';
import { normalizeParams, meshDensity } from './params.js';
import { buildMate } from './mate.js';

/** Componente Z de la normal por debajo de la cual una cara cuenta como voladizo (~48° desde la vertical). */
const OVERHANG_NZ = -0.75;
/** El canto redondeado de abajo apoya casi plano: no cuenta como voladizo. */
const BED_SKIP = 1.3;

/**
 * @param {any} K  módulo manifold-3d ya inicializado
 * @param {any} rawParams
 * @param {{ printer?: any }} ctx
 */
export async function build(K, rawParams, ctx = {}) {
  const p = normalizeParams(rawParams);
  const printer = normalizePrinter(ctx.printer);
  const density = meshDensity(p.curveQuality);
  const messages = [];
  const sc = createScope();
  try {
    const mate = buildMate(K, p, density);
    const solid = sc.track(mate.solid);
    const bb = solid.boundingBox();
    const mesh = manifoldToMesh(solid);
    const merged = manifoldToMesh(solid); // buffers propios: el worker transfiere cada ArrayBuffer una sola vez
    const volumeMm3 = solid.volume();
    const part = {
      id: 'body',
      label: 'Mate',
      colorKey: 'body',
      color: p.colors.body,
      ...mesh,
      volumeMm3,
      zMin: bb.min[2],
      zMax: bb.max[2],
      status: solid.status(),
      genus: solid.genus(),
    };
    const sizeMm = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
    const item = {
      key: 'mate',
      name: 'mate',
      parts: [part],
      merged: { ...merged, status: part.status, genus: part.genus, volumeMm3 },
      sizeMm,
      offsetXY: [0, 0],
      bboxXY: [bb.min[0], bb.min[1], bb.max[0], bb.max[1]],
      triangles: mesh.indices.length / 3,
      analysis: analyzeParts([part], printer),
    };

    // ---- avisos
    if (mate.heightRaised) messages.push({ level: 'warn', code: 'mate.heightRaised', params: { mm: round(mate.heightMm, 1), floor: round(mate.zFloor, 1) } });
    if (mate.reshaped) messages.push({ level: 'info', code: 'mate.reshaped', params: { wall: p.wallMm } });
    if (mate.supported) messages.push({ level: 'info', code: 'mate.selfSupport', params: { deg: p.overhangDeg } });
    const { fraction, worstDeg } = scanOverhangs(item.merged.positions, item.merged.indices, BED_SKIP, OVERHANG_NZ);
    if (fraction > 0.003) messages.push({ level: 'warn', code: 'mate.overhang', params: { deg: worstDeg } });
    if (p.wallMm < printer.nozzleMm * 3 - 1e-6) messages.push({ level: 'warn', code: 'mate.thinWall', params: { mm: round(printer.nozzleMm * 3, 2) } });
    if (!fitsBed(sizeMm[0], sizeMm[1], printer.bed)) messages.push({ level: 'warn', code: 'size.bedOverflow', params: { w: round(sizeMm[0], 1), h: round(sizeMm[1], 1) } });
    messages.push({ level: 'info', code: 'mate.measure' });
    messages.push({ level: 'info', code: 'mate.use' });

    return {
      items: [item],
      plates: null,
      bed: null,
      messages,
      info: {
        colorChanges: null,
        gramsByColor: { body: (volumeMm3 / 1000) * printer.densityGcm3 },
        needsMMU: false,
        triangles: item.triangles,
        floorMm: mate.zFloor,
      },
    };
  } finally {
    sc.dispose();
  }
}
