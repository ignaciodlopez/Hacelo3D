// Definición de la herramienta "Organizador de escritorio": metadata, schema del panel y presets.
// Una sola pieza: un lapicero (taza alta) y un soporte de celular (placa inclinada con labio) sobre una misma base.
import { defaults, normalizeParams, PARAMS_VERSION } from './params.js';

const L = (es, en) => ({ es, en });

/** Lo que cada preset NO pisa: el juego de tu celular, de qué lado va, los colores y la calidad. */
const KEEP = ['phoneSlotMm', 'phoneSide', 'colors', 'curveQuality', 'snapToLayers'];

const hasPens = (p) => p.pens;
const hasPhone = (p) => p.phone;

export default {
  id: 'desk',
  status: 'active',
  icon: 'desk',
  filePrefix: 'organizador',
  name: L('Organizador de escritorio', 'Desk organizer'),
  short: L('Escritorio', 'Desk'),
  description: L('Un lapicero grande y un soporte inclinado para el celular, sobre la misma base.', 'A large pen cup and a tilted phone stand on one shared base.'),
  paramsVersion: PARAMS_VERSION,
  // la versión 1 era otro diseño (módulos de lapicero, celular, notas y bandeja): sus parámetros no sirven
  migrate: () => ({}),
  normalize: normalizeParams,
  defaults,
  presetKeep: KEEP,
  exports: ['stl-merged', 'zip-per-color', '3mf', 'png'],
  build: () => import('./build.js'),

  /** Resumen para el pedido por WhatsApp: pares [etiqueta, valor]. */
  orderSummary: (p, { lang, color }) => {
    const es = lang === 'es';
    const mm = (n) => (es ? String(n).replace('.', ',') : String(n));
    const dividers = p.cupDividers > 0 ? (es ? `, ${p.cupDividers} ${p.cupDividers === 1 ? 'división' : 'divisiones'}` : `, ${p.cupDividers} ${p.cupDividers === 1 ? 'divider' : 'dividers'}`) : '';
    return [
      [es ? 'Lapicero' : 'Pen holder', p.pens ? `${mm(p.cupWidthMm)} × ${mm(p.cupDepthMm)} × ${mm(p.cupHeightMm)} mm${dividers}` : ''],
      [
        es ? 'Celular' : 'Phone',
        p.phone ? (es ? `ranura de ${mm(p.phoneSlotMm)} mm, inclinación de ${mm(p.phoneAngleDeg)}°, ancho de ${mm(p.phoneWidthMm)} mm` : `${mm(p.phoneSlotMm)} mm slot, ${mm(p.phoneAngleDeg)}° tilt, ${mm(p.phoneWidthMm)} mm wide`) : '',
      ],
      [es ? 'Color' : 'Color', color(p.colors.base)],
    ];
  },

  presets: [
    { id: 'classic', name: L('Clásico: lapicero y soporte de celular', 'Classic: pen cup and phone stand'), params: {} },
    { id: 'compact', name: L('Compacto para cama de 18 cm', 'Compact for an 18 cm bed'), params: { cupWidthMm: 56, cupDepthMm: 70, cupHeightMm: 70, phoneWidthMm: 78, phoneHeightMm: 70 } },
    { id: 'dividers', name: L('Lapicero con divisiones', 'Pen cup with dividers'), params: { cupDividers: 2 } },
    { id: 'pens-only', name: L('Solo lapicero', 'Pen cup only'), params: { phone: false } },
    { id: 'phone-only', name: L('Solo soporte de celular', 'Phone stand only'), params: { pens: false } },
  ],

  schema: [
    {
      section: 'pens',
      title: L('Lapicero', 'Pen holder'),
      controls: [
        { type: 'checkbox', key: 'pens', label: L('Con lapicero', 'With pen holder') },
        { type: 'number', key: 'cupWidthMm', label: L('Ancho', 'Width'), unit: 'mm', min: 40, max: 140, step: 1, showIf: hasPens },
        {
          type: 'number',
          key: 'cupDepthMm',
          label: L('Fondo', 'Depth'),
          unit: 'mm',
          min: 40,
          max: 140,
          step: 1,
          showIf: hasPens,
          hint: L('Si el soporte del celular necesita más fondo, la base crece sola.', 'If the phone stand needs more depth, the base grows by itself.'),
        },
        { type: 'number', key: 'cupHeightMm', label: L('Alto', 'Height'), unit: 'mm', min: 30, max: 150, step: 1, showIf: hasPens },
        {
          type: 'number',
          key: 'cupDividers',
          label: L('Divisiones', 'Dividers'),
          min: 0,
          max: 3,
          step: 1,
          showIf: hasPens,
          tooltip: L('Paredes a lo ancho que separan lápices, tijeras y reglas. Cada compartimiento tiene que medir al menos 12 mm.', 'Walls across the cup to keep pens, scissors and rulers apart. Each compartment has to be at least 12 mm wide.'),
        },
      ],
    },
    {
      section: 'phone',
      title: L('Soporte de celular', 'Phone stand'),
      controls: [
        { type: 'checkbox', key: 'phone', label: L('Con soporte para el celular', 'With phone stand') },
        {
          type: 'number',
          key: 'phoneSlotMm',
          label: L('Ancho de la ranura', 'Slot width'),
          unit: 'mm',
          min: 8,
          max: 30,
          step: 0.5,
          showIf: hasPhone,
          hint: L('Entre el labio y la placa. El grosor del celular con funda, más 1 o 2 mm de juego.', 'Between the lip and the plate. The phone thickness with its case, plus 1 or 2 mm of play.'),
        },
        {
          type: 'slider',
          key: 'phoneAngleDeg',
          label: L('Inclinación', 'Tilt'),
          unit: '°',
          min: 0,
          max: 30,
          step: 1,
          showIf: hasPhone,
          tooltip: L('Cuánto se echa hacia atrás la placa. Más de 30° no se imprime sin soportes.', 'How far the plate leans back. More than 30° does not print without supports.'),
        },
        { type: 'number', key: 'phoneWidthMm', label: L('Ancho del soporte', 'Stand width'), unit: 'mm', min: 60, max: 140, step: 1, showIf: hasPhone, hint: L('Con 140 mm entra una tablet.', 'At 140 mm a tablet fits.') },
        { type: 'number', key: 'phoneHeightMm', label: L('Alto de la placa', 'Plate height'), unit: 'mm', min: 40, max: 150, step: 1, showIf: hasPhone },
        { type: 'number', key: 'phoneLipMm', label: L('Alto del labio', 'Lip height'), unit: 'mm', min: 3, max: 20, step: 0.5, showIf: hasPhone, advanced: true },
      ],
    },
    {
      section: 'general',
      title: L('Medidas generales', 'General sizes'),
      collapsed: true,
      controls: [
        { type: 'segmented', key: 'phoneSide', label: L('Celular del lado', 'Phone on the'), options: [['right', L('Derecho', 'Right')], ['left', L('Izquierdo', 'Left')]], showIf: (p) => p.pens && p.phone },
        { type: 'number', key: 'wallMm', label: L('Pared', 'Wall'), unit: 'mm', min: 1.6, max: 6, step: 0.2, tooltip: L('Pared de la taza, de las divisiones y espesor de la placa.', 'Wall of the cup and the dividers, and plate thickness.') },
        { type: 'number', key: 'baseMm', label: L('Base', 'Base'), unit: 'mm', min: 2, max: 8, step: 0.2, tooltip: L('Espesor de la chapa de abajo, que también es el fondo de la taza.', 'Thickness of the bottom sheet, which is also the floor of the cup.') },
        { type: 'number', key: 'cornerRadiusMm', label: L('Esquinas redondeadas', 'Rounded corners'), unit: 'mm', min: 0, max: 25, step: 1 },
        {
          type: 'number',
          key: 'edgeRadiusMm',
          label: L('Bordes suaves', 'Soft edges'),
          unit: 'mm',
          min: 0,
          max: 4,
          step: 0.5,
          tooltip: L('Redondeo del borde de arriba. Se limita solo en paredes finas, para que quede un poco de plano arriba.', 'Rounding of the top edge. Limited on thin walls so a little flat is left on top.'),
        },
      ],
    },
    {
      section: 'colors',
      title: L('Colores', 'Colors'),
      controls: [{ type: 'color', key: 'colors.base', label: L('Pieza', 'Piece') }],
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
