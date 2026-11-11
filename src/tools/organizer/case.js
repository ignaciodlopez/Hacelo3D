// Estuche porta mechas: caja larga con tapa, dos bisagras atrás y dos trabas adelante, SIN piezas de metal.
//
// Todo encastra a presión con pernos impresos y ganchos en C (una C con la boca un poco más angosta que el perno: la C
// se abre al empujar y lo abraza):
//   - bisagras: la tapa trae un nudillo con un perno a cada lado; la base, dos orejas con una C que mira hacia atrás y
//     abajo. La tapa se calza empujándola desde atrás; al usarla, los esfuerzos empujan el perno contra el fondo de la C.
//   - trabas (a la manera de las "snap lock" de las cajas de stickers): una tira plana que cuelga de dos pernos gruesos y
//     largos de las orejas de la tapa (la boca de la C mira hacia la caja y abajo) y cuyo diente queda bajo un gancho ancho
//     de la base. El pivote está en la cara de adentro de la tira, así que su peso la apoya contra el gancho y la caja
//     cierra sola; para abrirla se la tira hacia afuera. Todo lo que carga es ancho (tira de 16 mm, gancho de 14), no dos
//     orejas finas.
//
// Piezas (se imprimen por separado, sin soportes): la base parada; la tapa DADA VUELTA, con el logo embutido en la cara de
// arriba contra la cama; las trabas acostadas (el perfil sobre la cama: las capas quedan en el plano en que trabajan). Base
// y tapa tienen el canto de afuera achaflanado (sin pata de elefante) y encastran: el borde de la base sube por dentro de
// la tapa.
//
// Todo se arma en las coordenadas del estuche CERRADO (centro de la base en el origen, frente hacia -Y, z = 0 abajo) y
// después cada pieza se lleva a su posición de impresión; `view` es la matriz que la devuelve a su lugar para el visor.

import { roundedRect, circle, rectFromBounds } from '../../core/kernel/shapes2d.js';

/** Piso de la base, techo de la tapa y chaflán de los cantos de afuera (mm). */
const FLOOR = 2;
const TOP = 2;
const CHAMFER = 1.2;
/** Borde de la base que entra en la tapa: alto y juego por lado (mm). */
const LIP_H = 1.6;
const LIP_CLR = 0.15;
/** Material de la C alrededor de un perno (mm): lo que se abre al encastrar. */
const ARM = 1.6;
/** Bisagra: ancho del nudillo de la tapa, grosor de las orejas de la base y juego entre ellos (mm). */
const KNUCKLE = 12;
const PRONG_T = 3;
const GAP = 0.4;
/**
 * Trabas (una tira plana que se imprime acostada, con el perfil sobre la cama: todos los esfuerzos le quedan en el plano de las
 * capas). Ancho de la traba, grosor de las orejas de la tapa que sostienen sus pernos, cuánto entra cada perno en la traba y
 * cuánto más grueso que el perno de la bisagra es (mm).
 */
const LATCH_W = 16;
const EAR_T = 4;
const PIN_ENGAGE = 3.8;
const PIN_TIP = 1;
const LATCH_PIN_GAIN = 1.6;
/** Material de la C de la traba alrededor del perno y grosor de la tira (mm). */
const ARM_L = 2.4;
const STRAP_T = 4;
/**
 * Gancho de la base, de ancho LATCH_W - 2: lo que sobresale de la pared, su espesor contra la pared, y cuánto de abajo es
 * plano antes de seguir a 45° hasta la punta. La tira pasa HOOK_LOOSE por afuera de la punta (mm).
 */
const HOOK_OUT = 5;
const HOOK_T = 6;
const HOOK_FLAT = 3.8;
const HOOK_LOOSE = 0.4;
/** Diente de la traba: alto y aire con la cara de abajo del gancho (mm). */
const TOOTH_H = 3.6;
const CATCH_GAP = 0.3;
/** Aire entre el logo y los bordes de la tapa (mm). */
const LOGO_MARGIN = 8;

const FAR = 1e4;

/**
 * Perfil 2D del plano YZ (u = y, v = z) extruido a lo largo de X, de `x0` a `x0 + len`.
 * Se extruye en Z y se gira: (u, v, e) → (x = e, y = u, z = v).
 */
function alongX(K, t, cs, x0, len) {
  return t(t(t(cs.extrude(len)).rotate([90, 0, 90])).translate([x0, 0, 0]));
}

