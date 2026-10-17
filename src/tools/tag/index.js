// Definición de la herramienta "Chapita para mascota": metadata, schema del panel y presets.
import { defaults, normalizeParams, PARAMS_VERSION } from './params.js';
import { FREE_SHAPES } from './shapes.js';

const L = (es, en) => ({ es, en });
const isFree = (p) => FREE_SHAPES.includes(p.shape);
const hasRing = (p) => p.attach === 'ring' || p.attach === 'inside';
const hasText = (p) => p.name.trim() !== '' || p.phone.trim() !== '' || p.extra.trim() !== '';

/** Íconos del catálogo cuya silueta sirve como chapita (una sola pieza, sin partes finas ni sueltas). */
const SILHOUETTE_ICONS = ['heart', 'star', 'crown-simple', 'paw-print', 'bone', 'flower', 'flower-lotus', 'leaf', 'butterfly', 'lightning', 'music-note', 'house', 'key', 'moon', 'cloud', 'drop', 'fire', 'skull', 'ghost', 'tree-evergreen', 'gift', 'game-controller', 'camera', 'graduation-cap', 'club', 'star-of-david', 'diamond', 'thumbs-up', 'cat', 'dog', 'fish', 'rocket', 'planet', 'cake', 'pizza', 'bell', 'flag', 'guitar', 'hand-heart', 'cross', 'rainbow', 'car', 'airplane', 'book-open'];

/** Lo que cada preset NO pisa: el texto, la sujeción, los colores y las medidas de tu hardware. */
const KEEP = ['name', 'phone', 'extra', 'fontId', 'uppercase', 'textSizing', 'colors', 'ringHoleMm', 'ringWallMm', 'collarWidthMm', 'slotThicknessMm', 'plateThicknessMm', 'curveQuality'];

