import { parse } from 'opentype.js';

/**
 * Carga y cachea fuentes por id. `loadBuffer(entry)` devuelve un ArrayBuffer
 * (fetch en el navegador, fs en Node), así el módulo sirve en ambos entornos.
 * @param {{ catalog: any[], loadBuffer: (entry:any)=>Promise<ArrayBuffer> }} deps
 */
export function createFontStore({ catalog, loadBuffer }) {
  const fonts = new Map();
  const pending = new Map();

  async function get(id) {
    if (fonts.has(id)) return fonts.get(id);
    if (pending.has(id)) return pending.get(id);
    const entry = catalog.find((f) => f.id === id) ?? catalog[0];
    if (!entry) throw new Error('Catálogo de fuentes vacío');
    if (entry.id !== id && fonts.has(entry.id)) return fonts.get(entry.id);
    const p = loadBuffer(entry).then((buf) => {
      const font = parse(buf);
      fonts.set(entry.id, font);
      fonts.set(id, font);
      pending.delete(id);
      return font;
    });
    pending.set(id, p);
    return p;
  }

  /** Registra una fuente subida por el usuario. */
  function addFromBuffer(id, buffer) {
    const font = parse(buffer);
    fonts.set(id, font);
    return font;
  }

  return { get, addFromBuffer, catalog };
}
