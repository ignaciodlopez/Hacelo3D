// Definición de la herramienta "Sello": metadata, schema del panel y presets.
import { defaults, normalizeParams, PARAMS_VERSION } from './params.js';
import { HANDLE_MODELS, elongatedHandle, handlePreview } from './handles.js';

const L = (es, en) => ({ es, en });
const hasHandle = (p) => p.handle !== 'none';

export default {
  id: 'stamp',
  status: 'active',
  icon: 'stamp',
  filePrefix: 'sello',
  name: L('Sello', 'Stamp'),
  short: L('Sello', 'Stamp'),
  description: L('Texto o ícono espejado en relieve, con mango', 'Mirrored raised text or icon with a handle'),
  paramsVersion: PARAMS_VERSION,
  migrate: (old) => old,
  normalize: normalizeParams,
  defaults,
  exports: ['stl-merged', 'zip-per-color', '3mf', 'png'],
  build: () => import('./build.js'),

  /** Resumen para el pedido por WhatsApp: pares [etiqueta, valor]. */
  orderSummary: (p, { lang, color, option, icon = (id) => id }) => {
    const es = lang === 'es';
    return [
      [es ? 'Texto' : 'Text', p.text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).join(' / ')],
      [es ? 'Ícono' : 'Icon', p.icon ? icon(p.icon) : ''],
      [es ? 'Placa' : 'Plate', option('shape', p.shape)],
      [es ? 'Mango' : 'Handle', option('handle', p.handle)],
      [es ? 'Color' : 'Color', color(p.colors.base)],
    ];
  },

  presets: [
    { id: 'classic', name: L('Rectangular · barra de agarre', 'Rectangle · bar grip'), params: {} },
    { id: 'round', name: L('Redondo · mango clásico', 'Round · classic handle'), params: { shape: 'circle', handle: 'knob', sizeMm: 40, lineSpacing: 0.9, marginMm: 5, ...HANDLE_MODELS.knob.dimensions } },
    { id: 'palm', name: L('Redondo · mango hongo', 'Round · mushroom handle'), params: { shape: 'circle', handle: 'mushroom', sizeMm: 36, marginMm: 5, ...HANDLE_MODELS.mushroom.dimensions } },
    { id: 'oval', name: L('Ovalado · mango ergonómico', 'Oval · ergonomic handle'), params: { shape: 'ellipse', handle: 'ergonomic', sizeMm: 45, marginMm: 6, ...HANDLE_MODELS.ergonomic.dimensions } },
    { id: 'compact', name: L('De bolsillo · agarre compacto', 'Pocket · compact grip'), params: { shape: 'rounded', handle: 'compact', sizeMm: 35, ...HANDLE_MODELS.compact.dimensions } },
    { id: 'bold', name: L('Letras gruesas', 'Bold letters'), params: { fontId: 'archivo-black', boldOffsetMm: 0, reliefMm: 2, handleWidthMm: 16 } },
    { id: 'flat', name: L('Sin mango (pegás el tuyo)', 'No handle (glue your own)'), params: { handle: 'none' } },
  ],
  presetKeep: ['icon', 'iconPosition', 'iconScale', 'fontId', 'colors', 'stampView'],

  schema: [
    {
      section: 'text',
      title: L('Diseño', 'Design'),
      controls: [
        {
          type: 'textarea',
          key: 'text',
          label: L('Texto del sello', 'Stamp text'),
          hint: L('Se ve espejado en el modelo a propósito: al estampar sale derecho. Podés dejarlo vacío y usar solo un ícono.', 'It looks mirrored in the model on purpose: it prints the right way round. You can leave it empty and use only an icon.'),
          rows: 3,
          maxLength: 130,
        },
        { type: 'fontSelect', key: 'fontId', label: L('Fuente', 'Font'), inline: true },
        { type: 'iconSelect', key: 'icon', label: L('Ícono', 'Icon'), inline: true },
        { type: 'segmented', key: 'iconPosition', showIf: (p) => !!p.icon && p.text.trim() !== '', options: [['before', L('Antes', 'Before')], ['after', L('Después', 'After')], ['both', L('Ambos lados', 'Both sides')]] },
        { type: 'segmented', key: 'align', options: [['left', L('Izquierda', 'Left')], ['center', L('Centro', 'Center')], ['right', L('Derecha', 'Right')]] },
        { type: 'number', key: 'lineSpacing', label: L('Interlineado', 'Line spacing'), unit: 'em', min: 0.6, max: 2, step: 0.05 },
        { type: 'number', key: 'sizeMm', label: L('Tamaño del diseño', 'Design size'), unit: 'mm', min: 10, max: 200, step: 1, tooltip: L('Ancho de las letras; si es solo un ícono, su lado mayor.', 'Width of the letters; for an icon alone, its longest side.') },
        { type: 'number', key: 'iconScale', showIf: (p) => !!p.icon && p.text.trim() !== '', label: L('Tamaño del ícono', 'Icon size'), min: 0.3, max: 3, step: 0.1, advanced: true, tooltip: L('Relativo al alto de las mayúsculas.', 'Relative to the capital height.') },
        { type: 'number', key: 'letterSpacingMm', label: L('Espaciado de letras', 'Letter spacing'), unit: 'mm', min: -3, max: 5, step: 0.1, advanced: true },
        { type: 'number', key: 'boldOffsetMm', label: L('Engrosar letras', 'Thicken letters'), unit: 'mm', min: 0, max: 1, step: 0.05, advanced: true, tooltip: L('Los trazos finos no estampan bien: conviene engrosar.', 'Thin strokes do not stamp well: thickening helps.') },
        { type: 'checkbox', key: 'uppercase', label: L('Todo en mayúsculas', 'All caps'), advanced: true },
      ],
    },
    {
      section: 'plate',
      title: L('Placa', 'Plate'),
      controls: [
        { type: 'segmented', key: 'shape', options: [['rounded', L('Rectángulo', 'Rectangle')], ['circle', L('Círculo', 'Circle')], ['ellipse', L('Óvalo', 'Oval')]] },
        { type: 'number', key: 'marginMm', label: L('Borde alrededor', 'Margin around'), unit: 'mm', min: 1, max: 20, step: 0.5 },
        { type: 'number', key: 'plateThicknessMm', label: L('Grosor de la placa', 'Plate thickness'), unit: 'mm', min: 1.2, max: 10, step: 0.2 },
        { type: 'number', key: 'reliefMm', label: L('Alto del relieve', 'Relief height'), unit: 'mm', min: 0.4, max: 4, step: 0.1, tooltip: L('Entre 1,2 y 2 mm estampa bien.', 'Between 1.2 and 2 mm stamps well.') },
        { type: 'number', key: 'cornerRadiusMm', label: L('Esquinas redondeadas', 'Rounded corners'), unit: 'mm', min: 0, max: 30, step: 0.5, advanced: true, showIf: (p) => p.shape === 'rounded' },
      ],
    },
    {
      section: 'handle',
      title: L('Mango', 'Handle'),
      controls: [
        {
          type: 'segmented', key: 'handle', label: L('Modelo del mango', 'Handle style'),
          options: Object.entries(HANDLE_MODELS).map(([id, model]) => [id, model.name]),
          illustrations: Object.fromEntries(Object.keys(HANDLE_MODELS).map((id) => [id, handlePreview(id)])),
          hint: (p) => HANDLE_MODELS[p.handle].hint,
          alsoSet: (id, p) => id === p.handle ? {} : HANDLE_MODELS[id].dimensions,
        },
        { type: 'segmented', key: 'stampView', label: L('Vista', 'View'), showIf: hasHandle, options: [['use', L('Mango arriba', 'Handle up')], ['print', L('Para imprimir', 'Print orientation')]], hint: L('Para imprimir: mango contra la cama y relieve hacia arriba. La transición a la placa se calcula para evitar soportes.', 'Print with the handle on the bed and relief facing up. The transition to the plate is calculated to avoid supports.') },
        {
          type: 'number',
          key: 'handleWidthMm',
          label: L('Ancho del mango', 'Handle width'),
          unit: 'mm',
          min: 8,
          max: 80,
          step: 1,
          showIf: hasHandle,
          tooltip: L('La cabeza puede ser más ancha que una placa angosta. Se limita según el lado mayor de la placa. Cada modelo carga medidas sugeridas.', 'The head may be wider than a narrow plate. Its size is limited by the longest plate side. Each style loads suggested dimensions.'),
        },
        { type: 'number', key: 'handleLengthMm', label: L('Largo del mango', 'Handle length'), unit: 'mm', min: 15, max: 150, step: 1, showIf: (p) => elongatedHandle(p.handle) },
        { type: 'number', key: 'handleHeightMm', label: L('Alto del agarre', 'Grip height'), unit: 'mm', min: 5, max: 80, step: 1, showIf: hasHandle, tooltip: L('Altura de la parte que sujetás. La transición y la placa se suman por debajo; si hace falta, se aumenta para evitar voladizos pronunciados.', 'Height of the part you hold. The transition and plate add height below it; it increases if needed to avoid steep overhangs.') },
      ],
    },
    {
      section: 'colors',
      title: L('Color', 'Color'),
      controls: [{ type: 'color', key: 'colors.base', label: L('Sello', 'Stamp') }],
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