/**
 * Boca de una C: el canal por donde entra el perno, un poco más angosto que él (`snap` en total), abierto en la
 * dirección `dir` (unitaria, en el plano YZ) y con la entrada abocinada.
 */
function mouth(K, t, c, r, dir, snap, reach) {
  const half = Math.max(0.3, r - snap / 2);
  const [dx, dy] = dir;
  const nx = -dy;
  const ny = dx;
  const at = (s, w) => [c[0] + dx * s + nx * w, c[1] + dy * s + ny * w];
  const pts = [at(0, -half), at(r * 0.5, -half), at(reach, -half - 1.2), at(reach, half + 1.2), at(r * 0.5, half), at(0, half)];
  return t(new K.CrossSection([pts], 'NonZero'));
}

/** Sólido "parado" de una forma de planta: su canto de abajo (o de arriba) achaflanado. */
function chamfered(K, t, outline, inner, h, z0, chamferAtTop) {
  const slab = (cs, za, zb) => t(t(cs.extrude(zb - za)).translate([0, 0, za]));
  const lo = chamferAtTop ? slab(outline, z0, z0 + h - CHAMFER) : slab(inner, z0, z0 + 0.01);
  const hi = chamferAtTop ? slab(inner, z0 + h - 0.01, z0 + h) : slab(outline, z0 + CHAMFER, z0 + h);
  return t(K.Manifold.hull([lo, hi]));
}

/**
 * @param {any} K
 * @param {(o:any)=>any} t
 * @param {ReturnType<import('./params.js').normalizeParams>} p
 * @param {{ zf:(z:number)=>number, seg:number, logo2d:any|null }} o  `logo2d`: el logo ya centrado en el origen (sin escalar)
 */
