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
/** Ranura helicoidal de agarre: mitad del fondo plano (flancos a 45°). */
const GRIP_FLAT = 0.15;
/**
 * Moleteado: fracción de la altura de la pirámide que se corta arriba. Con ½ las aristas del corte caen en la grilla
 * (múltiplos de ¼ de período) y la punta queda en un cuadradito plano de la mitad de lado.
 */
const KNURL_TOP = 0.5;
/** El agarre se desvanece en los extremos de su zona a lo largo de este tramo (mm). */
const GRIP_FADE = 1.5;
/**
 * Canto de abajo (y del techo de la tapa) contra la cama: un arco que sale a 45° (la primera capa ya llega casi hasta el
 * borde, sin pata de elefante ni voladizo) y queda vertical a BEVEL_Z. Radio del arco y chaflán del piso (mm).
 */
const BEVEL = 4;
const BEVEL_Z = BEVEL * Math.SQRT1_2;
const FLOOR_CHAMFER = 0.6;
/** Aire entre el logo y el borde del piso / techo (mm). */
const LOGO_MARGIN = 6;
/** Distancia de la boca de la tapa y del cuello hasta donde se desvanece el relieve (mm). */
const FADE = PITCH / 4;
/** Entre el techo de la tapa y el borde del cuello al cerrar (mm). */
const NECK_GAP = 0.1;

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const TAU = 2 * Math.PI;

/** Distancia vertical `s` (−paso/2…paso/2) a la hélice más cercana de centro `phase + paso·ángulo/2π` y altura `zc` de ese centro. */
function helix(angle, u, phase, pitch) {
  const k = (u - phase) / pitch - angle / TAU;
  const s = (k - Math.round(k)) * pitch;
  return { s, zc: u - s };
}

/** Perfil redondeado (media elipse) de ancho 2·half. */
const bump = (s, half) => (Math.abs(s) >= half ? 0 : Math.sqrt(1 - (s / half) ** 2));

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
  // moleteado: el paso se ajusta para que haya un número entero de entradas en la vuelta
  const knurlStarts = Math.max(8, Math.round((TAU * R) / p.jarGripPitchMm));
  return {
    R, floor, capH, ledge, neckLen, cavR, boreR, neckR, shoulder, coneTop, coneBottom, lidBoreR, knurlStarts,
    knurlPitch: (TAU * R) / knurlStarts,
    top: ledge + neckLen,
    gripDepth: p.jarGrip === 'none' ? 0 : Math.max(0, Math.min(p.jarGripDepthMm, p.jarWallMm - 1.2)),
    // cabe: cavidad de al menos 6 mm sobre el piso y cuello con lugar para un par de vueltas de cordón
    ok: coneBottom - floor >= 6 && neckLen >= BEAD_FROM + BEAD_TO + 1.5,
  };
}

/**
 * Agarre de afuera, en las coordenadas del frasco cerrado (ángulo, altura `u`), en la zona [uFrom, uTo]:
 *   - moleteado: dos familias de ranuras en V que se cruzan a 45° (N entradas, así que el dibujo cierra en la vuelta) y
 *     dejan pirámides; el sólido es la intersección de las dos superficies aserradas, o sea r = R − max(corte A, corte B);
 *     las filas del perfil caen sobre la grilla del dibujo (`rows`), una cada `paso / muestras` en altura;
 *   - ranura: una sola ranura helicoidal en V con fondo plano;
 *   - ninguno: pared lisa.
 * @returns {{ relief:(angle:number, u:number)=>number, rows:(uFrom:number, uTo:number)=>number[] }}
 */
