// Caja cilíndrica de almacenamiento con tapa roscada (mechas, lapiceras, varillas, soldadura…), SIN piezas de metal.
// Medidas tomadas de la caja de referencia Ø60 (110 de largo con la tapa puesta, 100 de espacio adentro):
//   - cuerpo: tubo de pared gruesa con el agarre de afuera moleteado, fondo de 5 mm y, arriba de un escalón, un cuello
//     roscado de afuera (paso 3, hélice derecha) que sigue con el mismo agujero que el tubo;
//   - tapa: del mismo diámetro y con el mismo moleteado, de 50 mm de alto: el techo de 5 mm, un bolsillo del mismo agujero
//     que el cuerpo (sirve de espacio extra: el largo de adentro es el largo de afuera menos los dos fondos) y, en la boca,
//     la rosca hembra que cierra sobre el cuello.
// La rosca de la tapa es la del cuello agrandada por el juego (`tubeFitMm`) y con la misma hélice: girar la tapa la sube
// justo lo que sube la hélice, y subirla sin girar choca. Los flancos son a 45°: se imprime sin soportes, el cuerpo parado
// y la tapa DADA VUELTA (el techo contra la cama, con el logo embutido en esa cara). Los de la caja de referencia son más
// profundos (1,6 mm, flancos a 60° de la vertical): acá bajan a 1 mm para no necesitar soportes.
//
// Todo se arma en las coordenadas de la caja CERRADA (eje en Z, base del cuerpo en z = 0); la tapa se construye ya dada
// vuelta (z = 0 en su techo) y `lidView` la devuelve a su lugar para el visor. Es una pila de anillos con un relieve
// radial r(ángulo, z) (ver `revolveFromPath`): sin booleanas, mallas cerradas por construcción.

import { revolveFromPath } from '../../core/kernel/rings.js';
import { BEVEL, BEVEL_Z, FLOOR_CHAMFER, smooth, helix, knurlOf, gripOf, line, arc, meshDensity, logosOf } from './screw.js';

/** Rosca: paso, cuánto sobresale, ancho del filo plano y pared del cuello bajo la rosca (mm). */
export const PITCH = 3;
export const THREAD_H = 1;
const CREST = 0.4;
const NECK_WALL = 1.6;
/** Cuello roscado: largo, distancia al borde de la zona roscada de la tapa (mm). */
const NECK_LEN = 12;
const NECK_GAP = 1;
/**
 * Fase de la hélice sobre el escalón y rampa de arriba del cuello: el filo se desvanece en los últimos THREAD_TO mm a lo
 * largo de FADE. Abajo, contra el escalón, la rosca corre entera y la corta el plano (como en una botella); la rampa
 * solo va donde el relieve baja al subir: en el cuello, arriba. En la tapa los dientes llegan enteros de la boca al fondo
 * (una rampa ahí sería un voladizo de más de 45°); entre un diente y el filo siempre queda al menos el juego.
 */
const THREAD_PHASE = 1;
const THREAD_TO = 1.5;
const FADE = 1;
/** Chaflán de entrada de la boca de la tapa (mm). */
const MOUTH_CHAMFER = 0.5;
/** Pared mínima que queda en la tapa bajo el fondo de una ranura de agarre (mm). */
const LID_MIN_WALL = 1.2;

/** Perfil de un filo de la rosca a distancia `s` de su centro: trapecio con flancos a 45° (0…THREAD_H). */
const profile = (s) => Math.max(0, Math.min(THREAD_H, THREAD_H - (Math.abs(s) - CREST / 2)));

/** Distancia `s` al filo más cercano y altura `zc` de su centro, en el punto (ángulo, altura sobre el escalón). */
const threadAt = (angle, u) => helix(angle, u, THREAD_PHASE, PITCH);

/**
 * Medidas de la caja a partir de los parámetros (con las alturas ya llevadas a la capa).
 * `ok` es falso si no entra el cuello, el bolsillo de la tapa o un espacio útil en el cuerpo.
 */
export function tubeDims(p, zf = (z) => z) {
  const R = p.tubeDiameterMm / 2;
  const floor = zf(p.tubeFloorMm);
  const lidH = zf(p.tubeLidHeightMm);
  const ledge = zf(p.tubeLengthMm - lidH);
  const bore = R - p.tubeWallMm;
  const root = bore + NECK_WALL;
  const crest = root + THREAD_H;
  // la boca de la tapa llega hasta el filo del cuello más el juego
  const lidBore = crest + p.tubeFitMm;
  const zone = NECK_LEN + NECK_GAP;
  return {
    R, floor, lidH, ledge, bore, root, crest, lidBore, zone,
    top: ledge + NECK_LEN,
    length: ledge + lidH,
    innerMm: ledge + lidH - 2 * floor,
    pocket: lidH - floor - zone,
    ...knurlOf(p, R),
    gripDepth: p.jarGrip === 'none' ? 0 : Math.max(0, Math.min(p.jarGripDepthMm, R - lidBore - LID_MIN_WALL)),
    // cabe: un agujero de 8 mm como mínimo, 10 mm de cuerpo sobre el fondo y 5 mm de bolsillo en la tapa
    ok: bore >= 4 && ledge - floor >= 10 && lidH - floor - zone >= 5,
  };
}

