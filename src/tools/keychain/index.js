// Definición de la herramienta "Llavero con nombre": metadata, schema del panel y presets.
import { defaults, normalizeParams, PARAMS_VERSION } from './params.js';

const isRelief = (p) => p.letterStyle === 'relief';
const hasRing = (p) => p.ringType !== 'none';
const isBatch = (p) => p.mode === 'batch';
const isSingle = (p) => p.mode !== 'batch';
const L = (es, en) => ({ es, en });

export default {
  id: 'keychain',
  status: 'active',
  icon: 'key',
  filePrefix: 'llavero',
  name: L('Llavero con nombre', 'Name keychain'),
  description: L(
    'Escribí un nombre y descargá el llavero listo para imprimir, en uno o varios colores',
    'Type a name and download a print-ready keychain, in one or more colors',
  ),
  paramsVersion: PARAMS_VERSION,
  migrate: (old) => old,
  normalize: normalizeParams,
  defaults,
  exports: ['stl-merged', 'zip-per-color', '3mf', 'png'],
  build: () => import('./build.js'),

  presets: [
    { id: 'classic', name: L('Clásico', 'Classic'), params: {} },
    { id: 'flush', name: L('Cursiva al ras (2 colores)', 'Script flush (2 colors)'), params: { fontId: 'lobster', letterStyle: 'flush', engraveDepthMm: 0.8 } },
    {
      id: 'bagtag',
      name: L('Etiqueta de mochila', 'Bag tag'),
      params: { fontId: 'archivo-black', shape: 'rounded', cornerRadiusMm: 6, border: true, borderWidthMm: 1.2, sizeMm: 55, marginMm: 4, baseThicknessMm: 3, colors: { base: '#1e88e5', text: '#ffffff' } },
    },
    {
      id: 'outline',
      name: L('Nombre con contorno (3 colores)', 'Outlined name (3 colors)'),
      params: { fontId: 'lobster', textEffect: 'outline', textOutlineMm: 1.2, textOutlineHeightMm: 0.6, colors: { base: '#3a3a3a', text: '#f2e08a', accent: '#e53935' } },
    },
    { id: 'engraved', name: L('Grabado (1 color)', 'Engraved (1 color)'), params: { fontId: 'bebas-neue', letterStyle: 'engraved', engraveDepthMm: 1, shape: 'rounded', cornerRadiusMm: 4 } },
    { id: 'nopause', name: L('Sin AMS (cambio con pausa)', 'No AMS (pause & swap)'), params: { letterStyle: 'relief', reliefMm: 1.2, textEffect: 'none', border: false } },
  ],

  schema: [
    {
      section: 'text',
      title: L('Texto', 'Text'),
      controls: [
        { type: 'segmented', key: 'mode', options: [['single', L('Un llavero', 'One keychain')], ['batch', L('Varios nombres', 'Several names')]] },
        { type: 'textarea', key: 'text', showIf: isSingle, label: L('Texto del llavero', 'Keychain text'), hint: L('Con Enter pasás a otro renglón dentro del mismo llavero.', 'Press Enter for another line inside the same keychain.'), rows: 2, maxLength: 130 },
        { type: 'textarea', key: 'batchText', showIf: isBatch, label: L('Nombres (uno por línea)', 'Names (one per line)'), rows: 5, maxLength: 6000, hint: L('Cada nombre es un llavero. Se acomodan en la cama de tu impresora. Usá | para un salto de línea dentro de un nombre.', 'Each name is a keychain. They are arranged on your printer bed. Use | for a line break inside a name.') },
        { type: 'select', key: 'batchSeparator', showIf: isBatch, label: L('Separador', 'Separator'), advanced: true, options: [['line', L('Salto de línea', 'New line')], ['comma', L('Coma', 'Comma')], ['semicolon', L('Punto y coma', 'Semicolon')]] },
        { type: 'fontSelect', key: 'fontId', label: L('Fuente', 'Font'), inline: true },
        { type: 'iconSelect', key: 'icon', label: L('Ícono', 'Icon'), inline: true },
        { type: 'segmented', key: 'iconPosition', showIf: (p) => !!p.icon, options: [['before', L('Antes', 'Before')], ['after', L('Después', 'After')], ['both', L('Ambos lados', 'Both sides')]] },
        { type: 'number', key: 'iconScale', showIf: (p) => !!p.icon, label: L('Tamaño del ícono', 'Icon size'), min: 0.3, max: 3, step: 0.1, advanced: true, tooltip: L('Relativo al alto de las mayúsculas.', 'Relative to the capital height.') },
        { type: 'segmented', key: 'align', label: L('Alineación', 'Alignment'), advanced: true, options: [['left', L('Izq.', 'Left')], ['center', L('Centro', 'Center')], ['right', L('Der.', 'Right')]] },
        { type: 'number', key: 'letterSpacingMm', label: L('Espaciado de letras', 'Letter spacing'), unit: 'mm', min: -3, max: 5, step: 0.1, advanced: true, tooltip: L('Negativo acerca las letras: útil para que las cursivas se toquen.', 'Negative values bring letters closer: useful so scripts connect.') },
        { type: 'number', key: 'lineSpacing', label: L('Interlineado', 'Line spacing'), min: 0.6, max: 2, step: 0.05, advanced: true },
        { type: 'number', key: 'boldOffsetMm', label: L('Engrosar letras', 'Thicken letters'), unit: 'mm', min: 0, max: 1, step: 0.1, advanced: true, tooltip: L('Útil para fuentes finas.', 'Useful for thin fonts.') },
        { type: 'checkbox', key: 'uppercase', label: L('Todo en mayúsculas', 'All caps'), advanced: true },
      ],
    },
    {
      section: 'size',
      title: L('Tamaño', 'Size'),
      controls: [
        {
          type: 'select',
          key: 'sizeMode',
          label: L('Medir por', 'Measure by'),
          options: [
            ['textWidth', L('Ancho de las letras', 'Letters width')],
            ['overallWidth', L('Ancho total del llavero', 'Overall keychain width')],
            ['textHeight', L('Alto total del texto', 'Total text height')],
            ['capHeight', L('Alto de mayúscula', 'Capital height')],
          ],
        },
        { type: 'number', key: 'sizeMm', label: L('Tamaño', 'Size'), unit: 'mm', min: 5, max: 250, step: 1 },
        { type: 'select', key: 'batchUniform', showIf: isBatch, label: L('En el lote', 'In the batch'), options: [['sameWidth', L('Todos del mismo ancho', 'All the same width')], ['sameScale', L('Mismo tamaño de letra', 'Same letter size')]] },
      ],
    },
    {
      section: 'shape',
      title: L('Forma', 'Shape'),
      controls: [
        {
          type: 'select',
          key: 'shape',
          label: L('Forma', 'Shape'),
          options: [
            ['follow', L('Sigue las letras', 'Follows letters')],
            ['rounded', L('Pastilla / rectángulo', 'Pill / rectangle')],
            ['ellipse', L('Elipse', 'Ellipse')],
            ['circle', L('Círculo', 'Circle')],
            ['heart', L('Corazón', 'Heart')],
            ['tag', L('Etiqueta de valija', 'Luggage tag')],
            ['hexagon', L('Hexágono', 'Hexagon')],
            ['cloud', L('Nube', 'Cloud')],
            ['badge', L('Escudo', 'Badge')],
          ],
        },
        { type: 'number', key: 'marginMm', label: L('Margen alrededor', 'Margin'), unit: 'mm', min: 0.5, max: 15, step: 0.5 },
        { type: 'number', key: 'baseThicknessMm', label: L('Grosor de la base', 'Base thickness'), unit: 'mm', min: 1.2, max: 10, step: 0.2 },
        { type: 'number', key: 'smoothMm', label: L('Suavizado del contorno', 'Outline smoothing'), unit: 'mm', min: 0, max: 6, step: 0.5, advanced: true, showIf: (p) => p.shape === 'follow', tooltip: L('Rellena las muescas entre letras.', 'Fills notches between letters.') },
        { type: 'checkbox', key: 'fillCounters', label: L('Rellenar huecos internos', 'Fill inner holes'), advanced: true, showIf: (p) => p.shape === 'follow' },
        { type: 'number', key: 'cornerRadiusMm', label: L('Radio de esquinas', 'Corner radius'), unit: 'mm', min: 0, max: 999, step: 1, advanced: true, showIf: (p) => p.shape === 'rounded', hint: L('Un valor grande = cápsula.', 'A large value = capsule.') },
      ],
    },
    {
      section: 'letters',
      title: L('Letras', 'Letters'),
      controls: [
        { type: 'segmented', key: 'letterStyle', options: [['relief', L('En relieve', 'Raised')], ['engraved', L('Grabado', 'Engraved')], ['flush', L('Al ras', 'Flush')]] },
        { type: 'number', key: 'reliefMm', label: L('Alto del relieve', 'Relief height'), unit: 'mm', min: 0.4, max: 5, step: 0.2, showIf: isRelief },
        { type: 'number', key: 'engraveDepthMm', label: L('Profundidad', 'Depth'), unit: 'mm', min: 0.2, max: 5, step: 0.2, showIf: (p) => !isRelief(p), tooltip: L('Se deja un piso de 0,8 mm como mínimo.', 'A minimum 0.8 mm floor is kept.') },
        { type: 'select', key: 'textEffect', label: L('Efecto', 'Effect'), showIf: isRelief, options: [['none', L('Ninguno', 'None')], ['outline', L('Contorno (3 colores)', 'Outline (3 colors)')], ['shadow', L('Sombra (3 colores)', 'Shadow (3 colors)')]] },
        { type: 'number', key: 'textOutlineMm', label: L('Ancho del contorno', 'Outline width'), unit: 'mm', min: 0.4, max: 4, step: 0.2, showIf: (p) => isRelief(p) && p.textEffect === 'outline' },
        { type: 'number', key: 'textOutlineHeightMm', label: L('Alto del contorno', 'Outline height'), unit: 'mm', min: 0.2, max: 3, step: 0.2, advanced: true, showIf: (p) => isRelief(p) && p.textEffect === 'outline' },
        { type: 'number', key: 'shadowDxMm', label: L('Sombra X', 'Shadow X'), unit: 'mm', min: -5, max: 5, step: 0.5, showIf: (p) => isRelief(p) && p.textEffect === 'shadow' },
        { type: 'number', key: 'shadowDyMm', label: L('Sombra Y', 'Shadow Y'), unit: 'mm', min: -5, max: 5, step: 0.5, showIf: (p) => isRelief(p) && p.textEffect === 'shadow' },
        { type: 'checkbox', key: 'faceDown', label: L('Imprimir boca abajo (texto contra la cama)', 'Print face down (text on the bed)'), advanced: true, showIf: (p) => !isRelief(p) },
      ],
    },
    {
      section: 'border',
      title: L('Borde', 'Border'),
      controls: [
        { type: 'checkbox', key: 'border', label: L('Borde elevado alrededor', 'Raised border') },
        { type: 'number', key: 'borderWidthMm', label: L('Ancho del borde', 'Border width'), unit: 'mm', min: 0.4, max: 5, step: 0.2, showIf: (p) => p.border },
        { type: 'checkbox', key: 'borderAroundHole', label: L('También alrededor del agujero', 'Also around the hole'), advanced: true, showIf: (p) => p.border && hasRing(p) },
      ],
    },
    {
      section: 'ring',
      title: L('Argolla', 'Key ring'),
      controls: [
        { type: 'select', key: 'ringType', label: L('Tipo', 'Type'), options: [['tab', L('Oreja con agujero', 'Tab with hole')], ['internal', L('Agujero dentro del cuerpo', 'Hole inside the body')], ['slot', L('Ranura para cinta', 'Strap slot')], ['none', L('Sin argolla', 'No ring')]] },
        { type: 'select', key: 'ringPosition', label: L('Posición', 'Position'), showIf: hasRing, options: [['left', L('Izquierda', 'Left')], ['right', L('Derecha', 'Right')], ['top', L('Arriba', 'Top')], ['topLeft', L('Arriba izquierda', 'Top left')], ['topRight', L('Arriba derecha', 'Top right')]] },
        { type: 'number', key: 'ringOuterMm', label: L('Diámetro de la oreja', 'Tab diameter'), unit: 'mm', min: 4, max: 30, step: 0.5, showIf: (p) => p.ringType === 'tab' },
        { type: 'number', key: 'ringHoleMm', label: L('Diámetro del agujero', 'Hole diameter'), unit: 'mm', min: 1.5, max: 20, step: 0.5, showIf: (p) => p.ringType === 'tab' || p.ringType === 'internal' },
        { type: 'number', key: 'slotWidthMm', label: L('Ancho de la ranura', 'Slot width'), unit: 'mm', min: 4, max: 40, step: 0.5, showIf: (p) => p.ringType === 'slot', tooltip: L('Largo de la ranura: por donde pasa la cinta.', 'Length of the slot: where the strap goes through.') },
        { type: 'number', key: 'slotHeightMm', label: L('Alto de la ranura', 'Slot height'), unit: 'mm', min: 1.5, max: 12, step: 0.5, showIf: (p) => p.ringType === 'slot' },
        { type: 'number', key: 'ringOffsetXMm', label: L('Ajuste fino X', 'Fine tune X'), unit: 'mm', min: -20, max: 20, step: 0.5, advanced: true, showIf: hasRing },
        { type: 'number', key: 'ringOffsetYMm', label: L('Ajuste fino Y', 'Fine tune Y'), unit: 'mm', min: -20, max: 20, step: 0.5, advanced: true, showIf: hasRing },
      ],
    },
    {
      section: 'colors',
      title: L('Colores', 'Colors'),
      controls: [
        { type: 'color', key: 'colors.base', label: L('Base', 'Base') },
        { type: 'color', key: 'colors.text', label: L('Letras', 'Letters') },
        { type: 'color', key: 'colors.accent', label: L('Contorno / sombra', 'Outline / shadow'), showIf: (p) => isRelief(p) && p.textEffect !== 'none' },
        { type: 'color', key: 'colors.border', label: L('Borde', 'Border'), nullable: true, fallbackKey: 'colors.text', showIf: (p) => p.border },
      ],
    },
    {
      section: 'quality',
      title: L('Calidad', 'Quality'),
      controls: [
        { type: 'select', key: 'curveQuality', label: L('Calidad de curvas', 'Curve quality'), options: [['draft', L('Borrador (rápido)', 'Draft (fast)')], ['normal', L('Normal', 'Normal')], ['high', L('Alta', 'High')]] },
        { type: 'checkbox', key: 'snapToLayers', label: L('Alinear alturas a la altura de capa', 'Snap heights to layer height'), tooltip: L('Evita capas raras y cambios de color a mitad de capa.', 'Avoids odd layers and color changes mid-layer.') },
      ],
    },
  ],
};
