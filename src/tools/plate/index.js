// Definición de la herramienta "Llavero patente": metadata, schema del panel y presets.
import { defaults, normalizeParams, PARAMS_VERSION } from './params.js';

const L = (es, en) => ({ es, en });
const isNew = (p) => p.style === 'mercosur';
const isOld = (p) => p.style === 'old';
const hasRing = (p) => p.attach !== 'none';
const isLayers = (p) => p.colorMode === 'layers';

/** Lo que cada preset NO pisa: las patentes, la leyenda, los colores y las medidas de tu argolla. */
const KEEP = ['plateNew', 'plateOld', 'topText', 'topTextOld', 'fontId', 'colors', 'ringHoleMm', 'ringWallMm', 'plateThicknessMm', 'curveQuality'];

export default {
  id: 'plate',
  status: 'active',
  icon: 'plate',
  filePrefix: 'llavero-patente',
  name: L('Llavero patente', 'License plate keychain'),
  short: L('Patente', 'Plate'),
  description: L('Patente argentina Mercosur o la vieja de 1994, con tu patente, en relieve y a color', 'Argentine license plate, Mercosur or the old 1994 one, with your plate number, raised and in color'),
  paramsVersion: PARAMS_VERSION,
  migrate: (old) => old,
  normalize: normalizeParams,
  defaults,
  presetKeep: KEEP,
  exports: ['stl-merged', 'zip-per-color', '3mf', 'png'],
  build: () => import('./build.js'),

  /** Resumen para el pedido por WhatsApp: pares [etiqueta, valor] (ctx: idioma, nombre de color y etiqueta de una opción). */
  orderSummary: (p, { lang, option }) => {
    const es = lang === 'es';
    return [
      [es ? 'Modelo' : 'Model', option('style', p.style)],
      [es ? 'Patente' : 'Plate', (isOld(p) ? p.plateOld : p.plateNew).trim().toUpperCase()],
      [es ? 'Leyenda' : 'Legend', (isOld(p) ? p.topTextOld : p.topText).trim()],
      [es ? 'Sujeción' : 'Attachment', option('attach', p.attach)],
    ];
  },

  presets: [
    { id: 'mercosur', name: L('Mercosur (nueva)', 'Mercosur (new)'), params: { style: 'mercosur' } },
    { id: 'old', name: L('Vieja (1994)', 'Old (1994)'), params: { style: 'old' } },
    { id: 'mercosur-top', name: L('Mercosur con argolla arriba', 'Mercosur, ring on top'), params: { style: 'mercosur', attach: 'ring', ringSide: 'top' } },
    { id: 'old-hole', name: L('Vieja con agujero', 'Old with a hole'), params: { style: 'old', attach: 'inside', ringSide: 'left' } },
    { id: 'big', name: L('Grande (100 mm)', 'Large (100 mm)'), params: { widthMm: 100 } },
  ],

  schema: [
    {
      section: 'plate',
      title: L('Patente', 'Plate'),
      controls: [
        {
          type: 'segmented',
          key: 'style',
          options: [['mercosur', L('Mercosur (nueva)', 'Mercosur (new)')], ['old', L('Vieja (1994)', 'Old (1994)')]],
          hint: L('Mercosur: placa blanca con la franja azul y la bandera (desde 2016). Vieja: placa blanca con el recuadro negro y "ARGENTINA" arriba (1994 a 2016).', 'Mercosur: white plate with the blue band and the flag (since 2016). Old: white plate with the black panel and "ARGENTINA" on top (1994 to 2016).'),
        },
        { type: 'text', key: 'plateNew', label: L('Patente', 'Plate number'), maxLength: 12, placeholder: 'AB 123 CD', showIf: isNew },
        { type: 'text', key: 'plateOld', label: L('Patente', 'Plate number'), maxLength: 12, placeholder: 'ABC 123', showIf: isOld },
        { type: 'text', key: 'topText', label: L('Leyenda de arriba', 'Top legend'), maxLength: 30, placeholder: 'REPÚBLICA ARGENTINA', showIf: isNew, hint: L('Podés poner un nombre o dejarla vacía.', 'You can put a name or leave it empty.') },
        { type: 'text', key: 'topTextOld', label: L('Leyenda de arriba', 'Top legend'), maxLength: 30, placeholder: 'ARGENTINA', showIf: isOld, hint: L('Podés poner un nombre o dejarla vacía.', 'You can put a name or leave it empty.') },
        { type: 'checkbox', key: 'showStars', label: L('Estrellas del Mercosur', 'Mercosur stars'), showIf: isNew },
        { type: 'checkbox', key: 'showFlag', label: L('Bandera argentina', 'Argentine flag'), showIf: isNew },
        { type: 'checkbox', key: 'showShield', label: L('Escudo', 'Coat of arms'), showIf: isOld },
        { type: 'checkbox', key: 'showSlots', label: L('Ranuras de la chapa', 'Plate slots'), showIf: isOld, tooltip: L('Las cuatro ranuras de la patente, grabadas en la placa.', 'The four slots of the plate, engraved into it.') },
        { type: 'fontSelect', key: 'fontId', label: L('Fuente de los caracteres', 'Character font'), inline: true },
        { type: 'slider', key: 'charFill', label: L('Alto de los caracteres', 'Character height'), unit: '%', min: 40, max: 100, step: 1, tooltip: L('Qué parte del alto libre ocupan los caracteres.', 'How much of the free height the characters take.') },
        { type: 'slider', key: 'charWidth', label: L('Ancho de los caracteres', 'Character width'), unit: '%', min: 60, max: 160, step: 1, tooltip: L('Ensancha o angosta las letras; si no entran, se achican solas.', 'Widens or narrows the letters; if they do not fit they shrink by themselves.') },
        { type: 'number', key: 'letterSpacingMm', label: L('Espaciado de caracteres', 'Character spacing'), unit: 'mm', min: -1, max: 4, step: 0.1, advanced: true },
        { type: 'number', key: 'boldOffsetMm', label: L('Engrosar caracteres', 'Thicken characters'), unit: 'mm', min: 0, max: 0.6, step: 0.05, advanced: true },
      ],
    },
    {
      section: 'size',
      title: L('Llavero', 'Keychain'),
      controls: [
        { type: 'number', key: 'widthMm', label: L('Ancho de la patente', 'Plate width'), unit: 'mm', min: 40, max: 150, step: 1, tooltip: L('El alto sale solo, con la proporción de la patente real.', 'The height follows the real plate proportion.') },
        { type: 'number', key: 'plateThicknessMm', label: L('Grosor de la placa', 'Plate thickness'), unit: 'mm', min: 1.2, max: 8, step: 0.2 },
        {
          type: 'segmented',
          key: 'colorMode',
          options: [['layers', L('Por capas (sin AMS)', 'By layers (no AMS)')], ['mmu', L('Misma altura (AMS)', 'Same height (AMS)')]],
          hint: L('Por capas: cada color sube un escalón sobre el anterior y se imprime pausando y cambiando el filamento en las capas que se indican abajo. Misma altura: todo al mismo nivel, necesita AMS / multicolor.', 'By layers: each color is a step above the previous one and it prints by pausing and swapping filament at the layers shown below. Same height: everything at one level, needs an AMS / multicolor.'),
        },
        { type: 'number', key: 'layerStepMm', label: L('Alto de cada color', 'Height of each color'), unit: 'mm', min: 0.2, max: 2, step: 0.1, showIf: isLayers, tooltip: L('Cuánto sube cada color sobre el anterior. Conviene al menos 2 capas para que tape bien.', 'How far each color rises above the previous one. At least 2 layers is best so it covers well.') },
        { type: 'segmented', key: 'textStyle', showIf: (p) => !isLayers(p), options: [['raised', L('Relieve', 'Raised')], ['inlay', L('Embutido', 'Inlay')]], hint: L('Relieve: los colores sobresalen. Embutido: todo al ras, cara plana.', 'Raised: the colors stand out. Inlay: everything flush, flat face.') },
        { type: 'number', key: 'reliefMm', label: L('Alto del relieve', 'Relief height'), unit: 'mm', min: 0.4, max: 3, step: 0.1, showIf: (p) => !isLayers(p), tooltip: L('En embutido es la profundidad.', 'With inlay it is the depth.') },
        { type: 'checkbox', key: 'border', label: L('Borde alrededor', 'Border around') },
        { type: 'number', key: 'borderWidthMm', label: L('Ancho del borde', 'Border width'), unit: 'mm', min: 0.6, max: 4, step: 0.1, showIf: (p) => p.border },
      ],
    },
    {
      section: 'attach',
      title: L('Sujeción', 'Attachment'),
      controls: [
        {
          type: 'segmented',
          key: 'attach',
          options: [['ring', L('Argolla', 'Ring')], ['inside', L('Agujero', 'Hole')], ['none', L('Ninguna', 'None')]],
          hint: L('Argolla: orejita con agujero afuera de la patente. Agujero: dentro de la patente, al costado.', 'Ring: a small ear with a hole outside the plate. Hole: inside the plate, at the side.'),
        },
        { type: 'segmented', key: 'ringSide', showIf: hasRing, options: [['left', L('Izquierda', 'Left')], ['right', L('Derecha', 'Right')], ['top', L('Arriba', 'Top')]] },
        { type: 'number', key: 'ringHoleMm', label: L('Diámetro del agujero', 'Hole diameter'), unit: 'mm', min: 2, max: 10, step: 0.5, showIf: hasRing },
        { type: 'number', key: 'ringWallMm', label: L('Grosor de la orejita', 'Ear wall'), unit: 'mm', min: 1, max: 5, step: 0.2, showIf: (p) => p.attach === 'ring' },
      ],
    },
    {
      section: 'colors',
      title: L('Colores', 'Colors'),
      controls: [
        { type: 'color', key: 'colors.base', label: L('Placa', 'Plate'), showIf: isNew, hint: L('Cada color distinto es un cambio de filamento más. Con la franja y la bandera del color de los caracteres alcanza con uno solo.', 'Each different color is one more filament swap. With the band and the flag in the character color, a single one is enough.') },
        { type: 'color', key: 'colors.text', label: L('Caracteres y borde', 'Characters and border'), showIf: isNew },
        { type: 'color', key: 'colors.band', label: L('Franja', 'Band'), showIf: isNew },
        { type: 'color', key: 'colors.flag', label: L('Bandera', 'Flag'), showIf: (p) => isNew(p) && p.showFlag },
        { type: 'color', key: 'colors.oldBase', label: L('Placa y caracteres', 'Plate and characters'), showIf: isOld, hint: L('Los caracteres están calados en el recuadro: se ven del color de la placa. Con la leyenda del color del recuadro alcanza con un solo cambio de filamento.', 'The characters are cut out of the panel: they show the plate color. With the legend in the panel color a single filament swap is enough.') },
        { type: 'color', key: 'colors.oldPanel', label: L('Recuadro y borde', 'Panel and border'), showIf: isOld },
        { type: 'color', key: 'colors.oldLegend', label: L('Leyenda y escudo', 'Legend and coat of arms'), showIf: isOld },
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