/** Cuerpo, parado sobre la cama. */
function bodyPath(d, rowStep, grip) {
  // zona del agarre, de abajo hacia arriba: entre el canto redondeado y el escalón
  const [from, to] = [BEVEL_Z + 0.3, d.ledge - 0.3];
  const gripAt = (angle, z) => grip.relief(angle, z, from, to);
  const thread = (angle, z) => {
    const { s, zc } = threadAt(angle, z - d.ledge);
    return smooth((NECK_LEN - THREAD_TO - zc) / FADE) * profile(s);
  };
  const path = [{ r: 0, z: 0 }];
  line(path, d.R - BEVEL * (1 - Math.SQRT1_2), 0, 100);
  arc(path, d.R - BEVEL, BEVEL_Z, BEVEL, -Math.PI / 4, 0);
  const rows = grip.rows(from, to);
  rows.forEach((z, i) => path.push({ r: d.R, z, dr: gripAt, cells: grip.cells && i > 0 && i < rows.length - 2 }));
  line(path, d.R, d.ledge, 100);
  line(path, d.root, d.ledge, 100, thread);
  line(path, d.root, d.top, rowStep.bead, thread);
  line(path, d.bore, d.top, 100);
  line(path, d.bore, d.floor + FLOOR_CHAMFER, 100);
  line(path, d.bore - FLOOR_CHAMFER, d.floor, 100);
  line(path, 0, d.floor, 100);
  return path;
}

/**
 * Tapa, dada vuelta: z = 0 es el techo (contra la cama) y z = lidH la boca. Las coordenadas de la caja cerrada son
 * z' = ledge + lidH − z y ángulo' = −ángulo, así que los relieves se escriben en esas coordenadas.
 */
function lidPath(d, rowStep, grip) {
  const toClosed = (z) => d.ledge + d.lidH - z;
  // zona del agarre en coordenadas de la caja cerrada: entre el borde de la boca y el canto redondeado del techo
  const [from, to] = [d.ledge + 0.3, d.ledge + d.lidH - BEVEL_Z - 0.3];
  const gripAt = (angle, z) => grip.relief(-angle, toClosed(z), from, to);
  // la boca es la del filo más el juego; los dientes de la tapa entran en los huecos del cuello
  const tooth = (angle, z) => -(THREAD_H - profile(threadAt(-angle, d.lidH - z).s));
  const path = [{ r: 0, z: 0 }];
  line(path, d.R - BEVEL * (1 - Math.SQRT1_2), 0, 100);
  arc(path, d.R - BEVEL, BEVEL_Z, BEVEL, -Math.PI / 4, 0);
  // de abajo hacia arriba en la tapa = de arriba hacia abajo en la caja cerrada
  const rows = grip.rows(from, to).reverse();
  rows.forEach((u, i) => path.push({ r: d.R, z: toClosed(u), dr: gripAt, cells: grip.cells && i > 0 && i < rows.length - 2 }));
  line(path, d.R, d.lidH, 100);
  line(path, d.lidBore + MOUTH_CHAMFER, d.lidH, 100);
  line(path, d.lidBore, d.lidH - MOUTH_CHAMFER, 100, tooth);
  line(path, d.lidBore, d.lidH - d.zone, rowStep.bead, tooth);
  line(path, d.bore, d.lidH - d.zone, 100);
  line(path, d.bore, d.floor + FLOOR_CHAMFER, 100);
  line(path, d.bore - FLOOR_CHAMFER, d.floor, 100);
  line(path, 0, d.floor, 100);
  return path;
}

/**
 * @param {any} K
 * @param {(o:any)=>any} t  tracker de memoria
 * @param {any} p  parámetros ya normalizados
 * @param {{ zf:(z:number)=>number, seg:number, logo2d:any|null }} o  `logo2d`: el logo centrado en el origen (sin escalar)
 * @returns {{ body:any, lid:any, bodyLogo:any|null, lidLogo:any|null, logoInfo:any|null, lidView:number[], sizeMm:number[], dims:any }|null}
 */
export function buildTube(K, t, p, o) {
  const d = tubeDims(p, o.zf);
  if (!d.ok) return null;
  const { rowStep, samples, S } = meshDensity(p, d, o.seg);
  const grip = gripOf(p, d, samples, rowStep.grip);
  const body = t(revolveFromPath(K, bodyPath(d, rowStep, grip), S));
  const lid = t(revolveFromPath(K, lidPath(d, rowStep, grip), S));
  const { bodyLogo, lidLogo, info } = logosOf(t, p, o.logo2d, d.R, d.floor, p.tubeBaseLogo);
  const bb = body.boundingBox();
  return {
    body,
    lid,
    bodyLogo,
    lidLogo,
    logoInfo: info,
    // dada vuelta sobre X y subida hasta que la boca apoye en el escalón del cuerpo
    lidView: [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, d.length],
    sizeMm: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], d.length],
    dims: d,
  };
}
