// Definición de la herramienta "Para tus herramientas": metadata, schema del panel y presets.
// Una sola herramienta con cuatro tipos (estuche porta mechas, caja con divisiones, soporte de mechas, porta puntas) que
// comparten el logo y los colores.
import { defaults, normalizeParams, parseDrillSizes, brandColors, PARAMS_VERSION } from './params.js';

const L = (es, en) => ({ es, en });
const isKind = (kind) => (p) => p.kind === kind;
const isHolder = (p) => p.kind === 'drills' || p.kind === 'bits';
const isCase = (p) => p.kind === 'case';
const hasLogo = (p) => !!p.logo;

/** Lo que cada preset NO pisa: el logo, sus medidas, los colores y las varillas que tenés. */
const KEEP = ['logo', 'logoStyle', 'logoSizePct', 'logoDepthMm', 'colors', 'pinMm', 'pinClearanceMm', 'latchSnapMm', 'caseView', 'curveQuality', 'snapToLayers'];

const LOGO_HINT_COLORS = L(
  'De otro color comparte capas con la pieza: necesita AMS / multicolor. Del mismo color, o grabado, se imprime sin cambios.',
  'In another color it shares layers with the piece: it needs an AMS / multicolor. In the same color, or engraved, it prints without changes.',
);

/** Colores para el pedido: "rojo con logo blanco y trabas negro". */
function colorsText(p, es, color) {
  const extra = [];
  if (p.logo && p.logoStyle !== 'engraved' && p.colors.logo !== p.colors.base) extra.push(es ? `logo ${color(p.colors.logo)}` : `${color(p.colors.logo)} logo`);
  if (isCase(p)) extra.push(es ? `trabas ${color(p.colors.latch)}` : `${color(p.colors.latch)} latches`);
  return extra.length ? `${color(p.colors.base)} ${es ? 'con' : 'with'} ${extra.join(es ? ' y ' : ' and ')}` : color(p.colors.base);
}

