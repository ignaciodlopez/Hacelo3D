// Acomodo en planta del organizador de escritorio. FUNCIÓN PURA (sin manifold): params → zonas.
//
// De izquierda a derecha: celular | lapicero | notas | tarjetas (con `phoneSide: 'right'` el orden se invierte). Cada
// zona es un módulo con sus paredes; entre módulos vecinos queda una ranura de `podGapMm` (apoyados sobre un zócalo bajo
// continuo) o, con 0, una sola pared compartida. Todas las zonas de la fila principal comparten el mismo fondo, así el
// bloque sale rectangular; el contenido de una zona menos profunda se centra (lapicero, notas) o se pega atrás (ranuras
// inclinadas).
// El frente es la cara de -Y. El centro del bloque está en el origen (en planta).

import { NOTE_SIZES } from './params.js';

/** Labio de adelante y pared de atrás de una ranura inclinada (mm). */
export const SLOT_LIP_FRONT = 3;
export const SLOT_BACK_WALL = 5;
/** Lo que sobra alrededor del celular: ancho de la ranura y grosor (mm). */
export const PHONE_PLAY_W = 4;
export const PHONE_PLAY_T = 1.5;
/** Tarjetas personales: ranura de ancho, grosor, inclinación, labio y respaldo fijos (mm, grados). */
export const CARD = { widthMm: 92, slotMm: 6, angleDeg: 15, lipMm: 8, backMm: 45 };

const SQ3 = Math.sqrt(3);
const rad = (deg) => (deg * Math.PI) / 180;

/** Lo que ocupa cada celda del lapicero en planta: `w` en X, `d` en Y. Hexágono: `penCellMm` es la medida entre caras. */
export function penCell(p) {
  return p.penShape === 'hex' ? { w: (p.penCellMm * 2) / SQ3, d: p.penCellMm } : { w: p.penCellMm, d: p.penCellMm };
}

/** Fondo de una ranura inclinada vista desde arriba: labio + lo que ocupa la ranura + respaldo (mm). */
export function slotDepth(thicknessMm, angleDeg, backMm) {
  const a = rad(angleDeg);
  return SLOT_LIP_FRONT + thicknessMm / Math.cos(a) + backMm * Math.tan(a) + SLOT_BACK_WALL;
}

/** Ancho y fondo del bolsillo de notas (mm), o null sin notas. */
export function notesSize(p) {
  if (p.notes === 'none') return null;
  const [w, d] = p.notes === 'custom' ? [p.notesWidthMm, p.notesDepthMm] : NOTE_SIZES[p.notes];
  return { w: w + 2 * p.notesClearanceMm, d: d + 2 * p.notesClearanceMm };
}

/** Distancia entre los interiores de dos módulos vecinos: dos paredes y la ranura, o una pared compartida. */
export const spacing = (p) => (p.podGapMm > 0 ? 2 * p.wallMm + p.podGapMm : p.wallMm);

/**
 * @param {any} p  parámetros ya normalizados
 * @returns {{ ok:boolean, zones:any[], width:number, depth:number, mainDepth:number, mainY0:number, mainY1:number,
 *             tray:{ y0:number, y1:number }|null, messages:{ level:string, code:string }[] }}
 */
export function layoutDesk(p) {
  const wall = p.wallMm;
  const messages = [];
  const specs = [];
  if (p.phone) specs.push({ kind: 'phone', w: p.phoneWidthMm + PHONE_PLAY_W, d: slotDepth(p.phoneThicknessMm + PHONE_PLAY_T, p.phoneAngleDeg, p.phoneBackMm), height: p.phoneBackMm, slot: true });
  if (p.pens) {
    const cell = penCell(p);
    specs.push({ kind: 'pens', w: p.penCols * cell.w + (p.penCols - 1) * wall, d: p.penRows * cell.d + (p.penRows - 1) * wall, height: p.penHeightMm, cell });
  }
  const notes = notesSize(p);
  if (notes) specs.push({ kind: 'notes', w: notes.w, d: notes.d, height: p.notesHeightMm });
  if (p.cards) specs.push({ kind: 'cards', w: CARD.widthMm, d: slotDepth(CARD.slotMm, CARD.angleDeg, CARD.backMm), height: CARD.backMm, slot: true });
  if (!specs.length) {
    messages.push({ level: 'error', code: 'desk.empty' });
    return { ok: false, zones: [], width: 0, depth: 0, mainDepth: 0, mainY0: 0, mainY1: 0, tray: null, messages };
  }
  if (p.phoneSide === 'right') specs.reverse();

  const mainDepth = Math.max(...specs.map((s) => s.d));
  const sp = spacing(p);
  const width = specs.reduce((s, z) => s + z.w, 0) + (specs.length - 1) * sp + 2 * wall;
  const trayDepth = p.tray ? p.trayDepthMm : 0;
  const depth = mainDepth + 2 * wall + (p.tray ? trayDepth + sp : 0);
  const trayY0 = -depth / 2 + wall;
  const mainY0 = p.tray ? trayY0 + trayDepth + sp : -depth / 2 + wall;
  const mainY1 = mainY0 + mainDepth;

  let x = -width / 2 + wall;
  const zones = specs.map((s) => {
    // las ranuras inclinadas van pegadas atrás (el labio queda al frente); el resto, centrado
    const y0 = s.slot ? mainY1 - s.d : mainY0 + (mainDepth - s.d) / 2;
    const z = { ...s, x0: x, x1: x + s.w, y0, y1: y0 + s.d };
    x += s.w + sp;
    return z;
  });
  if (p.phone && p.pens && p.phoneBackMm > p.penHeightMm + 10) messages.push({ level: 'info', code: 'desk.phoneTaller' });
  return { ok: true, zones, width, depth, mainDepth, mainY0, mainY1, tray: p.tray ? { y0: trayY0, y1: trayY0 + trayDepth } : null, messages };
}
