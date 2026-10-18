// Base de la lámpara, a imagen de "Modular Lamp / base.stl":
//   piso de Ø116 × 2 mm, aro con rosca hembra por dentro, tubo central para el portalámparas
//   (partido de un lado, con orejas y tornillo M4 + tuerca para apretarlo), y canal para el cable
//   que sale por el piso hasta el borde, con una lengüeta de 1 mm y una ranura de 3 mm que lo traban.

import { THREAD, femaleRadius, threadZs } from './thread.js';
import { polarRing, tubeFromRings } from '../../core/kernel/rings.js';

const TUBE_WALL = 2;
/** Tope interno donde apoya el portalámparas (mismo que el original: z 11,65 → 14,15). */
const STOP = { z0: 11.65, z1: 13.15, z2: 14.15, depth: 1.5 };
const EAR_TH = 6;
const EAR_REACH = 10.5;
const EAR_H = 24;
const SCREW_D = 4.5;
const NUT_FLATS = 7.4;
const NUT_DEPTH = 3.4;
/** Lengüeta del canal del cable (del original): 1 mm de espesor desde 10 mm antes del aro, ranura de 3 mm al costado. */
const LIP_X = 10;
const LIP_TH = 1;
const LIP_SLOT = 3;
/** Radio con que se redondea la esquina libre de la lengüeta (la del lado de la ranura, contra el aro). */
const LIP_ROUND = 3;

/**
 * @param {any} K
 * @param {(o:any)=>any} t  tracker de memoria
 * @param {ReturnType<import('./params.js').normalizeParams>} p
 * @param {{ segments:number }} density
 */