export default {
  id: 'organizer',
  status: 'active',
  icon: 'wrench',
  filePrefix: 'organizador',
  name: L('Para tus herramientas', 'For your tools'),
  short: L('Taller', 'Tools'),
  description: L('Estuches porta mechas, cajas para tornillos y porta puntas, con el logo de tu marca', 'Drill bit cases, screw boxes and bit holders, with your brand logo'),
  paramsVersion: PARAMS_VERSION,
  migrate: (old) => old,
  normalize: normalizeParams,
  defaults,
  presetKeep: KEEP,
  exports: ['stl-merged', 'zip-per-color', '3mf', 'png'],
  build: () => import('./build.js'),

  /** Resumen para el pedido por WhatsApp: pares [etiqueta, valor]. */
  orderSummary: (p, { lang, color, option, logo = (id) => id }) => {
    const es = lang === 'es';
    const mm = (n) => (es ? String(n).replace('.', ',') : String(n));
    let detail;
    if (p.kind === 'case') {
      detail = `${mm(p.caseLengthMm)} × ${mm(p.caseWidthMm)} × ${mm(p.caseHeightMm + p.lidHeightMm)} mm`;
    } else if (p.kind === 'box') {
      detail = `${mm(p.boxWidthMm)} × ${mm(p.boxDepthMm)} × ${mm(p.boxHeightMm)} mm, ${p.boxCols * p.boxRows} ${es ? 'divisiones' : 'compartments'} (${p.boxCols} × ${p.boxRows})`;
    } else if (p.kind === 'drills') {
      detail = `${parseDrillSizes(p.drillSizes).sizes.map(mm).join(' · ')} mm`;
    } else {
      detail = `${p.bitCols * p.bitRows} ${es ? 'puntas' : 'bits'} (${p.bitRows} × ${p.bitCols})`;
    }
    return [
      [es ? 'Tipo' : 'Type', option('kind', p.kind)],
      [es ? 'Medidas' : 'Sizes', detail],
      [es ? 'Logo' : 'Logo', p.logo ? `${logo(p.logo)} (${option('logoStyle', p.logoStyle).toLowerCase()})` : ''],
      [es ? 'Colores' : 'Colors', colorsText(p, es, color)],
    ];
  },

  presets: [
    { id: 'case', name: L('Estuche porta mechas (22 cm)', 'Drill bit case (22 cm)'), params: {} },
    { id: 'case-small', name: L('Estuche chico (15 cm)', 'Small case (15 cm)'), params: { caseLengthMm: 150, caseWidthMm: 60, caseHeightMm: 45, lidHeightMm: 18 } },
    { id: 'case-big', name: L('Estuche grande (25 cm)', 'Large case (25 cm)'), params: { caseLengthMm: 250, caseWidthMm: 90, caseHeightMm: 65, lidHeightMm: 22 } },
    { id: 'screws', name: L('Caja para tornillos (6 divisiones)', 'Screw box (6 compartments)'), params: { kind: 'box' } },
    { id: 'small', name: L('Caja para piezas chicas (12 divisiones)', 'Small parts box (12 compartments)'), params: { kind: 'box', boxWidthMm: 120, boxDepthMm: 90, boxHeightMm: 30, boxCols: 4, boxRows: 3, scoopRadiusMm: 9 } },
    { id: 'nails', name: L('Caja honda para clavos y tarugos', 'Deep box for nails and wall plugs'), params: { kind: 'box', boxWidthMm: 150, boxDepthMm: 90, boxHeightMm: 60, boxCols: 2, boxRows: 1, scoopRadiusMm: 18 } },
    { id: 'drills', name: L('Soporte de mechas 3 a 10 mm', 'Drill stand 3 to 10 mm'), params: { kind: 'drills' } },
    {
      id: 'drills-full',
      name: L('Soporte de mechas 1 a 10 mm (cada 0,5)', 'Drill stand 1 to 10 mm (every 0.5)'),
      params: { kind: 'drills', drillSizes: '1 1,5 2 2,5 3 3,5 4 4,5 5 5,5 6 6,5 7 7,5 8 8,5 9 9,5 10', drillRows: 2, drillDepthMm: 20 },
    },
    { id: 'bits', name: L('Porta puntas (20)', 'Bit holder (20)'), params: { kind: 'bits' } },
    { id: 'bits-30', name: L('Porta puntas (30, tres filas)', 'Bit holder (30, three rows)'), params: { kind: 'bits', bitRows: 3, bitCols: 10 } },
  ],

  schema: [
    {
      section: 'kind',
      title: L('Qué querés hacer', 'What to make'),
      controls: [
        {
          type: 'select',
          key: 'kind',
          label: L('Tipo', 'Type'),
          options: [
            ['case', L('Estuche porta mechas', 'Drill bit case')],
            ['box', L('Caja con divisiones', 'Divided box')],
            ['drills', L('Soporte de mechas', 'Drill stand')],
            ['bits', L('Porta puntas', 'Bit holder')],
          ],
          // en la tapa del estuche el logo no puede sobresalir (la tapa se imprime dada vuelta): pasa a "al ras"
          alsoSet: (v, p) => (v === 'case' && p.logoStyle === 'relief' ? { logoStyle: 'flush' } : {}),
        },
      ],
    },
    {
      section: 'case',
      title: L('Estuche', 'Case'),
      showIf: isCase,
      controls: [
        { type: 'number', key: 'caseLengthMm', label: L('Largo', 'Length'), unit: 'mm', min: 80, max: 350, step: 5, hint: L('Para mechas largas (SDS) de hasta el largo menos 1 cm.', 'For long (SDS) bits up to the length minus 1 cm.') },
        { type: 'number', key: 'caseWidthMm', label: L('Ancho', 'Width'), unit: 'mm', min: 40, max: 160, step: 5 },
        { type: 'number', key: 'caseHeightMm', label: L('Alto de la caja', 'Box height'), unit: 'mm', min: 20, max: 120, step: 5 },
        { type: 'number', key: 'lidHeightMm', label: L('Alto de la tapa', 'Lid height'), unit: 'mm', min: 12, max: 60, step: 1 },
        {
          type: 'segmented',
          key: 'caseView',
          options: [['closed', L('Cerrado', 'Closed')], ['print', L('Para imprimir', 'Print layout')]],
          tooltip: L('Cerrado muestra cómo queda armado; "para imprimir" muestra las piezas como van en la cama (la tapa dada vuelta). Las descargas son siempre las piezas para imprimir.', 'Closed shows it assembled; "print layout" shows the parts as they go on the bed (the lid upside down). Downloads are always the print parts.'),
        },
        {
          type: 'number',
          key: 'pinMm',
          label: L('Diámetro de los pernos', 'Pin diameter'),
          unit: 'mm',
          min: 2.4,
          max: 5,
          step: 0.2,
          advanced: true,
          tooltip: L('Bisagras y trabas giran en pernos impresos que encastran en ganchos en C: no lleva piezas de metal.', 'Hinges and latches turn on printed pins that snap into C hooks: no metal parts.'),
        },
        { type: 'number', key: 'pinClearanceMm', label: L('Juego de los pernos', 'Pin clearance'), unit: 'mm', min: 0, max: 1, step: 0.05, advanced: true, tooltip: L('Lo que sobra alrededor del perno para que gire suave.', 'Room around the pin so it turns smoothly.') },
        {
          type: 'number',
          key: 'latchSnapMm',
          label: L('Ajuste de los encastres', 'Snap fit'),
          unit: 'mm',
          min: 0,
          max: 1,
          step: 0.05,
          advanced: true,
          tooltip: L('Cuánto más angosta que el perno es la boca de cada C (bisagras y trabas): más, encastra más firme pero cuesta más armar y abrir.', 'How much narrower than the pin the mouth of each C is (hinges and latches): more snaps firmer but is harder to assemble and open.'),
        },
        { type: 'number', key: 'caseWallMm', label: L('Pared', 'Wall'), unit: 'mm', min: 1.6, max: 4, step: 0.2, advanced: true },
      ],
    },
    {
      section: 'box',
      title: L('Caja', 'Box'),
      showIf: isKind('box'),
      controls: [
        { type: 'number', key: 'boxWidthMm', label: L('Ancho', 'Width'), unit: 'mm', min: 30, max: 300, step: 5 },
        { type: 'number', key: 'boxDepthMm', label: L('Profundidad', 'Depth'), unit: 'mm', min: 30, max: 300, step: 5 },
        { type: 'number', key: 'boxHeightMm', label: L('Alto', 'Height'), unit: 'mm', min: 10, max: 150, step: 5 },
        { type: 'number', key: 'boxCols', label: L('Divisiones a lo ancho', 'Compartments across'), min: 1, max: 12, step: 1 },
        { type: 'number', key: 'boxRows', label: L('Divisiones a lo profundo', 'Compartments deep'), min: 1, max: 12, step: 1 },
        {
          type: 'checkbox',
          key: 'scoop',
          label: L('Fondo redondeado adelante', 'Rounded front bottom'),
          tooltip: L('Una curva entre el fondo y la pared de adelante de cada división: los tornillos chicos salen deslizando el dedo.', 'A curve between the floor and the front wall of each compartment: small screws slide out with a finger.'),
        },
        { type: 'number', key: 'scoopRadiusMm', label: L('Radio de la curva', 'Curve radius'), unit: 'mm', min: 3, max: 40, step: 1, advanced: true, showIf: (p) => p.scoop },
        {
          type: 'slider',
          key: 'dividerHeightPct',
          label: L('Alto de las divisiones', 'Divider height'),
          unit: '%',
          min: 30,
          max: 100,
          step: 5,
          advanced: true,
          tooltip: L('Más bajas que las paredes dejan pasar la mano de una división a otra.', 'Lower than the walls lets your hand move between compartments.'),
        },
        { type: 'number', key: 'wallMm', label: L('Pared', 'Wall'), unit: 'mm', min: 0.8, max: 5, step: 0.2, advanced: true },
        { type: 'number', key: 'dividerMm', label: L('Grosor de las divisiones', 'Divider thickness'), unit: 'mm', min: 0.8, max: 5, step: 0.2, advanced: true },
        { type: 'number', key: 'floorMm', label: L('Fondo', 'Floor'), unit: 'mm', min: 0.6, max: 5, step: 0.2, advanced: true },
        { type: 'number', key: 'cornerRadiusMm', label: L('Esquinas redondeadas', 'Rounded corners'), unit: 'mm', min: 0, max: 20, step: 1, advanced: true },
      ],
    },
    {
      section: 'drills',
      title: L('Mechas', 'Drill bits'),
      showIf: isKind('drills'),
      controls: [
        {
          type: 'text',
          key: 'drillSizes',
          label: L('Medidas (mm)', 'Sizes (mm)'),
          maxLength: 200,
          placeholder: '3 4 5 6 8 10',
          hint: L('Separadas por espacios, de 1 a 25 mm. Conviene de la más chica a la más grande.', 'Separated by spaces, 1 to 25 mm. Smallest to largest works best.'),
        },
        { type: 'segmented', key: 'drillRows', label: L('Filas', 'Rows'), options: [[1, '1'], [2, '2'], [3, '3'], [4, '4']], tooltip: L('Cada fila va un escalón más alta que la de adelante.', 'Each row is one step higher than the one in front.') },
        { type: 'number', key: 'drillDepthMm', label: L('Profundidad de los agujeros', 'Hole depth'), unit: 'mm', min: 5, max: 80, step: 1 },
        { type: 'checkbox', key: 'drillLabels', label: L('Medida grabada adelante de cada agujero', 'Size engraved in front of each hole') },
        {
          type: 'number',
          key: 'drillClearanceMm',
          label: L('Holgura', 'Clearance'),
          unit: 'mm',
          min: 0,
          max: 1.5,
          step: 0.05,
          advanced: true,
          tooltip: L('Se suma al diámetro de cada agujero: los agujeros impresos salen un poco más chicos.', 'Added to each hole diameter: printed holes come out a bit smaller.'),
        },
      ],
    },
    {
      section: 'bits',
      title: L('Puntas', 'Bits'),
      showIf: isKind('bits'),
      controls: [
        { type: 'number', key: 'bitCols', label: L('Puntas por fila', 'Bits per row'), min: 1, max: 30, step: 1 },
        { type: 'number', key: 'bitRows', label: L('Filas', 'Rows'), min: 1, max: 6, step: 1, tooltip: L('Cada fila va un escalón más alta que la de adelante.', 'Each row is one step higher than the one in front.') },
        { type: 'number', key: 'bitDepthMm', label: L('Profundidad de los agujeros', 'Hole depth'), unit: 'mm', min: 4, max: 30, step: 1, hint: L('Para puntas de 1/4" (hexágono de 6,35 mm).', 'For 1/4" bits (6.35 mm hexagon).') },
        { type: 'number', key: 'bitClearanceMm', label: L('Holgura', 'Clearance'), unit: 'mm', min: 0, max: 1, step: 0.05, advanced: true, tooltip: L('Se suma al hexágono: más holgura, la punta entra más suelta.', 'Added to the hexagon: more clearance, looser fit.') },
      ],
    },
    {
      section: 'holder',
      title: L('Bloque', 'Block'),
      showIf: isHolder,
      collapsed: true,
      controls: [
        { type: 'number', key: 'gapMm', label: L('Separación entre agujeros', 'Space between holes'), unit: 'mm', min: 1.5, max: 15, step: 0.5 },
        { type: 'number', key: 'stepMm', label: L('Alto de cada escalón', 'Step height'), unit: 'mm', min: 0, max: 40, step: 1, tooltip: L('Cuánto más alta va cada fila que la de adelante (0 = todas iguales).', 'How much higher each row is than the one in front (0 = all the same).') },
      ],
    },
    {
      section: 'logo',
      title: L('Logo de la marca', 'Brand logo'),
      controls: [
        {
          type: 'iconSelect',
          catalog: 'logos',
          key: 'logo',
          label: L('Marca', 'Brand'),
          inline: true,
          // al elegir una marca se aplican sus colores (se pueden cambiar después)
          alsoSet: (v, p) => (v ? { colors: brandColors(v, p.colors) } : {}),
        },
        {
          type: 'segmented',
          key: 'logoStyle',
          showIf: (p) => hasLogo(p) && !isCase(p),
          options: [['relief', L('Sobresale', 'Raised')], ['flush', L('Al ras', 'Flush')], ['engraved', L('Grabado', 'Engraved')]],
          hint: LOGO_HINT_COLORS,
        },
        // en el estuche el logo va en la tapa, que se imprime con esa cara contra la cama: no puede sobresalir
        { type: 'segmented', key: 'logoStyle', showIf: (p) => hasLogo(p) && isCase(p), options: [['flush', L('Al ras', 'Flush')], ['engraved', L('Grabado', 'Engraved')]], hint: LOGO_HINT_COLORS },
        { type: 'slider', key: 'logoSizePct', label: L('Tamaño del logo', 'Logo size'), unit: '%', min: 20, max: 100, step: 1, showIf: hasLogo, tooltip: L('Qué parte del lugar libre ocupa (la tapa, o el frente de la pieza).', 'How much of the free space it takes (the lid, or the front of the piece).') },
        { type: 'number', key: 'logoDepthMm', label: L('Relieve / profundidad', 'Relief / depth'), unit: 'mm', min: 0.4, max: 3, step: 0.2, showIf: hasLogo, advanced: true },
      ],
    },
    {
      section: 'colors',
      title: L('Colores', 'Colors'),
      controls: [
        { type: 'color', key: 'colors.base', label: L('Pieza', 'Piece') },
        { type: 'color', key: 'colors.logo', label: L('Logo', 'Logo'), showIf: (p) => hasLogo(p) && p.logoStyle !== 'engraved' },
        { type: 'color', key: 'colors.latch', label: L('Trabas', 'Latches'), showIf: isCase },
      ],
    },
    {
      section: 'quality',
      collapsed: true,
      title: L('Calidad', 'Quality'),
      controls: [
        { type: 'select', key: 'curveQuality', label: L('Calidad de curvas', 'Curve quality'), options: [['draft', L('Borrador (rápido)', 'Draft (fast)')], ['normal', L('Normal', 'Normal')], ['high', L('Alta', 'High')]] },
        { type: 'checkbox', key: 'snapToLayers', label: L('Alinear alturas a la altura de capa', 'Snap heights to layer height'), tooltip: L('Evita capas raras.', 'Avoids odd layers.') },
      ],
    },
  ],
};
