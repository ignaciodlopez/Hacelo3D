// Piezas de revolución con tapa roscada (frasco y caja cilíndrica): lo que comparten.
//   - hélices y perfiles de rosca, agarre de afuera (moleteado en rombos, una ranura helicoidal o liso),
//   - tramos de perfil (rectas y arcos) para `revolveFromPath`,
//   - densidad de la malla según la calidad, y el logo embutido en las caras que van contra la cama.
// Todo sale de un relieve radial r(ángulo, z) sobre un perfil: sin booleanas, mallas cerradas por construcción.

export const TAU = 2 * Math.PI;

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
export const BEVEL = 4;
export const BEVEL_Z = BEVEL * Math.SQRT1_2;
export const FLOOR_CHAMFER = 0.6;
/** Aire entre el logo y el borde del piso / techo (mm). */
const LOGO_MARGIN = 6;

export const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Distancia vertical `s` (−paso/2…paso/2) a la hélice más cercana de centro `phase + paso·ángulo/2π` y altura `zc` de ese centro. */
export function helix(angle, u, phase, pitch) {
  const k = (u - phase) / pitch - angle / TAU;
  const s = (k - Math.round(k)) * pitch;
  return { s, zc: u - s };
}

/** Perfil redondeado (media elipse) de ancho 2·half. */
export const bump = (s, half) => (Math.abs(s) >= half ? 0 : Math.sqrt(1 - (s / half) ** 2));

/** Moleteado: el paso se ajusta para que haya un número entero de entradas en la vuelta. */
export function knurlOf(p, R) {
  const knurlStarts = Math.max(8, Math.round((TAU * R) / p.jarGripPitchMm));
  return { knurlStarts, knurlPitch: (TAU * R) / knurlStarts };
}

/**
 * Agarre de afuera, en las coordenadas de la pieza cerrada (ángulo, altura `u`), en la zona [uFrom, uTo]:
 *   - moleteado: dos familias de ranuras en V que se cruzan a 45° (N entradas, así que el dibujo cierra en la vuelta) y
 *     dejan pirámides; el sólido es la intersección de las dos superficies aserradas, o sea r = R − max(corte A, corte B);
 *     las filas del perfil caen sobre la grilla del dibujo (`rows`), una cada `paso / muestras` en altura;
 *   - ranura: una sola ranura helicoidal en V con fondo plano;
 *   - ninguno: pared lisa.
 * @param {{ jarGrip:string, jarGripPitchMm:number }} p
 * @param {{ gripDepth:number, knurlStarts:number, knurlPitch:number }} d
 * @returns {{ relief:(angle:number, u:number, a:number, b:number)=>number, rows:(uFrom:number, uTo:number)=>number[], cells:boolean }}
 */
export function gripOf(p, d, samples, rowStep) {
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
export function line(path, r, z, step, dr) {
  const a = path.at(-1);
  const n = Math.max(1, Math.ceil(Math.hypot(r - a.r, z - a.z) / step));
  for (let i = 1; i <= n; i++) path.push({ r: a.r + ((r - a.r) * i) / n, z: a.z + ((z - a.z) * i) / n, dr });
}

/** Un arco de radio `rad` desde el último punto (centro en (cr, cz)), de ángulo `from` a `to`. */
export function arc(path, cr, cz, rad, from, to, n = 8) {
  for (let i = 1; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    path.push({ r: cr + rad * Math.cos(a), z: cz + rad * Math.sin(a) });
  }
}

/**
 * Densidad de la malla: separación de filas (mm) del agarre en ranura y de la rosca, muestras por período del
 * moleteado y vértices por vuelta `S`.
 * Con 4 muestras las aristas del moleteado (en múltiplos de ½ período) caen justo en la grilla y en los centros de las
 * celdas, y las pirámides salen exactas.
 * @param {{ jarGrip:string }} p
 * @param {{ R:number, gripDepth:number, knurlStarts:number }} d
 * @param {number} seg  segmentos por mm de los círculos (calidad)
 */
export function meshDensity(p, d, seg) {
  const rowStep = seg >= 1.6 ? { grip: 0.2, bead: 0.12 } : seg >= 1 ? { grip: 0.25, bead: 0.16 } : { grip: 0.4, bead: 0.25 };
  const samples = 4;
  const knurl = p.jarGrip === 'knurl' && d.gripDepth > 0;
  const S = knurl ? d.knurlStarts * samples : Math.max(96, Math.round(((seg >= 1.6 ? 288 : seg >= 1 ? 192 : 120) * Math.max(0.6, Math.min(1.3, d.R / 40))) / 8) * 8);
  return { rowStep, samples, S };
}

/**
 * Logos embutidos en la cara contra la cama: el de la tapa en el techo y, si se pide, el del cuerpo abajo. Se dibujan
 * como se leen mirando esa cara (dar vuelta la pieza sobre el eje X invierte Y).
 * @param {(o:any)=>any} t  tracker de memoria
 * @param {{ logoSizePct:number, logoDepthMm:number }} p
 * @param {any|null} logo2d  el logo centrado en el origen (sin escalar)
 * @param {number} R  radio de afuera
 * @param {number} floor  grosor del piso y del techo
 * @param {boolean} baseLogo  también el logo abajo del cuerpo
 */
export function logosOf(t, p, logo2d, R, floor, baseLogo) {
  if (!logo2d) return { bodyLogo: null, lidLogo: null, info: null };
  const place = (cs, radius, depth) => {
    const b = cs.bounds();
    const half = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1]) / 2;
    const k = (Math.min(1, radius / half) * p.logoSizePct) / 100;
    return t(t(t(cs.mirror([0, 1])).scale([k, k])).extrude(depth));
  };
  const radius = R - BEVEL * (1 - Math.SQRT1_2) - LOGO_MARGIN;
  const depth = Math.min(p.logoDepthMm, floor - 0.8);
  return {
    lidLogo: place(logo2d, radius, depth),
    bodyLogo: baseLogo ? place(logo2d, radius * 0.7, depth) : null,
    info: { depthMm: depth, clipped: depth < p.logoDepthMm - 1e-6 },
  };
}
