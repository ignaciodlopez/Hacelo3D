// Acomodo del organizador de escritorio. FUNCIÓN PURA (sin manifold): params → zonas y perfil del soporte.
//
// Una base plana con dos módulos pegados, uno al lado del otro (con `phoneSide` se elige de qué lado va el celular):
//   - lapicero: una taza alta de esquinas redondeadas, con divisiones opcionales
//   - soporte de celular: una placa inclinada hacia atrás, un labio adelante y, atrás, un respaldo vertical que la sostiene
// El frente es la cara de -Y. El centro de la base está en el origen (en planta) y apoya en z = 0.

/** Fracción de la altura de la placa a la que el respaldo vertical se une a ella. */
export const BRACE = 0.66;
/** Ancho del túnel de aligeramiento arriba, donde termina en punta (mm). */
export const ARCH_TOP = 4;
/** Cuánto se mete el soporte en la pared de la taza para que la unión sea volumétrica y no de caras coplanares (mm). */
export const OVERLAP = 1;
/** Compartimiento más angosto que se acepta entre dos divisiones (mm). */
export const MIN_COMPARTMENT = 12;

const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Perfil del soporte en el plano YZ, con y = 0 en el frente del labio. Cada polígono es una lista de puntos [y, z].
 *   - `outer`: la placa y la cuña que la une al respaldo vertical (macizo)
 *   - `cavity`: el túnel de aligeramiento entre la placa y el respaldo, o null si no hay lugar (con poca inclinación)
 *   - `lip`: el labio que frena el celular, con la punta redondeada
 * @param {any} p  parámetros ya normalizados
 */
export function standProfile(p, arcSegments = 10) {
  const a = rad(p.phoneAngleDeg);
  const tan = Math.tan(a);
  const cos = Math.cos(a);
  const t = p.wallMm;
  const B = p.baseMm;
  const H = p.phoneHeightMm;
  const rise = H - B;

  const lipW = t;
  const yF = lipW + p.phoneSlotMm / cos; // pie de la cara de adelante de la placa, sobre la base
  const th = t / cos; // espesor de la placa medido en horizontal
  const yFt = yF + rise * tan;
  const yBt = yFt + th;
  const zM = B + BRACE * rise; // donde el respaldo vertical se une a la placa
  const yW = yF + th + BRACE * rise * tan; // cara de atrás del respaldo vertical

  // el soporte se hunde hasta la mitad de la base: el redondeo del canto de la base nunca pasa de esa mitad, así que en el
  // extremo del soporte no queda un escalón (una cara que mire hacia abajo) entre su borde y el canto redondeado
  const zo = B / 2;
  const outer = [
    [yF - (B - zo) * tan, zo],
    [yFt, H],
    [yBt, H],
    [yW, zM],
    [yW, zo],
  ];

  // Túnel a lo largo del soporte: lo que sobra entre la cara de atrás de la placa y la de adelante del respaldo. Termina en
  // un techo a dos aguas de 45° (sin puentes), donde el ancho llega a ARCH_TOP.
  let cavity = null;
  if (tan > 1e-6) {
    const w0 = BRACE * rise * tan - t;
    const zc = B + (w0 - ARCH_TOP) / tan;
    if (w0 > ARCH_TOP + 2 && zc - B >= 8) {
      const yL = (z) => yF + th + (z - B) * tan;
      const yR = yW - t;
      const zb = B - 0.5;
      cavity = [
        [yL(zb), zb],
        [yR, zb],
        [yR, zc],
        [(yL(zc) + yR) / 2, zc + ARCH_TOP / 2],
        [yL(zc), zc],
      ];
    }
  }

  // labio: rectángulo con la punta en medio círculo
  const r = Math.min(lipW / 2, p.phoneLipMm);
  const zArc = B + p.phoneLipMm - r;
  const lip = [[0, zo]];
  lip.push([lipW, zo]);
  for (let i = 0; i <= arcSegments; i++) {
    const ang = (i / arcSegments) * Math.PI;
    lip.push([lipW / 2 + (lipW / 2) * Math.cos(ang), zArc + r * Math.sin(ang)]);
  }

  return { outer, cavity, lip, lipW, yF, th, yW, yBt, depth: Math.max(yBt, yW), height: H };
}

/**
 * @param {any} p  parámetros ya normalizados
 * @returns {{ ok:boolean, width:number, depth:number, height:number,
 *             cup:{ x0:number, x1:number, y0:number, y1:number, height:number, dividers:number }|null,
 *             stand:(ReturnType<typeof standProfile> & { x0:number, x1:number, shiftY:number })|null,
 *             messages:{ level:string, code:string, params?:any }[] }}
 */
export function layoutDesk(p) {
  const messages = [];
  const profile = p.phone ? standProfile(p) : null;
  if (!p.pens && !profile) {
    messages.push({ level: 'error', code: 'desk.empty' });
    return { ok: false, width: 0, depth: 0, height: 0, cup: null, stand: null, messages };
  }

  // el soporte queda centrado en el fondo, con al menos una esquina redondeada de aire adelante y atrás
  const margin = Math.max(p.cornerRadiusMm, 8);
  const depth = Math.max(p.pens ? p.cupDepthMm : 0, profile ? profile.depth + 2 * margin : 0);
  const cupW = p.pens ? p.cupWidthMm : 0;
  const standW = profile ? p.phoneWidthMm : 0;
  const width = cupW + standW;

  const cupFirst = p.phoneSide === 'right';
  const xCup0 = cupFirst ? -width / 2 : width / 2 - cupW;
  const xStand0 = cupFirst ? -width / 2 + cupW : -width / 2;

  let cup = null;
  if (p.pens) {
    // divisiones: cada compartimiento tiene que ser lo bastante ancho para un lápiz
    const inner = p.cupWidthMm - 2 * p.wallMm;
    const max = Math.max(0, Math.floor((inner - MIN_COMPARTMENT) / (MIN_COMPARTMENT + p.wallMm)));
    const dividers = Math.min(p.cupDividers, max);
    if (dividers < p.cupDividers) messages.push({ level: 'info', code: 'desk.dividersLimited', params: { n: dividers } });
    cup = { x0: xCup0, x1: xCup0 + cupW, y0: -depth / 2, y1: depth / 2, height: p.cupHeightMm, dividers };
  }
  const stand = profile ? { ...profile, x0: xStand0, x1: xStand0 + standW, shiftY: -profile.depth / 2 } : null;

  return { ok: true, width, depth, height: Math.max(cup ? p.cupHeightMm : 0, stand ? p.phoneHeightMm : 0), cup, stand, messages };
}