export function buildCase(K, t, p, o) {
  const { zf, seg } = o;
  const L = p.caseLengthMm;
  const W = p.caseWidthMm;
  const Hb = zf(p.caseHeightMm);
  const Hl = zf(p.lidHeightMm);
  const wall = p.caseWallMm;
  const rc = Math.min(6, W / 2 - wall - 1, L / 2 - wall - 1);
  const outer = roundedRect(K, t, L, W, rc, 0, 0, seg);
  const inset = (d) => t(outer.offset(-d, 'Round', 2, 32));
  const disc = (c, r) => circle(K, t, r, c[0], c[1], seg);

  // pernos impresos y sus C: la C deja juego para que el perno gire y su boca es `snap` más angosta que él
  const rPin = p.pinMm / 2;
  const rHole = rPin + p.pinClearanceMm / 2;
  const rb = rHole + ARM;
  const snap = p.latchSnapMm;

  // bisagras y trabas a la misma altura del largo, cerca de las puntas
  const xs = [-1, 1].map((s) => s * (L / 2 - Math.max(0.2 * L, 22)));
  const hingeSpan = KNUCKLE + 2 * (GAP + PRONG_T);
  const earSpan = LATCH_W + 2 * (GAP + EAR_T);

  // ---- ejes: bisagra atrás (en la junta); traba adelante, con su pivote en las orejas de la tapa y su diente bajo el gancho
  // de la base
  const H = [W / 2 + rb + 0.4, Hb];
  const yW = -W / 2;
  const rLP = (p.pinMm + LATCH_PIN_GAIN) / 2;
  const rHoleL = rLP + p.pinClearanceMm / 2;
  const rRing = rHoleL + ARM_L;
  const rEar = rLP + 2;
  // el pivote queda arriba de la junta, lo bastante abajo para que el costado de la oreja suba a 45° o más y se imprima sin
  // soporte (la tapa se imprime dada vuelta)
  const dP = Math.min(Math.max(0.3 * Hl, rEar + 0.7), Hl - rEar - 1);
  // la tira queda por afuera del gancho, y el pivote en su cara de adentro: así el peso de la tira (que queda del lado de
  // afuera del pivote) la hace caer hacia el gancho y la pared, y la traba cuelga cerrada
  const yS = yW - HOOK_OUT - HOOK_LOOSE;
  const P = [yS, Hb + dP];
  const below = rectFromBounds(K, t, -FAR, -FAR, FAR, Hb);
  const above = rectFromBounds(K, t, -FAR, Hb, FAR, FAR);
  /** Círculo alrededor de un eje con su apoyo hasta la pared (del lado de la junta que corresponde). */
  const mount = (c, face, z0, z1, side) => {
    const ring = disc(c, rb);
    const web = t(K.CrossSection.hull([ring, rectFromBounds(K, t, face[0], z0, face[1], z1)]));
    return t(K.CrossSection.union([ring, t(web.intersect(side))]));
  };
  const back = [W / 2 - 1, W / 2];
  const front = [-W / 2, -W / 2 + 1];
  const SQ = Math.SQRT1_2;

  // ---- base
  const baseParts = [chamfered(K, t, outer, inset(CHAMFER), Hb, 0, false)];
  const lip = t(inset(wall / 2 + LIP_CLR).subtract(inset(wall)));
  baseParts.push(t(t(lip.extrude(LIP_H)).translate([0, 0, Hb])));
  // orejas de la bisagra: una C que mira hacia atrás y abajo (la tapa se calza empujándola desde ahí)
  const prong = t(
    mount(H, back, Hb - 2 * rb - 3, Hb, below)
      .subtract(disc(H, rHole))
      .subtract(mouth(K, t, H, rPin, [SQ, -SQ], snap, rb + 2)),
  );
  // gancho de la traba: un bloque ancho justo debajo de la junta. Abajo es plano (ahí traba el diente) y recién cerca de la
  // punta sube a 45°; así se imprime sin soporte, y el esfuerzo se reparte en todo su ancho en vez de en dos orejas finas.
  const zTop = Hb - 1;
  const zh0 = zTop - HOOK_T;
  const hook2d = t(
    new K.CrossSection([[[yW + 1, zh0], [yW - HOOK_FLAT, zh0], [yW - HOOK_OUT, zh0 + HOOK_OUT - HOOK_FLAT], [yW - HOOK_OUT, zTop], [yW + 1, zTop]]], 'NonZero'),
  );
  for (const x of xs) {
    baseParts.push(alongX(K, t, prong, x - hingeSpan / 2, PRONG_T), alongX(K, t, prong, x + hingeSpan / 2 - PRONG_T, PRONG_T));
    baseParts.push(alongX(K, t, hook2d, x - (LATCH_W - 2) / 2, LATCH_W - 2));
  }
  const cavity = t(t(inset(wall).extrude(Hb + LIP_H)).translate([0, 0, FLOOR]));
  const base = t(t(K.Manifold.union(baseParts)).subtract(cavity));

  // ---- tapa (cerrada, encima de la base)
  const lidParts = [chamfered(K, t, outer, inset(CHAMFER), Hl, Hb, true)];
  const knuckle = mount(H, back, Hb, Hb + Hl, above);
  // oreja de la traba: el pivote y su apoyo hasta la pared, con el costado de arriba cortado a 45° desde el canto de la tapa
  // (dada vuelta es el de abajo, y así no lleva soporte)
  const earRing = disc(P, rEar);
  const earWeb = t(K.CrossSection.hull([earRing, rectFromBounds(K, t, front[0], Hb, front[1], Hb + Hl)]));
  const earCut = t(
    new K.CrossSection([[[yW + 50, Hb + Hl + 50], [yW, Hb + Hl], [yW - 100, Hb + Hl - 100], [yW - 100, Hb - 100], [yW + 50, Hb - 100]]], 'NonZero'),
  );
  const lidEar = t(K.CrossSection.union([earRing, t(earWeb.intersect(above))]).intersect(earCut));
  // perno de la traba: grueso, con la punta a 45° para que entre en la C
  const pinDisc = circle(K, t, rLP, 0, 0, seg);
  const pinTip = t(t(pinDisc.extrude(PIN_TIP, 0, 0, [0.7, 0.7])).rotate([90, 0, 90]));
  const latchPin = (xFrom, dir) => {
    const len = GAP + PIN_ENGAGE;
    const straight = alongX(K, t, disc(P, rLP), dir > 0 ? xFrom - 0.01 : xFrom - len + PIN_TIP - 0.05, len - PIN_TIP + 0.06);
    const tip = dir > 0 ? t(pinTip.translate([xFrom + len - PIN_TIP - 0.05, P[0], P[1]])) : t(t(pinTip.mirror([1, 0, 0])).translate([xFrom - len + PIN_TIP + 0.05, P[0], P[1]]));
    return [straight, tip];
  };
  for (const x of xs) {
    lidParts.push(alongX(K, t, knuckle, x - KNUCKLE / 2, KNUCKLE));
    // pernos del nudillo: entran en las C de las orejas de la base (sin llegar a asomar del otro lado)
    const pinLen = GAP + PRONG_T - 0.3;
    lidParts.push(alongX(K, t, disc(H, rPin), x - KNUCKLE / 2 - pinLen, pinLen + 0.01), alongX(K, t, disc(H, rPin), x + KNUCKLE / 2 - 0.01, pinLen + 0.01));
    lidParts.push(alongX(K, t, lidEar, x - earSpan / 2, EAR_T), alongX(K, t, lidEar, x + earSpan / 2 - EAR_T, EAR_T));
    // pernos de las orejas, hacia adentro (donde va la traba)
    lidParts.push(...latchPin(x - earSpan / 2 + EAR_T, 1), ...latchPin(x + earSpan / 2 - EAR_T, -1));
  }
  const lidCuts = [
    t(t(inset(wall).extrude(Hl - TOP + 1)).translate([0, 0, Hb - 1])),
    // rebaje donde entra el borde de la base
    t(t(inset(wall / 2).extrude(LIP_H + 0.3 + 1)).translate([0, 0, Hb - 1])),
  ];
  let lid = t(t(K.Manifold.union(lidParts)).subtract(t(K.Manifold.union(lidCuts))));

  // ---- logo en la tapa (embutido o grabado: la tapa se imprime con esa cara contra la cama)
  let logo = null;
  let logoInfo = null;
  if (o.logo2d) {
    const b = o.logo2d.bounds();
    const lw = b.max[0] - b.min[0];
    const lh = b.max[1] - b.min[1];
    const k = (Math.min((L - 2 * LOGO_MARGIN) / lw, (W - 2 * LOGO_MARGIN) / lh) * p.logoSizePct) / 100;
    // queda al menos 0,8 mm de techo debajo del logo
    const depth = Math.min(p.logoDepthMm, TOP - 0.8);
    const cs = t(o.logo2d.scale(k));
    const at = (h) => t(t(cs.extrude(h)).translate([0, 0, Hb + Hl - depth]));
    lid = t(lid.subtract(at(depth + 1)));
    logo = at(depth);
    logoInfo = { widthMm: lw * k, depthMm: depth, clipped: depth < p.logoDepthMm - 1e-6 };
  }

  // ---- trabas (perfil en el plano YZ; se imprimen acostadas, con el perfil sobre la cama)
  // arriba, una C alrededor del pivote (la boca mira hacia la caja y abajo: la traba se calza empujándola desde afuera, y ni su
  // peso ni la tapa al levantarse tiran del perno hacia la boca: tiran hacia arriba de la C); abajo, un diente que queda bajo
  // el gancho de la base, con una rampa a 45° que sigue la del gancho.
  const zEnd = zh0 - CATCH_GAP - TOOTH_H;
  const flatZ = zh0 - CATCH_GAP;
  const yt = yW - 0.2;
  const rampTop = flatZ + (yW - HOOK_FLAT - yS);
  const tooth = t(
    new K.CrossSection([[[yS - 0.5, zEnd], [yt, zEnd], [yt, flatZ], [yW - HOOK_FLAT, flatZ], [yS, rampTop], [yS - 0.5, rampTop]]], 'NonZero'),
  );
  const strap = rectFromBounds(K, t, P[0] - STRAP_T, zEnd, P[0], P[1]);
  const latch2d = t(
    K.CrossSection.union([disc(P, rRing), strap, tooth]).subtract(t(K.CrossSection.union([disc(P, rHoleL), mouth(K, t, P, rLP, [SQ, -SQ], snap, rRing + 2)]))),
  );
  const vz = latch2d.bounds();
  const vc = (vz.min[1] + vz.max[1]) / 2;
  const latch = t(t(latch2d.translate([-P[0], -vc])).extrude(LATCH_W));

  // ---- a la cama: la tapa dada vuelta; las trabas acostadas
  const top = Hb + Hl;
  const lidPrint = t(t(lid.rotate([180, 0, 0])).translate([0, 0, top]));
  const logoPrint = logo ? t(t(logo.rotate([180, 0, 0])).translate([0, 0, top])) : null;
  const FLIP = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, top];
  const latchView = (x) => [0, 0, 1, x - LATCH_W / 2, 1, 0, 0, P[0], 0, 1, 0, vc];

  return {
    base,
    lid: lidPrint,
    logo: logoPrint,
    lidView: FLIP,
    latch,
    latchViews: xs.map(latchView),
    logoInfo,
    sizeMm: [L, W, Hb + Hl],
    /** Para verificar el mecanismo: eje de la bisagra y pivote de las trabas (coordenadas del estuche cerrado). */
    axes: { hinge: H, latch: P },
  };
}
