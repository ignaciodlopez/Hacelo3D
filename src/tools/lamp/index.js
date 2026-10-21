// Definición de la herramienta "Lámpara": metadata, schema del panel y presets.
import { defaults, normalizeParams, PARAMS_VERSION } from './params.js';

const L = (es, en) => ({ es, en });
const hasShade = (p) => p.parts !== 'base';
const hasBase = (p) => p.parts !== 'shade';
const usesCount = (p) => ['waves', 'ribs', 'facets', 'bubbles', 'zigzag', 'star', 'scales', 'lattice', 'diamonds', 'fluted', 'honeycomb'].includes(p.pattern);
const usesDepth = (p) => !['smooth', 'facets'].includes(p.pattern);
const usesPeriod = (p) => ['rings', 'bubbles', 'zigzag', 'scales', 'lattice', 'diamonds', 'honeycomb'].includes(p.pattern);
const usesTwist = (p) => usesCount(p);

/** Cantidad, profundidad, separación y giro con los que cada textura se ve bien; se aplican al elegirla. */
const PATTERN_DEFAULTS = {
  waves: { patternCount: 18, patternDepthMm: 4, twistDeg: 120 },
  ribs: { patternCount: 24, patternDepthMm: 3, twistDeg: 0 },
  facets: { patternCount: 10, twistDeg: 72 },
  rings: { patternDepthMm: 2.5, patternPeriodMm: 16 },
  bubbles: { patternCount: 14, patternDepthMm: 4, patternPeriodMm: 22, twistDeg: 0 },
  zigzag: { patternCount: 16, patternDepthMm: 4, patternPeriodMm: 30, twistDeg: 0 },
  star: { patternCount: 8, patternDepthMm: 9, twistDeg: 180 },
  scales: { patternCount: 18, patternDepthMm: 3.5, patternPeriodMm: 16, twistDeg: 0 },
  lattice: { patternCount: 12, patternDepthMm: 3, patternPeriodMm: 40, twistDeg: 0 },
  honeycomb: { patternCount: 14, patternDepthMm: 3, patternPeriodMm: 20, twistDeg: 0 },
  diamonds: { patternCount: 6, patternDepthMm: 7.5, patternPeriodMm: 58, twistDeg: 0 },
  fluted: { patternCount: 100, patternDepthMm: 1.2, twistDeg: 0 },
};