export function buildBase(K, t, p, density) {
  const T = THREAD;
  const S = Math.max(256, density.segments);
  const seg = Math.max(96, Math.round(S / 2));

  // ---- aro roscado (malla por anillos: la canaleta helicoidal sale exacta y rápida)
  const zs = threadZs(0, T.rimTopZ);
  const outerRing = polarRing(S, () => T.rimOuterR);
  const rim = t(
    tubeFromRings(
      K,
      zs,
      zs.map(() => outerRing),
      zs.map((z) => polarRing(S, (a) => femaleRadius(a, z))),
    ),
  );

  // ---- piso (queda por dentro del aro: la cara externa es solo la del aro)
  const floor = t(K.Manifold.cylinder(T.floorMm, T.boreR + 1.5, T.boreR + 1.5, S));

  // ---- tubo del portalámparas con su tope interno (perfil de revolución r, z)
  const ri = p.socketDiameterMm / 2;
  const ro = ri + TUBE_WALL;
  const H = p.socketHeightMm;
  const tubeProfile = [
    [ri, 0],
    [ro, 0],
    [ro, H],
    [ri, H],
    [ri, STOP.z2],
    [ri - STOP.depth, STOP.z2],
    [ri - STOP.depth, STOP.z1],
    [ri, STOP.z0],
  ];
  const tube = t(K.Manifold.revolve(t(new K.CrossSection([tubeProfile])), seg));

  const solids = [rim, floor, tube];

  // ---- orejas de la abrazadera (del lado +X, a los costados de la ranura)
  const slit = Math.min(10, p.socketDiameterMm * 0.3);
  const earX0 = Math.sqrt(Math.max(0, ri * ri - (slit / 2) ** 2));
  const earX1 = ro + EAR_REACH;
  const earZ0 = Math.max(T.floorMm, H - EAR_H);
  const screwX = ro + 5;
  const screwZ = H - 6;
  if (p.clampScrew) {
    // perfil en (x, z), con la panza de abajo a 45° para imprimir sin soportes
    const earCs = t(
      new K.CrossSection([
        [
          [earX0, earZ0],
          [earX1, earZ0 + (earX1 - earX0)],
          [earX1, H],
          [earX0, H],
        ],
      ]),
    );
    const ear = t(t(earCs.extrude(EAR_TH)).rotate([90, 0, 0])); // y ∈ [-EAR_TH, 0]
    solids.push(t(ear.translate([0, slit / 2 + EAR_TH, 0])), t(ear.translate([0, -slit / 2, 0])));
  }
  let base = t(K.Manifold.union(solids));

  // ---- cortes
  const box = (x0, x1, y0, y1, z0, z1) => t(t(K.Manifold.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
  const cuts = [
    // hueco central abierto por abajo (pasa el cable del portalámparas)
    t(t(K.Manifold.cylinder(T.floorMm + 2, ri, ri, seg)).translate([0, 0, -1])),
    // ranura del tubo: lo vuelve abrazadera y deja meter el cable de costado
    box(ri - 2, ro + 1, -slit / 2, slit / 2, -1, H + 1),
    // canal del cable por el piso, abierto de lado a lado hasta donde empieza la lengüeta…
    box(ri - 2, T.boreR - LIP_X, -slit / 2, slit / 2, -1, T.floorMm + 0.01),
    // …desde ahí el canal sigue hundido 1 mm y solo queda abierta la ranura de 3 mm al costado,
    box(T.boreR - LIP_X, T.rimOuterR + 2, -slit / 2, slit / 2, LIP_TH, T.floorMm + 0.01),
    box(T.boreR - LIP_X, T.rimOuterR + 2, slit / 2 - LIP_SLOT, slit / 2, -1, T.floorMm + 0.01),
    // y la salida por debajo del aro (la lengüeta se vuelve a sumar abajo, ya con su forma)
    box(T.boreR - 3, T.rimOuterR + 2, -slit / 2, slit / 2, -1, 4.2),
  ];
  if (p.clampScrew) {
    // agujero pasante del tornillo (eje Y) y alojamiento hexagonal de la tuerca en la oreja de -Y
    const screw = t(t(t(K.Manifold.cylinder(slit + 2 * EAR_TH + 4, SCREW_D / 2, SCREW_D / 2, 32, true)).rotate([90, 0, 0])).translate([screwX, 0, screwZ]));
    const nutR = NUT_FLATS / 2 / Math.cos(Math.PI / 6);
    // hexágono con un vértice hacia arriba: el techo del alojamiento se imprime sin soportes
    const hexCs = t(t(K.CrossSection.circle(nutR, 6)).rotate(90));
    const nut = t(t(t(hexCs.extrude(NUT_DEPTH + 1)).rotate([90, 0, 0])).translate([screwX, -(slit / 2 + EAR_TH) + NUT_DEPTH, screwZ]));
    cuts.push(screw, nut);
  }
  base = t(base.subtract(t(K.Manifold.union(cuts))));
  // lengüeta: la capa de abajo del canal sigue cerrada del lado opuesto a la ranura y termina redondeada
  // contra el borde del aro; el cable pasa por la ranura y el hundimiento lo protege y lo traba
  const tx0 = T.boreR - LIP_X;
  const tx1 = T.rimOuterR - 0.5;
  const ty0 = -slit / 2 - 1;
  const ty1 = slit / 2 - LIP_SLOT;
  const tabOutline = [[tx0, ty0], [tx1, ty0], [tx1, ty1 - LIP_ROUND]];
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * (Math.PI / 2);
    tabOutline.push([tx1 - LIP_ROUND + LIP_ROUND * Math.cos(a), ty1 - LIP_ROUND + LIP_ROUND * Math.sin(a)]);
  }
  tabOutline.push([tx0, ty1]);
  const tab = t(
    K.Manifold.intersection([
      t(t(new K.CrossSection([tabOutline])).extrude(LIP_TH)),
      t(K.Manifold.cylinder(LIP_TH, T.rimOuterR - 0.5, T.rimOuterR - 0.5, S)),
    ]),
  );
  base = t(K.Manifold.union([base, tab]));
  return { base, socketTopZ: H };
}
