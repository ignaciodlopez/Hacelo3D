// Catálogo de fuentes en el hilo principal (para el selector con vista previa).

const BASE = import.meta.env.BASE_URL;
let catalogPromise = null;
const loaded = new Map();
/** Fuentes subidas por el usuario (solo esta sesión). */
const uploaded = [];

export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(`${BASE}fonts/fonts.json`)
      .then((r) => r.json())
      .catch(() => []);
  }
  return catalogPromise.then((list) => [...list, ...uploaded]);
}

/** Carga la fuente en el documento (FontFace) para previsualizarla en la UI. */
export function ensureFontFace(entry) {
  const family = fontFamilyOf(entry);
  if (loaded.has(entry.id)) return loaded.get(entry.id);
  const src = entry.buffer ? entry.buffer : `url(${BASE}fonts/${entry.file})`;
  const face = new FontFace(family, src);
  const p = face
    .load()
    .then((f) => {
      document.fonts.add(f);
      return family;
    })
    .catch(() => 'sans-serif');
  loaded.set(entry.id, p);
  return p;
}

export function fontFamilyOf(entry) {
  return `b3d-${entry.id.replace(/[^a-z0-9]/gi, '-')}`;
}

export function registerUploadedFont(entry) {
  const i = uploaded.findIndex((f) => f.id === entry.id);
  if (i >= 0) uploaded.splice(i, 1);
  uploaded.push(entry);
}