export default {
  id: 'tag',
  status: 'active',
  icon: 'tag',
  filePrefix: 'chapita',
  name: L('Chapita para mascota', 'Pet tag'),
  description: L('Huesito, huella, corazón y más: con nombre y teléfono, para argolla o para pasar el collar', 'Bone, paw, heart and more: with name and phone, for a ring or to slide onto the collar'),
  paramsVersion: PARAMS_VERSION,
  migrate: (old) => old,
  normalize: normalizeParams,
  defaults,
  presetKeep: KEEP,
  exports: ['stl-merged', 'zip-per-color', '3mf', 'png'],
  build: () => import('./build.js'),

  presets: [
    { id: 'bone', name: L('Huesito', 'Bone'), params: {} },
    { id: 'round', name: L('Redonda', 'Round'), params: { shape: 'circle', widthMm: 50, attach: 'inside', ringSide: 'top', letterSpacingMm: 0.15 } },
    { id: 'collar', name: L('Pasante para collar', 'Collar slide'), params: { shape: 'rounded', widthMm: 50, heightMm: 30, cornerRadiusMm: 5, attach: 'slots' } },
    { id: 'heart', name: L('Corazón', 'Heart'), params: { shape: 'heart', widthMm: 42 } },
    { id: 'paw', name: L('Huella', 'Paw'), params: { shape: 'paw', widthMm: 54, attach: 'inside', ringOffsetMm: -8 } },
    { id: 'cat', name: L('Gatito', 'Kitty'), params: { shape: 'cat', widthMm: 42 } },
    { id: 'star', name: L('Estrella', 'Star'), params: { shape: 'star', widthMm: 48 } },
    { id: 'shield', name: L('Escudo', 'Shield'), params: { shape: 'shield', widthMm: 38 } },
    { id: 'hexagon', name: L('Hexágono', 'Hexagon'), params: { shape: 'hexagon', widthMm: 44 } },
    { id: 'flower', name: L('Flor', 'Flower'), params: { shape: 'flower', widthMm: 44 } },
    { id: 'house', name: L('Casita', 'House'), params: { shape: 'house', widthMm: 40 } },
    { id: 'fish', name: L('Pez', 'Fish'), params: { shape: 'fish', widthMm: 52, ringSide: 'left' } },
    { id: 'cloud', name: L('Nube', 'Cloud'), params: { shape: 'cloud', widthMm: 56, ringOffsetMm: -5 } },
  ],

  schema: [
    {
      section: 'text',
      title: L('Texto', 'Text'),
      controls: [
        { type: 'text', key: 'name', label: L('Nombre', 'Name'), maxLength: 30, placeholder: L('Nombre de tu mascota', 'Your pet’s name') },
        { type: 'number', key: 'nameSizeMm', label: L('Tamaño del nombre', 'Name size'), unit: 'mm', min: 2, max: 30, step: 0.5, showIf: (p) => p.name.trim() !== '', hint: L('Son medidas reales de la chapita impresa, como con una regla: 10 mm = 1 cm. Es el alto de las letras mayúsculas (9 mm es casi 1 cm).', 'These are real measurements of the printed tag, as with a ruler: 10 mm = 1 cm. It is the height of capital letters (9 mm is almost 1 cm).') },
        { type: 'text', key: 'phone', label: L('Teléfono', 'Phone'), maxLength: 30, inputmode: 'tel' },
        { type: 'number', key: 'phoneSizeMm', label: L('Tamaño del teléfono', 'Phone size'), unit: 'mm', min: 2, max: 30, step: 0.5, showIf: (p) => p.phone.trim() !== '', tooltip: L('Alto de los números, en mm.', 'Digit height, in mm.') },
        { type: 'text', key: 'extra', label: L('Línea extra (opcional)', 'Extra line (optional)'), maxLength: 40, placeholder: L('Ej.: Me perdí, llamame', 'E.g.: I am lost, call me') },
        { type: 'number', key: 'extraSizeMm', label: L('Tamaño de la línea extra', 'Extra line size'), unit: 'mm', min: 2, max: 30, step: 0.5, showIf: (p) => p.extra.trim() !== '', tooltip: L('Alto de las letras, en mm.', 'Letter height, in mm.') },
        { type: 'fontSelect', key: 'fontId', label: L('Fuente', 'Font'), inline: true },
        {
          type: 'segmented',
          key: 'textSizing',
          options: [['fixed', L('Tamaño fijo', 'Fixed size')], ['auto', L('Llenar la chapita', 'Fill the tag')]],
          hint: L('Fijo: las letras miden lo que pusiste arriba (se achican solo si no entran). Llenar: agranda el texto al máximo y los tamaños pasan a ser solo la proporción entre líneas.', 'Fixed: letters are as tall as set above (they only shrink if they do not fit). Fill: scales the text up to the maximum and the sizes become just the proportion between lines.'),
        },
        { type: 'number', key: 'letterSpacingMm', label: L('Espaciado de letras', 'Letter spacing'), unit: 'mm', min: -1, max: 3, step: 0.1, advanced: true },
        { type: 'number', key: 'lineGapMm', label: L('Espacio entre líneas', 'Line gap'), unit: 'mm', min: 0.5, max: 8, step: 0.5, advanced: true },
        { type: 'number', key: 'boldOffsetMm', label: L('Engrosar letras', 'Thicken letters'), unit: 'mm', min: 0, max: 0.6, step: 0.05, advanced: true, tooltip: L('Los trazos finos no salen bien: conviene engrosar un poco.', 'Thin strokes do not print well: thickening a little helps.') },
        { type: 'checkbox', key: 'uppercase', label: L('Todo en mayúsculas', 'All caps'), advanced: true },
      ],
    },
    {
      section: 'shape',
      title: L('Forma', 'Shape'),
      controls: [
        {
          type: 'select',
          key: 'shape',
          label: L('Modelo', 'Model'),
          options: [
            ['bone', L('Huesito', 'Bone')],
            ['circle', L('Círculo', 'Circle')],
            ['oval', L('Óvalo', 'Oval')],
            ['rounded', L('Rectángulo', 'Rectangle')],
            ['heart', L('Corazón', 'Heart')],
            ['paw', L('Huella', 'Paw')],
            ['cat', L('Gatito', 'Kitty')],
            ['star', L('Estrella', 'Star')],
            ['shield', L('Escudo', 'Shield')],
            ['hexagon', L('Hexágono', 'Hexagon')],
            ['flower', L('Flor', 'Flower')],
            ['house', L('Casita', 'House')],
            ['fish', L('Pez', 'Fish')],
            ['cloud', L('Nube', 'Cloud')],
            ['icon', L('Silueta de un ícono…', 'Icon silhouette…')],
          ],
        },
        { type: 'iconSelect', key: 'icon', ids: SILHOUETTE_ICONS, label: L('Ícono', 'Icon'), inline: true, showIf: (p) => p.shape === 'icon', hint: L('Se usa el contorno del ícono como forma de la chapita (perro, gato, pez, mariposa, luna…).', 'The icon outline becomes the tag shape (dog, cat, fish, butterfly, moon…).') },
        { type: 'number', key: 'widthMm', label: L('Ancho', 'Width'), unit: 'mm', min: 20, max: 150, step: 1, tooltip: L('Con las formas de proporción fija, el alto sale solo.', 'With fixed-proportion shapes the height follows.') },
        { type: 'number', key: 'heightMm', label: L('Alto', 'Height'), unit: 'mm', min: 15, max: 100, step: 1, showIf: isFree },
        { type: 'number', key: 'cornerRadiusMm', label: L('Esquinas redondeadas', 'Rounded corners'), unit: 'mm', min: 0, max: 50, step: 0.5, showIf: (p) => p.shape === 'rounded' },
      ],
    },
    {
      section: 'plate',
      title: L('Chapita', 'Plate'),
      controls: [
        { type: 'number', key: 'plateThicknessMm', label: L('Grosor de la placa', 'Plate thickness'), unit: 'mm', min: 1.2, max: 10, step: 0.2 },
        { type: 'segmented', key: 'textStyle', showIf: hasText, options: [['raised', L('Relieve', 'Raised')], ['inlay', L('Embutido', 'Inlay')], ['engraved', L('Grabado', 'Engraved')]], hint: L('Relieve: un solo cambio de color, sin AMS. Embutido: letras al ras, necesita multicolor.', 'Raised: a single color swap, no AMS. Inlay: flush letters, needs multicolor.') },
        { type: 'number', key: 'reliefMm', label: L('Alto del relieve', 'Relief height'), unit: 'mm', min: 0.4, max: 4, step: 0.1, tooltip: L('Cuánto sobresalen las letras de la placa.', 'How far the letters stand out from the plate.') },
        { type: 'number', key: 'engraveDepthMm', label: L('Profundidad del grabado', 'Engraving depth'), unit: 'mm', min: 0.3, max: 3, step: 0.1, showIf: (p) => hasText(p) && p.textStyle !== 'raised' },
        { type: 'checkbox', key: 'rim', label: L('Borde elevado alrededor', 'Raised border') },
        { type: 'number', key: 'rimWidthMm', label: L('Ancho del borde', 'Border width'), unit: 'mm', min: 0.6, max: 5, step: 0.2, showIf: (p) => p.rim },
        { type: 'number', key: 'rimHeightMm', label: L('Alto del borde', 'Border height'), unit: 'mm', min: 0.2, max: 4, step: 0.1, showIf: (p) => p.rim, advanced: true },
        { type: 'number', key: 'textMarginMm', label: L('Aire entre texto y borde', 'Text clearance'), unit: 'mm', min: 0.4, max: 6, step: 0.2, advanced: true },
        { type: 'number', key: 'textOffsetYMm', label: L('Subir / bajar el texto', 'Move text up / down'), unit: 'mm', min: -30, max: 30, step: 0.5, advanced: true },
      ],
    },
    {
      section: 'attach',
      title: L('Sujeción', 'Attachment'),
      controls: [
        {
          type: 'segmented',
          key: 'attach',
          options: [['ring', L('Argolla', 'Ring')], ['inside', L('Agujero', 'Hole')], ['slots', L('Collar', 'Collar')], ['none', L('Ninguna', 'None')]],
          hint: L('Argolla: orejita con agujero. Agujero: dentro de la chapita. Collar: dos ranuras para pasar la correa.', 'Ring: a small ear with a hole. Hole: inside the tag. Collar: two slots to thread the strap.'),
        },
        { type: 'segmented', key: 'ringSide', showIf: hasRing, options: [['top', L('Arriba', 'Top')], ['left', L('Izquierda', 'Left')], ['right', L('Derecha', 'Right')], ['bottom', L('Abajo', 'Bottom')]] },
        { type: 'number', key: 'ringHoleMm', label: L('Diámetro del agujero', 'Hole diameter'), unit: 'mm', min: 2, max: 12, step: 0.5, showIf: hasRing },
        { type: 'number', key: 'ringWallMm', label: L('Grosor de la orejita', 'Ear wall'), unit: 'mm', min: 1, max: 6, step: 0.2, showIf: (p) => p.attach === 'ring' },
        { type: 'number', key: 'ringOffsetMm', label: L('Correr a lo largo del borde', 'Slide along the edge'), unit: 'mm', min: -60, max: 60, step: 1, showIf: hasRing, advanced: true },
        { type: 'number', key: 'collarWidthMm', label: L('Ancho del collar', 'Collar width'), unit: 'mm', min: 8, max: 60, step: 1, showIf: (p) => p.attach === 'slots' },
        { type: 'number', key: 'slotThicknessMm', label: L('Grosor de la ranura', 'Slot thickness'), unit: 'mm', min: 2, max: 10, step: 0.5, showIf: (p) => p.attach === 'slots', tooltip: L('Lo que mide la correa de espesor, con un poco de aire.', 'The strap thickness, with a little room.') },
      ],
    },
    {
      section: 'colors',
      title: L('Colores', 'Colors'),
      controls: [
        { type: 'color', key: 'colors.base', label: L('Placa', 'Plate'), hint: L('Con la placa y las letras del mismo color se imprime de un tirón; con colores distintos hay UN solo cambio de color (sin AMS).', 'Plate and letters in the same color print in one go; with different colors there is a SINGLE color swap (no AMS).') },
        { type: 'color', key: 'colors.text', label: L('Letras y borde', 'Letters and border') },
        { type: 'color', key: 'colors.border', label: L('Borde (otro color)', 'Border (other color)'), nullable: true, fallbackKey: 'colors.text', showIf: (p) => p.rim, advanced: true },
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
