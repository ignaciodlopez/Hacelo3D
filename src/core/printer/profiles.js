// Perfil de impresora global (compartido por todas las herramientas).

export const BED_PRESETS = [
  { id: 'bambu-a1-mini', name: 'Bambu Lab A1 mini', bed: [180, 180] },
  { id: 'bambu-256', name: 'Bambu Lab A1 / P1 / X1', bed: [256, 256] },
  { id: 'bambu-h2d', name: 'Bambu Lab H2D', bed: [325, 320] },
  { id: 'prusa-mk4', name: 'Prusa MK4', bed: [250, 210] },
  { id: 'prusa-mini', name: 'Prusa MINI', bed: [180, 180] },
  { id: 'ender-3', name: 'Creality Ender-3', bed: [220, 220] },
  { id: 'custom', name: 'Personalizada', bed: [200, 200] },
];

export const defaultPrinter = {
  presetId: 'bambu-256',
  bed: [256, 256],
  nozzleMm: 0.4,
  layerHeightMm: 0.2,
  firstLayerMm: 0.2,
  multiMaterial: true,
  densityGcm3: 1.24,
};

export function normalizePrinter(raw = {}) {
  const d = defaultPrinter;
  const num = (v, min, max, def) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  const bed = Array.isArray(raw.bed) ? raw.bed : d.bed;
  return {
    presetId: typeof raw.presetId === 'string' ? raw.presetId : d.presetId,
    bed: [num(bed[0], 40, 1000, d.bed[0]), num(bed[1], 40, 1000, d.bed[1])],
    nozzleMm: num(raw.nozzleMm, 0.2, 1.2, d.nozzleMm),
    layerHeightMm: num(raw.layerHeightMm, 0.05, 0.6, d.layerHeightMm),
    firstLayerMm: num(raw.firstLayerMm, 0.05, 0.6, d.firstLayerMm),
    multiMaterial: typeof raw.multiMaterial === 'boolean' ? raw.multiMaterial : d.multiMaterial,
    densityGcm3: num(raw.densityGcm3, 0.8, 3, d.densityGcm3),
  };
}

/** Redondea una altura Z absoluta al borde de capa más cercano. */
export function snapZ(z, printer) {
  const { layerHeightMm: lh, firstLayerMm: fl } = printer;
  if (z <= fl) return fl;
  // +1e-6: empates (x.5) siempre hacia arriba, sin depender del error de coma flotante
  return fl + Math.round((z - fl) / lh + 1e-6) * lh;
}
