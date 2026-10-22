// Definición de la herramienta "Mate": metadata, schema del panel y presets.
import { defaults, normalizeParams, PARAMS_VERSION } from './params.js';
import { usesCount, usesDepth, usesPeriod, usesTwist, PATTERN_DEFAULTS } from '../../core/kernel/surface.js';

const L = (es, en) => ({ es, en });
const custom = (p) => p.profile !== 'follow';

/** Lo que cada preset NO pisa: el color, el interior (es el que tenés en la mano) y la calidad. */
const KEEP = [
  'colors',
  'insertHeightMm',
  'insertBaseDiameterMm',
  'insertBodyDiameterMm',
  'insertMouthDiameterMm',
  'insertFlareHeightMm',
  'insertBaseRadiusMm',
  'clearanceMm',
  'rimMode',
  'rimLipMm',
  'wallMm',
  'selfSupport',
  'overhangDeg',
  'curveQuality',
];

export default {
  id: 'mate',
  status: 'active',
  icon: 'mate',
  filePrefix: 'mate',
  name: L('Mate', 'Mate gourd'),
  short: L('Mate', 'Mate'),
  description: L('Mate con forma y textura a elección, con el hueco justo para el interior de aluminio', 'A mate gourd with the shape and texture you choose, with a pocket sized for the aluminum insert'),
  paramsVersion: PARAMS_VERSION,
  migrate: (old) => old,
  normalize: normalizeParams,
  defaults,
  presetKeep: KEEP,
  exports: ['stl-merged', 'png'],
  build: () => import('./build.js'),

  /** Resumen para el pedido por WhatsApp: pares [etiqueta, valor]. */
  orderSummary: (p, { lang, color, option }) => {
    const es = lang === 'es';
    return [
      [es ? 'Forma' : 'Shape', option('profile', p.profile)],
      [es ? 'Textura' : 'Texture', option('pattern', p.pattern)],
      [es ? 'Alto' : 'Height', `${p.heightMm} mm`],
      [es ? 'Borde del interior' : 'Insert rim', option('rimMode', p.rimMode)],
      [es ? 'Color' : 'Color', color(p.colors.body)],
    ];
  },

  presets: [
    { id: 'pumpkin', name: L('Calabaza con gajos', 'Ribbed pumpkin'), params: {} },
    { id: 'smooth', name: L('Calabaza lisa', 'Smooth pumpkin'), params: { profile: 'curve', pattern: 'smooth' } },
    { id: 'imperial', name: L('Imperial', 'Imperial'), params: { profile: 'straight', bottomDiameterMm: 66, topDiameterMm: 98, heightMm: 100, pattern: 'smooth' } },
    { id: 'truck', name: L('Camionero', 'Trucker'), params: { profile: 'vase', bottomDiameterMm: 74, midDiameterMm: 98, topDiameterMm: 96, heightMm: 110, pattern: 'fluted', patternCount: 100, patternDepthMm: 1.2, twistDeg: 0 } },
    { id: 'twist', name: L('Ondas en espiral', 'Spiral waves'), params: { profile: 'curve', pattern: 'waves', patternCount: 18, patternDepthMm: 3.5, twistDeg: 120 } },
    { id: 'facets', name: L('Facetado', 'Faceted'), params: { profile: 'straight', bottomDiameterMm: 72, topDiameterMm: 98, heightMm: 95, pattern: 'facets', patternCount: 10, twistDeg: 72 } },
    { id: 'scales', name: L('Escamas', 'Scales'), params: { profile: 'curve', pattern: 'scales', patternCount: 18, patternDepthMm: 3, patternPeriodMm: 14, twistDeg: 0 } },
    { id: 'honeycomb', name: L('Panal', 'Honeycomb'), params: { profile: 'curve', pattern: 'honeycomb', patternCount: 14, patternDepthMm: 2.5, patternPeriodMm: 20, twistDeg: 0 } },
    { id: 'diamonds', name: L('Diamantes', 'Diamonds'), params: { profile: 'straight', bottomDiameterMm: 98, topDiameterMm: 98, heightMm: 105, pattern: 'diamonds', patternCount: 8, patternDepthMm: 4, patternPeriodMm: 36, twistDeg: 0 } },
    { id: 'slim', name: L('Ajustado al interior (mínimo material)', 'Fitted to the insert (least material)'), params: { profile: 'follow', pattern: 'fluted', patternCount: 90, patternDepthMm: 1.2, twistDeg: 0, heightMm: 74 } },
  ],

  schema: [
    {
      section: 'insert',
      title: L('Interior de aluminio', 'Aluminum insert'),
      controls: [
        {
          type: 'segmented',
          key: 'rimMode',
          label: L('Borde del interior', 'Insert rim'),
          options: [['flush', L('Al ras', 'Flush')], ['rest', L('Apoyado encima', 'Resting on top')]],
          hint: (p) =>
            p.rimMode === 'flush'
              ? L('El hueco es el negativo completo: la boca del interior queda al ras del borde del mate.', 'The pocket is the full negative: the mouth of the insert ends flush with the rim of the mate.')
              : L('El borde enrollado del interior queda por arriba y se apoya sobre el mate: cuelga de ahí.', 'The rolled rim of the insert sits above and rests on the mate: it hangs from there.'),
        },
        { type: 'number', key: 'clearanceMm', label: L('Holgura', 'Clearance'), unit: 'mm', min: 0, max: 1.5, step: 0.05, hint: L('Juego entre el interior y el hueco, por lado y también bajo el fondo. Con 0,2 entra justo; subila si entra duro, bajala si queda flojo.', 'Play between the insert and the pocket, per side and also under the bottom. 0.2 is a snug fit; raise it if it goes in hard, lower it if it is loose.') },
        { type: 'number', key: 'insertHeightMm', label: L('Alto del interior', 'Insert height'), unit: 'mm', min: 30, max: 150, step: 0.5, advanced: true },
        { type: 'number', key: 'insertBaseDiameterMm', label: L('Diámetro de la base', 'Base diameter'), unit: 'mm', min: 20, max: 120, step: 0.5, advanced: true },
        { type: 'number', key: 'insertBodyDiameterMm', label: L('Diámetro del cuerpo', 'Body diameter'), unit: 'mm', min: 20, max: 120, step: 0.5, advanced: true, tooltip: L('Donde empieza la campana. Medilo con calibre: es lo que más importa para que entre.', 'Where the flare begins. Measure it with calipers: it matters most for the fit.') },
        { type: 'number', key: 'insertMouthDiameterMm', label: L('Diámetro de la boca', 'Mouth diameter'), unit: 'mm', min: 20, max: 140, step: 0.5, advanced: true, tooltip: L('Medido en el borde enrollado, que es lo más ancho.', 'Measured at the rolled rim, which is the widest point.') },
        { type: 'number', key: 'insertFlareHeightMm', label: L('Alto de la campana', 'Flare height'), unit: 'mm', min: 2, max: 60, step: 0.5, advanced: true },
        { type: 'number', key: 'insertBaseRadiusMm', label: L('Redondeo del fondo', 'Bottom rounding'), unit: 'mm', min: 0, max: 10, step: 0.5, advanced: true },
        { type: 'number', key: 'rimLipMm', label: L('Borde que sobresale', 'Rim that sticks out'), unit: 'mm', min: 0.5, max: 8, step: 0.5, advanced: true, showIf: (p) => p.rimMode === 'rest' },
      ],
    },
    {
      section: 'shape',
      title: L('Forma del mate', 'Mate shape'),
      controls: [
        { type: 'segmented', key: 'profile', options: [['curve', L('Calabaza', 'Pumpkin')], ['straight', L('Recta', 'Straight')], ['vase', L('Florero', 'Vase')], ['follow', L('Ajustada', 'Fitted')]] },
        { type: 'number', key: 'heightMm', label: L('Alto', 'Height'), unit: 'mm', min: 40, max: 220, step: 1, tooltip: L('El interior queda arriba y debajo hay base maciza. Si es muy bajo se sube solo para dejar al menos 3 mm de base.', 'The insert sits on top with a solid base below. If it is too low it is raised to leave at least 3 mm of base.') },
        { type: 'number', key: 'bottomDiameterMm', label: L('Diámetro abajo', 'Bottom diameter'), unit: 'mm', min: 30, max: 220, step: 1, showIf: custom },
        { type: 'number', key: 'midDiameterMm', label: L('Diámetro de la panza', 'Belly diameter'), unit: 'mm', min: 30, max: 240, step: 1, showIf: (p) => p.profile === 'curve' || p.profile === 'vase', tooltip: L('En el florero es el diámetro del tramo recto.', 'For the vase it is the diameter of the straight section.') },
        { type: 'slider', key: 'midPosition', label: L('Altura de la panza', 'Belly height'), min: 0.15, max: 0.85, step: 0.05, showIf: (p) => p.profile === 'curve' },
        { type: 'number', key: 'topDiameterMm', label: L('Diámetro arriba', 'Top diameter'), unit: 'mm', min: 30, max: 240, step: 1, showIf: custom, hint: L('Si algún diámetro deja menos pared que la mínima alrededor del interior, la forma se ensancha sola en ese tramo.', 'If a diameter would leave less than the minimum wall around the insert, the shape widens by itself there.') },
        { type: 'number', key: 'wallMm', label: L('Pared mínima', 'Minimum wall'), unit: 'mm', min: 1.2, max: 10, step: 0.2, tooltip: L('Grosor real (perpendicular a la cara) entre el hueco y el valle de la textura; donde el hueco se abre en campana la pared se engrosa en horizontal para mantenerlo. Lo ideal son 3 o más líneas de tu boquilla.', 'True thickness (perpendicular to the face) between the pocket and the valley of the texture; where the pocket flares the wall thickens horizontally to keep it. Ideally 3 or more lines of your nozzle.') },
      ],
    },
    {
      section: 'print',
      title: L('Impresión', 'Printing'),
      controls: [
        {
          type: 'checkbox',
          key: 'selfSupport',
          label: L('Sin soportes (voladizos autoportantes)', 'No supports (self-supporting overhangs)'),
          tooltip: L('Donde la forma o la textura volaría más del ángulo elegido, se rellena por debajo con una rampa de ese ángulo. La pieza queda más maciza justo donde cuelga, así que también es más resistente.', 'Where the shape or texture would overhang more than the chosen angle, it is filled underneath with a ramp at that angle. The part is more solid right where it hangs, so it is also stronger.'),
        },
        { type: 'number', key: 'overhangDeg', label: L('Ángulo máximo de voladizo', 'Maximum overhang angle'), unit: '°', min: 20, max: 55, step: 1, showIf: (p) => p.selfSupport, advanced: true, hint: L('Medido desde la vertical. 40° sale prolijo en casi cualquier impresora; con 45° o más puede quedar rugoso abajo de la campana.', 'Measured from the vertical. 40° prints cleanly on almost any printer; 45° or more may look rough under the flare.') },
      ],
    },
    {
      section: 'texture',
      title: L('Textura', 'Texture'),
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
            ['fluted', L('Estrías finas', 'Fine ribs')],
          ],
          hint: L('La textura sobresale hacia afuera de la forma: la pared mínima se mide en el fondo de la textura.', 'The texture sticks out from the shape: the minimum wall is measured at the bottom of the texture.'),
        },
        { type: 'number', key: 'patternCount', label: L('Cantidad', 'Count'), min: 3, max: 160, step: 1, showIf: usesCount, tooltip: L('Ondas, gajos, picos, escamas o celdas alrededor.', 'Waves, ribs, spikes, scales or cells around.') },
        { type: 'number', key: 'patternDepthMm', label: L('Profundidad', 'Depth'), unit: 'mm', min: 0.5, max: 12, step: 0.5, showIf: usesDepth },
        { type: 'number', key: 'patternPeriodMm', label: L('Separación vertical', 'Vertical spacing'), unit: 'mm', min: 6, max: 80, step: 1, showIf: usesPeriod },
        { type: 'slider', key: 'twistDeg', label: L('Giro', 'Twist'), unit: '°', min: -720, max: 720, step: 15, showIf: usesTwist, tooltip: L('Cuánto gira la textura de abajo hacia arriba.', 'How much the texture turns from bottom to top.') },
      ],
    },
    {
      section: 'colors',
      title: L('Color', 'Color'),
      controls: [{ type: 'color', key: 'colors.body', label: L('Mate', 'Mate') }],
    },
    {
      section: 'quality',
      collapsed: true,
      title: L('Calidad', 'Quality'),
      controls: [{ type: 'select', key: 'curveQuality', label: L('Calidad de la malla', 'Mesh quality'), options: [['draft', L('Borrador (rápido)', 'Draft (fast)')], ['normal', L('Normal', 'Normal')], ['high', L('Alta', 'High')]] }],
    },
  ],
};
