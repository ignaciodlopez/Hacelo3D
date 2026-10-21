// Definición de la herramienta "Adorno navideño": metadata, schema del panel y presets.
import { defaults, normalizeParams, PARAMS_VERSION } from './params.js';

const L = (es, en) => ({ es, en });
const hasDeco = (p) => p.decoration !== 'none';

/** Lo que cada preset NO pisa: el nombre, la fuente, los colores y las medidas de tu hardware. */
const KEEP = ['name', 'fontId', 'uppercase', 'colors', 'loopHoleMm', 'loopWallMm', 'curveQuality', 'snapToLayers'];

export default {
  id: 'ornament',
  status: 'active',
  icon: 'ornament',
  filePrefix: 'adorno',
  name: L('Adorno navideño', 'Christmas ornament'),
  short: L('Adorno', 'Ornament'),
  description: L('Esfera con tu nombre y copos de nieve, lista para colgar del árbol', 'Bauble with your name and snowflakes, ready to hang on the tree'),
  paramsVersion: PARAMS_VERSION,
  migrate: (old) => old,
  normalize: normalizeParams,
  defaults,
  presetKeep: KEEP,
  exports: ['stl-merged', 'zip-per-color', '3mf', 'png'],
  build: () => import('./build.js'),

  /** Resumen para el pedido por WhatsApp: pares [etiqueta, valor]. */
  orderSummary: (p, { lang, color }) => {
    const es = lang === 'es';
    const deco = {
      snow: es ? 'copos de nieve' : 'snowflakes',
      stars: es ? 'estrellas' : 'stars',
      hearts: es ? 'corazones' : 'hearts',
      trees: es ? 'arbolitos' : 'trees',
      bells: es ? 'campanas' : 'bells',
      snowmen: es ? 'muñecos de nieve' : 'snowmen',
      none: es ? 'sin adornos' : 'no decorations',
    }[p.decoration];
    return [
      [es ? 'Nombre' : 'Name', p.name.replace(/\s+/g, ' ').trim()],
      [es ? 'Diámetro' : 'Diameter', `${Math.round(p.diameterMm)} mm`],
      [es ? 'Adornos' : 'Decorations', p.decoration === 'none' || p.decoCount === 0 ? deco : `${p.decoCount} ${deco}`],
      [es ? 'Colores' : 'Colors', es ? `aro ${color(p.colors.frame)} con nombre ${color(p.colors.name)}` : `ring ${color(p.colors.frame)} with ${color(p.colors.name)} name`],
    ];
  },

  presets: [
    { id: 'classic', name: L('Clásico (copos)', 'Classic (snowflakes)'), params: {} },
    { id: 'stars', name: L('Con estrellas', 'With stars'), params: { decoration: 'stars', decoCount: 4, decoSizeMm: 17 } },
    { id: 'hearts', name: L('Con corazones', 'With hearts'), params: { decoration: 'hearts', decoCount: 3, decoSizeMm: 16 } },
    { id: 'trees', name: L('Con arbolitos', 'With trees'), params: { decoration: 'trees', decoCount: 3, decoSizeMm: 16 } },
    { id: 'bells', name: L('Con campanas', 'With bells'), params: { decoration: 'bells', decoCount: 3, decoSizeMm: 16 } },
    { id: 'snowmen', name: L('Con muñecos de nieve', 'With snowmen'), params: { decoration: 'snowmen', decoCount: 3, decoSizeMm: 16 } },
    { id: 'plain',name: L('Solo el nombre', 'Name only'), params: { decoration: 'none' } },
    { id: 'small', name: L('Chico (Ø 70)', 'Small (Ø 70)'), params: { diameterMm: 70, ringWidthMm: 4, nameWidthMm: 64, decoCount: 2, decoSizeMm: 12, barWidthMm: 2.4 } },
    { id: 'no-bars', name: L('Sin barras', 'No bars'), params: { bars: false, decoCount: 3 } },
  ],

  schema: [
    {
      section: 'name',
      title: L('Nombre', 'Name'),
      controls: [
        { type: 'text', key: 'name', label: L('Nombre', 'Name'), maxLength: 24, placeholder: L('Ej.: Benja', 'E.g.: Benja'), hint: L('Los puntos de la i y las tildes se unen solos con un puentecito para que no queden sueltos.', 'Dots on i and accents are joined with a small bridge so nothing is loose.') },
        { type: 'fontSelect', key: 'fontId', label: L('Fuente', 'Font'), inline: true },
        { type: 'number', key: 'nameWidthMm', label: L('Ancho del nombre', 'Name width'), unit: 'mm', min: 20, max: 140, step: 1, hint: L('Es el ancho máximo: si el nombre es corto, las letras se limitan a un alto razonable.', 'This is the maximum width: for short names the letters are capped to a reasonable height.') },
        { type: 'number', key: 'nameOffsetYMm', label: L('Subir / bajar el nombre', 'Move name up / down'), unit: 'mm', min: -30, max: 30, step: 0.5, advanced: true },
        { type: 'number', key: 'letterSpacingMm', label: L('Espaciado de letras', 'Letter spacing'), unit: 'mm', min: -3, max: 5, step: 0.1, advanced: true, tooltip: L('Negativo acerca las letras: útil para que las cursivas se toquen.', 'Negative values bring letters closer: useful so scripts connect.') },
        { type: 'number', key: 'boldOffsetMm', label: L('Engrosar letras', 'Thicken letters'), unit: 'mm', min: 0, max: 1, step: 0.1, advanced: true, tooltip: L('Útil para fuentes finas.', 'Useful for thin fonts.') },
        { type: 'checkbox', key: 'uppercase', label: L('Todo en mayúsculas', 'All caps'), advanced: true },
        { type: 'checkbox', key: 'bridgeLoose', label: L('Unir puntos y tildes', 'Join dots and accents'), advanced: true },
      ],
    },
    {
      section: 'bars',
      title: L('Barras', 'Bars'),
      controls: [
        { type: 'checkbox', key: 'bars', label: L('Barras arriba y abajo del nombre', 'Bars above and below the name'), hint: L('Sostienen el nombre contra el aro. Sin barras, el nombre tiene que tocar el aro para no quedar suelto.', 'They hold the name against the ring. Without bars, the name must touch the ring or it ends up loose.') },
        { type: 'number', key: 'barWidthMm', label: L('Grosor de las barras', 'Bar width'), unit: 'mm', min: 1.2, max: 10, step: 0.2, showIf: (p) => p.bars },
        { type: 'number', key: 'barHeightMm', label: L('Alto de las barras', 'Bar height'), unit: 'mm', min: 0.4, max: 10, step: 0.1, showIf: (p) => p.bars },
        { type: 'number', key: 'barGapMm', label: L('Distancia al texto', 'Distance to the text'), unit: 'mm', min: -4, max: 10, step: 0.5, showIf: (p) => p.bars, advanced: true, tooltip: L('Medida desde la altura de la x y desde la línea base. Con un valor negativo las barras se meten en las letras y las sujetan.', 'Measured from the x-height and the baseline. A negative value tucks the bars into the letters so they hold them.') },
      ],
    },
    {
      section: 'sphere',
      title: L('Esfera', 'Sphere'),
      controls: [
        { type: 'number', key: 'diameterMm', label: L('Diámetro', 'Diameter'), unit: 'mm', min: 50, max: 160, step: 1 },
        { type: 'number', key: 'ringWidthMm', label: L('Ancho del aro', 'Ring width'), unit: 'mm', min: 2, max: 15, step: 0.1 },
        { type: 'number', key: 'thicknessMm', label: L('Grosor del aro', 'Ring thickness'), unit: 'mm', min: 1, max: 8, step: 0.2 },
        { type: 'number', key: 'nameHeightMm', label: L('Alto del nombre', 'Name height'), unit: 'mm', min: 1, max: 10, step: 0.1, tooltip: L('Altura total del nombre; sobresale del aro lo que le falte al grosor.', 'Total height of the name; it stands out from the ring by the difference.') },
      ],
    },
    {
      section: 'loop',
      title: L('Argolla', 'Loop'),
      controls: [
        { type: 'checkbox', key: 'loop', label: L('Orejita para colgar', 'Hanging loop') },
        { type: 'number', key: 'loopHoleMm', label: L('Diámetro del agujero', 'Hole diameter'), unit: 'mm', min: 2, max: 12, step: 0.5, showIf: (p) => p.loop },
        { type: 'number', key: 'loopWallMm', label: L('Grosor de la orejita', 'Loop wall'), unit: 'mm', min: 1, max: 6, step: 0.2, showIf: (p) => p.loop },
      ],
    },
    {
      section: 'decor',
      title: L('Adornos', 'Decorations'),
      controls: [
        { type: 'select', key: 'decoration', label: L('Tipo de adorno', 'Decoration type'), options: [['snow', L('Copos de nieve', 'Snowflakes')], ['stars', L('Estrellas', 'Stars')], ['hearts', L('Corazones', 'Hearts')], ['trees', L('Arbolitos', 'Trees')], ['bells', L('Campanas', 'Bells')], ['snowmen', L('Muñecos de nieve', 'Snowmen')], ['none', L('Ninguno', 'None')]] },
        { type: 'segmented', key: 'decoCount', showIf: hasDeco, options: [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4']] },
        { type: 'number', key: 'decoSizeMm', label: L('Tamaño (radio)', 'Size (radius)'), unit: 'mm', min: 8, max: 45, step: 1, showIf: hasDeco },
        { type: 'segmented', key: 'decoStyle', showIf: (p) => p.decoration === 'snow', options: [['mix', L('Variados', 'Mixed')], ['classic', L('Clásico', 'Classic')], ['fat', L('Grueso', 'Bold')], ['fine', L('Fino', 'Fine')]] },
        { type: 'number', key: 'decoSeed', label: L('Variación', 'Variation'), min: 0, max: 99, step: 1, showIf: hasDeco, tooltip: L('Cambia el giro, el tamaño y la posición de cada adorno. 0 es el diseño base.', 'Changes the rotation, size and position of each decoration. 0 is the base design.') },
      ],
    },
    {
      section: 'colors',
      title: L('Colores', 'Colors'),
      controls: [
        { type: 'color', key: 'colors.frame', label: L('Aro, barras y adornos', 'Ring, bars and decorations') },
        { type: 'color', key: 'colors.name', label: L('Nombre', 'Name'), hint: L('El nombre y el aro comparten altura: necesita impresora multicolor (AMS).', 'The name and the ring share height: it needs a multicolor printer (AMS).') },
      ],
    },
    {
      section: 'quality',
      collapsed: true,
      title: L('Calidad', 'Quality'),
      controls: [
        { type: 'select', key: 'curveQuality', label: L('Calidad de curvas', 'Curve quality'), options: [['draft', L('Borrador (rápido)', 'Draft (fast)')], ['normal', L('Normal', 'Normal')], ['high', L('Alta', 'High')]] },
        { type: 'checkbox', key: 'snapToLayers', label: L('Alinear alturas a la altura de capa', 'Snap heights to layer height'), tooltip: L('Evita capas raras y cambios de color a mitad de capa.', 'Avoids odd layers and color changes mid-layer.') },
      ],
    },
  ],
};
