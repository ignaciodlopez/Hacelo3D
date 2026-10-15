// Arma los archivos de descarga a partir de un BuildResult (sin tocar el DOM).
import { encodeStl } from './stl.js';
import { encode3mf } from './threemf.js';
import { makeZip } from './zip.js';
import { safeName } from './filename.js';

/** Nombres únicos para el lote ("sofia", "sofia-2"…). */
function uniqueNames(items, prefix) {
  const used = new Map();
  return items.map((it) => {
    const base = `${prefix}-${safeName(it.name.replace(/\n/g, ' '), 'pieza')}`;
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** STL de un color (merged). Un item → .stl ; varios → .zip. */
export function exportStl(result, prefix = 'llavero') {
  const names = uniqueNames(result.items, prefix);
  if (result.items.length === 1) {
    return { filename: `${names[0]}.stl`, data: encodeStl(result.items[0].merged), type: 'model/stl' };
  }
  const files = {};
  result.items.forEach((it, i) => {
    files[`${names[i]}.stl`] = encodeStl(it.merged);
  });
  return { filename: `${prefix}-lote.zip`, data: makeZip(files), type: 'application/zip' };
}

/** ZIP con un STL por color (mismas coordenadas → se alinean en el slicer). */
export function exportZipPerColor(result, prefix = 'llavero') {
  const names = uniqueNames(result.items, prefix);
  const files = {};
  result.items.forEach((it, i) => {
    for (const part of it.parts) {
      files[`${names[i]}_${safeName(part.label, part.colorKey)}.stl`] = encodeStl(part);
    }
  });
  const base = result.items.length === 1 ? names[0] : `${prefix}-lote`;
  return { filename: `${base}_colores.zip`, data: makeZip(files), type: 'application/zip' };
}

/**
 * 3MF multicolor: un objeto con una parte por color.
 * En lote: un 3MF por placa (piezas ya acomodadas en la cama); varias placas → ZIP.
 */
export function export3mf(result, prefix = 'llavero') {
  const names = uniqueNames(result.items, prefix);
  if (result.plates && result.plates.length) {
    const files = {};
    result.plates.forEach((plate, i) => {
      files[`${prefix}-placa-${i + 1}.3mf`] = encode3mf(
        plate.items.map((idx) => result.items[idx]),
        `${prefix} placa ${i + 1}`,
      );
    });
    const keys = Object.keys(files);
    if (keys.length === 1) return { filename: keys[0], data: files[keys[0]], type: 'model/3mf' };
    return { filename: `${prefix}-lote-3mf.zip`, data: makeZip(files), type: 'application/zip' };
  }
  const base = result.items.length === 1 ? names[0] : `${prefix}-lote`;
  return { filename: `${base}.3mf`, data: encode3mf(result.items, prefix), type: 'model/3mf' };
}
