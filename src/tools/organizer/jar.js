// Frasco redondo con tapa roscada, SIN piezas de metal. Medidas tomadas de un frasco Ø80 × 40 mm:
//   - cuerpo: copa con el agarre de afuera moleteado en rombos (dos familias de ranuras en V que se cruzan a 45°, o una
//     sola ranura helicoidal, o lisa), hombro a 45° hacia un cuello
//     más angosto (Ø de afuera − 7 mm) con un cordón redondo helicoidal (paso 3,75) donde enrosca la tapa;
//   - tapa: del mismo diámetro y con el mismo moleteado, con el cordón correspondiente hacia adentro, corrido medio paso: los cordones de la tapa
//     caen en los huecos del cuello y los del cuello en los de la tapa (juego de 0,2 mm); con la tapa cerrada el borde apoya
//     en el escalón del cuerpo y el frasco mide la altura pedida.
//
// Todo es una pila de anillos (ver `revolveFromPath`): rosca y ranuras son un relieve radial r(ángulo, z) sobre un perfil,
// así que salen sin booleanas y la malla es cerrada por construcción. Se imprimen sin soportes: el cuerpo parado y la tapa
// DADA VUELTA (el techo contra la cama), con el logo embutido en esa cara.
//
// Todo se arma en las coordenadas del frasco CERRADO (eje en Z, base del cuerpo en z = 0); la tapa se construye ya dada
// vuelta (z = 0 en su techo) y `lidView` la devuelve a su lugar para el visor.

import { revolveFromPath } from '../../core/kernel/rings.js';
import { BEVEL, BEVEL_Z, FLOOR_CHAMFER, smooth, helix, bump, knurlOf, gripOf, line, arc, meshDensity, logosOf } from './screw.js';

/** Cordón de la rosca de la tapa: paso, ancho del cordón del cuello y cuánto sobresale (mm). */
const PITCH = 3.75;
const BEAD_HALF = 0.875;
const BEAD_H = 0.8;
/** Zona roscada del cuello: distancia desde el escalón hasta el primer cordón y hasta el borde de arriba (mm). */
const BEAD_FROM = 2;
const BEAD_TO = 1.9;
/** Pared del cuello (mm), y cuánto más angosto que el cuerpo es el agujero de la boca. */
const NECK_WALL = 2.5;
const NECK_INSET = 3.5;
/** Distancia de la boca de la tapa y del cuello hasta donde se desvanece el relieve (mm). */
const FADE = PITCH / 4;
/** Entre el techo de la tapa y el borde del cuello al cerrar (mm). */
const NECK_GAP = 0.1;

/**
 * Medidas del frasco a partir de los parámetros (con las alturas ya llevadas a la capa).
 * Devuelve null si no entra el hombro.
 */
export function jarDims(p, zf = (z) => z) {
  const R = p.jarDiameterMm / 2;
  const floor = zf(p.jarFloorMm);
  const capH = zf(p.jarCapHeightMm);
  const ledge = zf(p.jarHeightMm - capH);
  const neckLen = capH - floor - NECK_GAP;
  const cavR = R - p.jarWallMm;
  const boreR = R - NECK_WALL - NECK_INSET;
  const neckR = R - NECK_INSET;
  const shoulder = cavR - boreR;
  // el hombro baja a 45° desde el agujero de la boca hasta la pared: 0,6 mm de pared recta bajo el escalón
  const coneTop = ledge - 0.6;
  const coneBottom = coneTop - shoulder;
  const lidBoreR = neckR + BEAD_H + p.jarFitMm;
  return {
    R, floor, capH, ledge, neckLen, cavR, boreR, neckR, shoulder, coneTop, coneBottom, lidBoreR,
    ...knurlOf(p, R),
    top: ledge + neckLen,
    gripDepth: p.jarGrip === 'none' ? 0 : Math.max(0, Math.min(p.jarGripDepthMm, p.jarWallMm - 1.2)),
    // cabe: cavidad de al menos 6 mm sobre el piso y cuello con lugar para un par de vueltas de cordón
    ok: coneBottom - floor >= 6 && neckLen >= BEAD_FROM + BEAD_TO + 1.5,
  };
}

/**
 * Cuerpo del frasco, parado sobre la cama.
 * @param {{ jarFitMm:number, jarWallMm:number }} p
 */
