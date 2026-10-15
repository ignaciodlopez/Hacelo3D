// Definición de la herramienta "Sello": metadata, schema del panel y presets.
import { defaults, normalizeParams, PARAMS_VERSION } from './params.js';

const L = (es, en) => ({ es, en });
const hasHandle = (p) => p.handle !== 'none';

export default {
  id: 'stamp',
  status: 'active',
  icon: 'stamp',
  filePrefix: 'sello',
  name: L('Sello', 'Stamp'),
  description: L('Texto o ícono espejado en relieve, con mango, listo para imprimir sin soportes', 'Mirrored raised text or icon with a handle, ready to print without supports'),
  paramsVersion: PARAMS_VERSION,
  migrate: (old) => old,
  normalize: normalizeParams,
  defaults,
  exports: ['stl-merged', 'zip-per-color', '3mf', 'png'],
  build: () => import('./build.js'),

  presets: [
    { id: 'classic', name: L('Rectangular con mango de barra', 'Rectangular with bar handle'), params: {} },
    { id: 'round', name: L('Redondo con perilla', 'Round with knob'), params: { shape: 'circle', handle: 'knob', sizeMm: 40, lineSpacing: 0.9, marginMm: 5, handleWidthMm: 28 } },
    { id: 'bold', name: L('Letras gruesas', 'Bold letters'), params: { fontId: 'archivo-black', boldOffsetMm: 0, reliefMm: 2 } },
    { id: 'flat', name: L('Sin mango (pegás el tuyo)', 'No handle (glue your own)'), params: { handle: 'none' } },
  ],

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
        { type: 'segmented', key: 'handle', options: [['knob', L('Perilla', 'Knob')], ['bar', L('Barra', 'Bar')], ['none', L('Sin mango', 'None')]] },
        {
          type: 'number',
          key: 'handleWidthMm',
          label: L('Ancho del mango', 'Handle width'),
          unit: 'mm',
          min: 8,
          max: 80,
          step: 1,
          showIf: hasHandle,
          hint: L('Se imprime con el mango contra la cama y el diseño hacia arriba: no necesita soportes.', 'It prints with the handle on the bed and the design facing up: no supports needed.'),
        },
        { type: 'number', key: 'handleLengthMm', label: L('Largo de la barra', 'Bar length'), unit: 'mm', min: 15, max: 150, step: 1, showIf: (p) => p.handle === 'bar' },
        { type: 'number', key: 'handleHeightMm', label: L('Alto del mango', 'Handle height'), unit: 'mm', min: 5, max: 80, step: 1, showIf: hasHandle },
      ],
    },
    {
      section: 'colors',
      title: L('Color', 'Color'),
      controls: [{ type: 'color', key: 'colors.base', label: L('Sello', 'Stamp') }],
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