export default {
  id: 'lamp',
  status: 'active',
  icon: 'lamp',
  filePrefix: 'lampara',
  name: L('Lámpara', 'Lamp'),
  short: L('Lámpara', 'Lamp'),
  description: L('Pantalla con forma y textura a elección que se enrosca en una base con portalámparas', 'A lampshade with the shape and texture you choose that screws onto a base with a socket holder'),
  paramsVersion: PARAMS_VERSION,
  migrate: (old) => old,
  normalize: normalizeParams,
  defaults,
  // al elegir un preset se conserva lo que depende de tu hardware y de cómo imprimís, no solo la forma
  presetKeep: ['parts', 'view', 'shadeMode', 'colors', 'threadFitMm', 'socketDiameterMm', 'socketHeightMm', 'clampScrew', 'curveQuality'],
  exports: ['stl-merged', 'zip-per-color', '3mf', 'png'],
  build: () => import('./build.js'),

  /** Resumen para el pedido por WhatsApp: pares [etiqueta, valor]. */
  orderSummary: (p, { lang, color, option }) => {
    const es = lang === 'es';
    return [
      [es ? 'Piezas' : 'Parts', option('parts', p.parts)],
      [es ? 'Textura' : 'Texture', option('pattern', p.pattern)],
      [es ? 'Alto' : 'Height', `${p.heightMm} mm`],
      [es ? 'Colores' : 'Colors', es ? `pantalla ${color(p.colors.shade)}, base ${color(p.colors.base)}` : `shade ${color(p.colors.shade)}, base ${color(p.colors.base)}`],
    ];
  },

  presets: [
    { id: 'twist', name: L('Ondas en espiral', 'Spiral waves'), params: {} },
    { id: 'globe', name: L('Globo', 'Globe'), params: { profile: 'curve', midDiameterMm: 190, midPosition: 0.5, topDiameterMm: 70, heightMm: 190, pattern: 'ribs', patternCount: 24, patternDepthMm: 3, twistDeg: 0 } },
    { id: 'cylinder', name: L('Cilindro facetado', 'Faceted cylinder'), params: { profile: 'straight', bottomDiameterMm: 120, topDiameterMm: 120, heightMm: 160, pattern: 'facets', patternCount: 10, twistDeg: 72 } },
    { id: 'cone', name: L('Cono con aros', 'Ringed cone'), params: { profile: 'straight', bottomDiameterMm: 170, topDiameterMm: 80, heightMm: 150, pattern: 'rings', patternDepthMm: 2.5, patternPeriodMm: 16 } },
    { id: 'hourglass', name: L('Reloj de arena', 'Hourglass'), params: { profile: 'curve', midDiameterMm: 100, midPosition: 0.5, topDiameterMm: 150, heightMm: 200, pattern: 'waves', patternCount: 12, patternDepthMm: 5, twistDeg: 180 } },
    { id: 'bubbles', name: L('Burbujas', 'Bubbles'), params: { profile: 'curve', midDiameterMm: 160, midPosition: 0.4, topDiameterMm: 110, heightMm: 170, pattern: 'bubbles', patternCount: 14, patternDepthMm: 4, patternPeriodMm: 22, twistDeg: 0 } },
    // el modo vaso NO es un preset: es una forma de imprimir (tiene su propio selector) y se conserva al cambiar de forma
    { id: 'zigzag', name: L('Zigzag', 'Zigzag'), params: { pattern: 'zigzag', patternCount: 16, patternDepthMm: 4, patternPeriodMm: 30, twistDeg: 0 } },
    { id: 'star', name: L('Picos en espiral', 'Spiral spikes'), params: { profile: 'straight', bottomDiameterMm: 130, topDiameterMm: 130, heightMm: 190, pattern: 'star', patternCount: 8, patternDepthMm: 9, twistDeg: 180 } },
    { id: 'scales', name: L('Escamas', 'Scales'), params: { profile: 'curve', midDiameterMm: 150, midPosition: 0.45, topDiameterMm: 100, heightMm: 190, pattern: 'scales', patternCount: 18, patternDepthMm: 3.5, patternPeriodMm: 16, twistDeg: 0 } },
    { id: 'lattice', name: L('Enrejado', 'Lattice'), params: { profile: 'straight', bottomDiameterMm: 125, topDiameterMm: 125, heightMm: 180, pattern: 'lattice', patternCount: 12, patternDepthMm: 3, patternPeriodMm: 40, twistDeg: 0 } },
    { id: 'honeycomb', name: L('Panal', 'Honeycomb'), params: { profile: 'curve', midDiameterMm: 150, midPosition: 0.5, topDiameterMm: 110, heightMm: 170, pattern: 'honeycomb', patternCount: 14, patternDepthMm: 3, patternPeriodMm: 20, twistDeg: 0 } },
    // réplicas de las pantallas "Diamonds" y "Sophie" de Kraken: 6 columnas de rombos de 58 mm y 100 estrías finas
    { id: 'diamonds', name: L('Diamantes', 'Diamonds'), params: { profile: 'straight', bottomDiameterMm: 112, topDiameterMm: 112, heightMm: 225, pattern: 'diamonds', patternCount: 6, patternDepthMm: 7.5, patternPeriodMm: 58, twistDeg: 0 } },
    { id: 'sophie', name: L('Sophie (estrías finas)', 'Sophie (fine ribs)'), params: { profile: 'vase', bottomDiameterMm: 116, midDiameterMm: 161, topDiameterMm: 127, heightMm: 218, pattern: 'fluted', patternCount: 100, patternDepthMm: 1.2, twistDeg: 0 } },
  ],

  schema: [
    {
      section: 'parts',
      title: L('Piezas', 'Parts'),
      controls: [
        { type: 'segmented', key: 'parts', options: [['both', L('Pantalla y base', 'Shade and base')], ['shade', L('Solo pantalla', 'Shade only')], ['base', L('Solo base', 'Base only')]] },
        {
          type: 'segmented',
          key: 'view',
          label: L('Vista', 'View'),
          showIf: (p) => p.parts === 'both',
          options: [['assembled', L('Armada', 'Assembled')], ['parts', L('Por piezas', 'Separate')]],
          hint: L('Solo cambia lo que ves: las descargas siempre traen cada pieza apoyada en la cama.', 'Only changes the view: downloads always have each part lying on the bed.'),
        },
      ],
    },
    {
      section: 'shape',
      title: L('Forma de la pantalla', 'Shade shape'),
      showIf: hasShade,
      controls: [
        { type: 'segmented', key: 'profile', options: [['curve', L('Curva', 'Curved')], ['straight', L('Recta', 'Straight')], ['vase', L('Florero', 'Vase')]] },
        { type: 'number', key: 'heightMm', label: L('Alto', 'Height'), unit: 'mm', min: 60, max: 320, step: 1 },
        { type: 'number', key: 'bottomDiameterMm', label: L('Diámetro abajo', 'Bottom diameter'), unit: 'mm', min: 112, max: 240, step: 1, tooltip: L('Con 116 mm queda al ras de la base. Más ancho, la pantalla se abre a 45° desde la rosca y ese tramo cuenta dentro del alto.', 'At 116 mm it is flush with the base. Wider, the shade flares out at 45° from the thread and that stretch counts toward the height.') },
        { type: 'number', key: 'midDiameterMm', label: L('Diámetro de la panza', 'Belly diameter'), unit: 'mm', min: 50, max: 260, step: 1, showIf: (p) => p.profile !== 'straight', tooltip: L('Más chico que los extremos hace una cintura. En el florero es el diámetro del tramo recto.', 'Smaller than the ends makes a waist. For the vase it is the diameter of the straight section.') },
        { type: 'slider', key: 'midPosition', label: L('Altura de la panza', 'Belly height'), min: 0.15, max: 0.85, step: 0.05, showIf: (p) => p.profile === 'curve' },
        { type: 'number', key: 'topDiameterMm', label: L('Diámetro arriba', 'Top diameter'), unit: 'mm', min: 30, max: 260, step: 1 },
      ],
    },
    {
      section: 'texture',
      title: L('Textura', 'Texture'),
      showIf: hasShade,
      controls: [
        {
          type: 'select',
          key: 'pattern',
          label: L('Textura', 'Texture'),
          alsoSet: (pattern) => PATTERN_DEFAULTS[pattern],
          options: [
            ['smooth', L('Lisa', 'Smooth')],
            ['waves', L('Ondas', 'Waves')],
            ['ribs', L('Gajos', 'Ribs')],
            ['facets', L('Facetas', 'Facets')],
            ['rings', L('Aros', 'Rings')],
            ['bubbles', L('Burbujas', 'Bubbles')],
            ['zigzag', L('Zigzag', 'Zigzag')],
            ['star', L('Picos', 'Spikes')],
            ['scales', L('Escamas', 'Scales')],
            ['lattice', L('Enrejado', 'Lattice')],
            ['honeycomb', L('Panal', 'Honeycomb')],
            ['diamonds', L('Diamantes', 'Diamonds')],
            ['fluted', L('Estrías finas (Sophie)', 'Fine ribs (Sophie)')],
          ],
          hint: L('La textura sobresale hacia afuera de la forma: las medidas de arriba son las del fondo de la textura.', 'The texture sticks out from the shape: the sizes above are measured at the bottom of the texture.'),
        },
        { type: 'number', key: 'patternCount', label: L('Cantidad', 'Count'), min: 3, max: 160, step: 1, showIf: usesCount, tooltip: L('Ondas, gajos, picos, escamas o celdas alrededor.', 'Waves, ribs, spikes, scales or cells around.') },
        { type: 'number', key: 'patternDepthMm', label: L('Profundidad', 'Depth'), unit: 'mm', min: 0.5, max: 15, step: 0.5, showIf: usesDepth },
        { type: 'number', key: 'patternPeriodMm', label: L('Separación vertical', 'Vertical spacing'), unit: 'mm', min: 6, max: 80, step: 1, showIf: usesPeriod },
        { type: 'slider', key: 'twistDeg', label: L('Giro', 'Twist'), unit: '°', min: -720, max: 720, step: 15, showIf: usesTwist, tooltip: L('Cuánto gira la textura de abajo hacia arriba.', 'How much the texture turns from bottom to top.') },
      ],
    },
    {
      section: 'print',
      title: L('Impresión de la pantalla', 'Shade printing'),
      showIf: hasShade,
      controls: [
        {
          type: 'segmented',
          key: 'shadeMode',
          options: [['wall', L('Pared normal', 'Normal walls')], ['vase', L('Modo vaso (espiral)', 'Vase mode (spiral)')]],
          hint: (p) =>
            p.shadeMode === 'vase'
              ? L('La pantalla se imprime en modo vaso: una sola línea en espiral, pared fina y pareja, más liviana y rápida. La rosca va incluida: se enrosca directo en la base.', 'The shade prints in vase mode: a single spiral line, thin even wall, lighter and faster. The thread is included: it screws straight onto the base.')
              : L('La pantalla se imprime con perímetros normales y el grosor de pared que elijas, más resistente. La rosca va incluida: se enrosca directo en la base.', 'The shade prints with normal perimeters and the wall thickness you choose, sturdier. The thread is included: it screws straight onto the base.'),
        },
        { type: 'number', key: 'wallMm', label: L('Grosor de pared', 'Wall thickness'), unit: 'mm', min: 0.6, max: 3, step: 0.1, showIf: (p) => p.shadeMode === 'wall', hint: L('Más fina deja pasar más luz. Lo ideal son 2 o 3 líneas de tu boquilla (con 0,4 mm: de 0,8 a 1,2 mm).', 'Thinner lets more light through. Ideally 2 or 3 lines of your nozzle (with 0.4 mm: 0.8 to 1.2 mm).') },
        { type: 'number', key: 'threadFitMm', label: L('Holgura de la rosca', 'Thread clearance'), unit: 'mm', min: -0.2, max: 0.6, step: 0.05, advanced: true, hint: L('Es el juego entre las dos piezas roscadas. Subila si la pantalla entra dura; bajala si queda floja.', 'The play between the two threaded parts. Raise it if the shade is hard to screw in; lower it if it is loose.') },
      ],
    },
    {
      section: 'base',
      title: L('Base', 'Base'),
      showIf: hasBase,
      controls: [
        { type: 'number', key: 'socketDiameterMm', label: L('Diámetro del portalámparas', 'Socket diameter'), unit: 'mm', min: 25, max: 45, step: 0.5, hint: L('Medí la parte más ancha de tu portalámparas (E27 de plástico: ~37 mm).', 'Measure the widest part of your socket (plastic E27: ~37 mm).') },
        { type: 'number', key: 'socketHeightMm', label: L('Alto del tubo', 'Tube height'), unit: 'mm', min: 30, max: 70, step: 1 },
        { type: 'checkbox', key: 'clampScrew', label: L('Abrazadera con tornillo M4', 'M4 screw clamp'), tooltip: L('Orejas con agujero y alojamiento para la tuerca: aprietan el portalámparas.', 'Ears with a hole and a nut pocket: they clamp the socket.') },
      ],
    },
    {
      section: 'colors',
      title: L('Colores', 'Colors'),
      controls: [
        { type: 'color', key: 'colors.shade', label: L('Pantalla', 'Shade'), showIf: hasShade },
        { type: 'color', key: 'colors.base', label: L('Base', 'Base'), showIf: hasBase },
      ],
    },
    {
      section: 'quality',
      collapsed: true,
      title: L('Calidad', 'Quality'),
      controls: [{ type: 'select', key: 'curveQuality', label: L('Calidad de la malla', 'Mesh quality'), options: [['draft', L('Borrador (rápido)', 'Draft (fast)')], ['normal', L('Normal', 'Normal')], ['high', L('Alta', 'High')]] }],
    },
  ],
};