function bodyPath(p, d, rowStep, grip) {
  // zona del agarre, de abajo hacia arriba: entre el canto redondeado y el escalón
  const [from, to] = [BEVEL_Z + 0.3, d.ledge - 0.3];
  const gripAt = (angle, z) => grip.relief(angle, z, from, to);
  // cordón del cuello: hélice derecha, centros en BEAD_FROM + paso·ángulo/2π
  const bead = (angle, z) => {
    const { s, zc } = helix(angle, z - d.ledge, BEAD_FROM, PITCH);
    const amp = smooth((zc - BEAD_FROM) / FADE) * smooth((d.neckLen - BEAD_TO - zc) / FADE);
    return amp * BEAD_H * bump(s, BEAD_HALF);
  };
  const path = [{ r: 0, z: 0 }];
  line(path, d.R - BEVEL * (1 - Math.SQRT1_2), 0, 100);
  arc(path, d.R - BEVEL, BEVEL_Z, BEVEL, -Math.PI / 4, 0);
  const rows = grip.rows(from, to);
  rows.forEach((z, i) => path.push({ r: d.R, z, dr: gripAt, cells: grip.cells && i > 0 && i < rows.length - 2 }));
  line(path, d.R, d.ledge, 100);
  line(path, d.neckR, d.ledge, 100);
  line(path, d.neckR, d.top, rowStep.bead, bead);
  line(path, d.boreR, d.top, 100);
  line(path, d.boreR, d.coneTop, 100);
  line(path, d.cavR, d.coneBottom, 100);
  line(path, d.cavR, d.floor + FLOOR_CHAMFER, 100);
  line(path, d.cavR - FLOOR_CHAMFER, d.floor, 100);
  line(path, 0, d.floor, 100);
  return path;
}

/**
 * Tapa, dada vuelta: z = 0 es el techo (contra la cama) y z = capH la boca. Las coordenadas del frasco cerrado son
 * z' = ledge + capH − z y ángulo' = −ángulo, así que los relieves se escriben en esas coordenadas.
 */
function lidPath(p, d, rowStep, grip) {
  const toClosed = (z) => d.ledge + d.capH - z;
  // zona del agarre en coordenadas del frasco cerrado: entre el borde de la boca y el canto redondeado del techo
  const [from, to] = [d.ledge + 0.3, d.ledge + d.capH - BEVEL_Z - 0.3];
  const gripAt = (angle, z) => grip.relief(-angle, toClosed(z), from, to);
  // cordón de la tapa, corrido medio paso: cae en el hueco entre dos cordones del cuello; es un poco más angosto (juego axial)
  const half = (PITCH - 2 * BEAD_HALF - 1.2 * p.jarFitMm) / 2;
  const beadAt = (angle, z) => {
    const u = d.ledge + d.capH - z - d.ledge;
    const { s, zc } = helix(-angle, u, BEAD_FROM + PITCH / 2, PITCH);
    const amp = smooth((zc - BEAD_FROM) / FADE) * smooth((d.neckLen - BEAD_TO - zc) / FADE);
    return -amp * (d.lidBoreR - d.neckR - p.jarFitMm) * bump(s, half);
  };
  const path = [{ r: 0, z: 0 }];
  line(path, d.R - BEVEL * (1 - Math.SQRT1_2), 0, 100);
  arc(path, d.R - BEVEL, BEVEL_Z, BEVEL, -Math.PI / 4, 0);
  // de abajo hacia arriba en la tapa = de arriba hacia abajo en el frasco cerrado
  const rows = grip.rows(from, to).reverse();
  rows.forEach((u, i) => path.push({ r: d.R, z: toClosed(u), dr: gripAt, cells: grip.cells && i > 0 && i < rows.length - 2 }));
  line(path, d.R, d.capH, 100);
  line(path, d.lidBoreR + 0.5, d.capH, 100);
  line(path, d.lidBoreR, d.capH - 0.5, 100);
  line(path, d.lidBoreR, d.floor + FLOOR_CHAMFER, rowStep.bead, beadAt);
  line(path, d.lidBoreR - FLOOR_CHAMFER, d.floor, 100);
  line(path, 0, d.floor, 100);
  return path;
}

/**
 * @param {any} K
 * @param {(o:any)=>any} t  tracker de memoria
 * @param {any} p  parámetros ya normalizados
 * @param {{ zf:(z:number)=>number, seg:number, logo2d:any|null }} o  `logo2d`: el logo centrado en el origen (sin escalar)
 * @returns {{ body:any, lid:any, bodyLogo:any|null, lidLogo:any|null, lidView:number[], sizeMm:number[], dims:any }|null}
 */
export function buildJar(K, t, p, o) {
  const d = jarDims(p, o.zf);
  if (!d.ok) return null;
  const { rowStep, samples, S } = meshDensity(p, d, o.seg);
  const grip = gripOf(p, d, samples, rowStep.grip);
  const body = t(revolveFromPath(K, bodyPath(p, d, rowStep, grip), S));
  const lid = t(revolveFromPath(K, lidPath(p, d, rowStep, grip), S));
  const { bodyLogo, lidLogo, info } = logosOf(t, p, o.logo2d, d.R, d.floor, p.jarBaseLogo);
  const bb = body.boundingBox();
  return {
    body,
    lid,
    bodyLogo,
    lidLogo,
    logoInfo: info,
    // dada vuelta sobre X y subida hasta que la boca apoye en el escalón del cuerpo
    lidView: [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, d.ledge + d.capH],
    sizeMm: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], d.ledge + d.capH],
    dims: d,
  };
}