function gripOf(p, d, samples, rowStep) {
  const depth = d.gripDepth;
  const fade = (u, a, b) => smooth((u - a) / GRIP_FADE) * smooth((b - u) / GRIP_FADE);
  if (p.jarGrip === 'none' || depth <= 0) return { relief: () => 0, rows: (a, b) => [a, b], cells: false };
  if (p.jarGrip === 'groove') {
    return {
      relief: (angle, u, a, b) => {
        const { s } = helix(angle, u, 0, p.jarGripPitchMm);
        const flank = Math.max(0, Math.min(depth, GRIP_FLAT + depth - Math.abs(s)));
        return -fade(u, a, b) * flank;
      },
      rows: (a, b) => {
        const n = Math.max(1, Math.ceil((b - a) / rowStep));
        return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
      },
      cells: false,
    };
  }
  const N = d.knurlStarts;
  const s = d.knurlPitch;
  // 1 en el centro de la ranura, 0 en la cresta
  const cut = (phase) => 1 - 2 * Math.abs(phase - Math.round(phase));
  return {
    relief: (angle, u, a, b) => {
      const turn = (N * angle) / TAU;
      // pirámides truncadas: por debajo de KNURL_TOP el corte es 0 (tapa plana a la altura de la cresta)
      const c = Math.max(cut(u / s - turn), cut(u / s + turn));
      return -fade(u, a, b) * depth * Math.max(0, (c - KNURL_TOP) / (1 - KNURL_TOP));
    },
    rows: (a, b) => {
      const dz = s / samples;
      const zs = [a];
      for (let k = Math.ceil(a / dz + 1e-9); k * dz < b - 1e-9; k++) if (k * dz > a + 1e-9) zs.push(k * dz);
      zs.push(b);
      return zs;
    },
    // las celdas entre filas de la grilla (las de los extremos, que no caen en ella, quedan con una diagonal)
    cells: true,
  };
}

/** Un tramo recto del perfil desde el último punto hasta (r, z), con puntos cada `step` mm y el relieve `dr`. */
function line(path, r, z, step, dr) {
  const a = path.at(-1);
  const n = Math.max(1, Math.ceil(Math.hypot(r - a.r, z - a.z) / step));
  for (let i = 1; i <= n; i++) path.push({ r: a.r + ((r - a.r) * i) / n, z: a.z + ((z - a.z) * i) / n, dr });
}

/** Un cuarto de círculo de radio `rad` desde el último punto hasta el otro lado de la esquina (centro en (cr, cz)). */
function arc(path, cr, cz, rad, from, to, n = 8) {
  for (let i = 1; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    path.push({ r: cr + rad * Math.cos(a), z: cz + rad * Math.sin(a) });
  }
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
  const rowStep = o.seg >= 1.6 ? { grip: 0.2, bead: 0.12 } : o.seg >= 1 ? { grip: 0.25, bead: 0.16 } : { grip: 0.4, bead: 0.25 };
  // muestras por período del moleteado (vértices por vuelta y filas por paso): con 4 las aristas (en múltiplos de ½ período)
  // caen justo en la grilla y en los centros de las celdas, y las pirámides salen exactas
  const samples = 4;
  const knurl = p.jarGrip === 'knurl' && d.gripDepth > 0;
  const S = knurl ? d.knurlStarts * samples : Math.max(96, Math.round(((o.seg >= 1.6 ? 288 : o.seg >= 1 ? 192 : 120) * Math.max(0.6, Math.min(1.3, d.R / 40))) / 8) * 8);
  const grip = gripOf(p, d, samples, rowStep.grip);
  let body = t(revolveFromPath(K, bodyPath(p, d, rowStep, grip), S));
  let lid = t(revolveFromPath(K, lidPath(p, d, rowStep, grip), S));

  // logos embutidos en la cara contra la cama: el del cuerpo abajo, el de la tapa arriba. Se dibujan como se leen mirando esa cara
  // (dar vuelta la pieza sobre el eje X invierte Y).
  const place = (cs, radius, depth) => {
    const b = cs.bounds();
    const half = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1]) / 2;
    const k = (Math.min(1, radius / half) * p.logoSizePct) / 100;
    return t(t(t(cs.mirror([0, 1])).scale([k, k])).extrude(depth));
  };
  let bodyLogo = null;
  let lidLogo = null;
  if (o.logo2d) {
    const radius = d.R - BEVEL * (1 - Math.SQRT1_2) - LOGO_MARGIN;
    const depth = Math.min(p.logoDepthMm, d.floor - 0.8);
    lidLogo = place(o.logo2d, radius, depth);
    bodyLogo = p.jarBaseLogo ? place(o.logo2d, radius * 0.7, depth) : null;
  }
  const info = o.logo2d ? { depthMm: Math.min(p.logoDepthMm, d.floor - 0.8), clipped: Math.min(p.logoDepthMm, d.floor - 0.8) < p.logoDepthMm - 1e-6 } : null;
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
