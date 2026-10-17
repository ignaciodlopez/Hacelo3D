// Rosca entre la base y la pantalla. Las medidas salen de la base "Modular Lamp" (base.stl):
// rosca derecha de paso 5 mm, hembra en la cara interna del aro de la base y macho en el cuello
// de la pantalla. Con estas medidas las pantallas que genera la herramienta también entran en esa
// base impresa, y las pantallas de ese modelo entran en la base que genera la herramienta.

export const THREAD = {
  pitch: 5,
  // base (hembra): aro de Ø116 × 13,75 mm con canaleta redondeada de 0,9 mm
  rimOuterR: 58,
  boreR: 55,
  grooveDepth: 0.9,
  grooveHalf: 1.31,
  grooveFrom: 3.6,
  rimTopZ: 13.75,
  floorMm: 2,
  // pantalla (macho): núcleo Ø108,3, cresta Ø111
  coreR: 54.16,
  crestR: 55.5,
  bumpHalf: 1,
  bumpFrom: 1.8,
  bumpTo: 8.2,
  neckInnerR: 52.6,
  neckTopZ: 9.6,
  leadInMm: 0.6,
};

/** Chaflán de entrada (45°) del canto interno del aro de la base. */
const RIM_CHAMFER = 0.6;

/**
 * Altura a la que queda la pantalla sobre la base una vez enroscada: el cono del cuello (45°)
 * apoya de lleno contra el chaflán del aro. En la base original (sin chaflán) queda 0,6 mm más alta.
 */
export const SEAT_Z = THREAD.rimTopZ - RIM_CHAMFER - (THREAD.neckTopZ + (THREAD.boreR - THREAD.coreR));

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Distancia vertical `s` al centro de la hélice más cercana y la altura `zc` de ese centro. */
function helix(angle, z) {
  const P = THREAD.pitch;
  const u = z / P - angle / (2 * Math.PI);
  const s = (u - Math.round(u)) * P;
  return { s, zc: z - s };
}

/** Perfil redondeado (medio círculo achatado) de ancho 2·half. */
const bump = (s, half) => (Math.abs(s) >= half ? 0 : Math.sqrt(1 - (s / half) ** 2));

/**
 * Radio exterior del cuello roscado de la pantalla en (ángulo, z).
 * @param {number} fit  holgura extra (mm): positiva afloja, negativa ajusta
 */
export function maleRadius(angle, z, fit = 0) {
  const T = THREAD;
  const half = Math.max(0.6, T.bumpHalf - fit / 2);
  const { s, zc } = helix(angle, z);
  const fadeLen = T.pitch / 4;
  const amp = smooth((zc - T.bumpFrom) / fadeLen) * smooth((T.bumpTo - zc) / fadeLen);
  let r = T.coreR + (T.crestR - fit - T.coreR) * amp * bump(s, half);
  // chaflán de entrada abajo (también evita la "pata de elefante" de la primera capa)
  if (z < T.leadInMm) r -= T.leadInMm - z;
  return r;
}

/** Radio interno del aro de la base (con la canaleta de la rosca hembra) en (ángulo, z). */
export function femaleRadius(angle, z) {
  const T = THREAD;
  const { s, zc } = helix(angle, z);
  const amp = smooth((zc - T.grooveFrom) / (T.pitch / 4));
  let r = T.boreR + T.grooveDepth * amp * bump(s, T.grooveHalf);
  // chaflán de entrada arriba
  const ch = z - (T.rimTopZ - RIM_CHAMFER);
  if (ch > 0) r = Math.max(r, T.boreR + ch);
  return r;
}

/** Alturas de muestreo para una zona roscada (paso fino: el perfil tiene flancos empinados). */
export function threadZs(z0, z1, dz = 0.15) {
  const n = Math.max(2, Math.ceil((z1 - z0) / dz));
  return Array.from({ length: n + 1 }, (_, i) => z0 + ((z1 - z0) * i) / n);
}
