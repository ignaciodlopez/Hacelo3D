// Definición de la herramienta "Organizador de escritorio": metadata, schema del panel y presets.
// Una sola pieza con módulos: lapicero, celular, notas adhesivas, tarjetas, bandeja y un texto en el frente.
import { defaults, normalizeParams, NOTE_SIZES, PARAMS_VERSION } from './params.js';

const L = (es, en) => ({ es, en });

/** Lo que cada preset NO pisa: las medidas de tu celular, el texto, los colores y la calidad. */
const KEEP = ['phoneWidthMm', 'phoneThicknessMm', 'label', 'fontId', 'labelStyle', 'colors', 'curveQuality', 'snapToLayers'];

const hasPens = (p) => p.pens;
const hasPhone = (p) => p.phone;
const hasNotes = (p) => p.notes !== 'none';
const hasLabel = (p) => p.label.trim() !== '';

const SHAPE_NAME = { round: ['redondas', 'round'], square: ['cuadradas', 'square'], hex: ['hexagonales', 'hexagonal'] };

export default {
  id: 'desk',
  status: 'active',
  icon: 'desk',
  filePrefix: 'organizador',
  name: L('Organizador de escritorio', 'Desk organizer'),
  short: L('Escritorio', 'Desk'),
  description: L('Cantidad y tamaño de espacios para lápices, celular y notas adhesivas.', 'Number and size of spaces for pens, phone and sticky notes.'),
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
    const mm = (n) => (es ? String(n).replace('.', ',') : String(n));
    const shape = SHAPE_NAME[p.penShape][es ? 0 : 1];
    const notes = p.notes === 'custom' ? [p.notesWidthMm, p.notesDepthMm] : NOTE_SIZES[p.notes];
    return [
      [es ? 'Lapicero' : 'Pen holder', p.pens ? `${p.penCols * p.penRows} ${es ? 'celdas' : 'cells'} ${shape} (${p.penCols} × ${p.penRows}) ${es ? 'de' : 'of'} ${mm(p.penCellMm)} mm` : ''],
      [es ? 'Celular' : 'Phone', p.phone ? `${es ? 'hasta' : 'up to'} ${mm(p.phoneWidthMm)} × ${mm(p.phoneThicknessMm)} mm` : ''],
      [es ? 'Notas adhesivas' : 'Sticky notes', notes ? `${mm(notes[0])} × ${mm(notes[1])} mm` : ''],
      [es ? 'Tarjetas' : 'Cards', p.cards ? (es ? 'sí' : 'yes') : ''],
      [es ? 'Bandeja' : 'Tray', p.tray ? (es ? 'sí' : 'yes') : ''],
      [es ? 'Texto' : 'Text', hasLabel(p) ? p.label.trim() : ''],
      [es ? 'Color' : 'Color', p.labelStyle === 'relief' && hasLabel(p) && p.colors.text !== p.colors.base ? `${color(p.colors.base)} ${es ? 'con texto' : 'with'} ${color(p.colors.text)}${es ? '' : ' text'}` : color(p.colors.base)],
    ];
  },

  presets: [
    { id: 'full', name: L('Completo: celular, lapicero y notas', 'Full: phone, pens and notes'), params: {} },
    { id: 'compact', name: L('Compacto para cama de 18 cm', 'Compact for an 18 cm bed'), params: { penCols: 2, penRows: 1, penCellMm: 26, notes: 'none' } },
    { id: 'pens-only', name: L('Solo lapicero (6 celdas)', 'Pen holder only (6 cells)'), params: { phone: false, notes: 'none', penCols: 3, penRows: 2 } },
    { id: 'phone-notes', name: L('Base para celular con notas', 'Phone stand with notes'), params: { pens: false } },
    { id: 'big', name: L('Grande con bandeja y tarjetas', 'Large with tray and cards'), params: { tray: true, cards: true, penCols: 3, notes: 'custom', notesWidthMm: 76, notesDepthMm: 127 } },
  ],

  schema: [
    {
      section: 'pens',
      title: L('Lapicero', 'Pen holder'),
      controls: [
        { type: 'checkbox', key: 'pens', label: L('Con lapicero', 'With pen holder') },
        {
          type: 'segmented',
          key: 'penShape',
          showIf: hasPens,
          options: [['round', L('Redondas', 'Round')], ['square', L('Cuadradas', 'Square')], ['hex', L('Hexagonales', 'Hexagonal')]],
        },
        { type: 'number', key: 'penCols', label: L('Celdas a lo ancho', 'Cells across'), min: 1, max: 6, step: 1, showIf: hasPens },
        { type: 'number', key: 'penRows', label: L('Filas', 'Rows'), min: 1, max: 3, step: 1, showIf: hasPens, tooltip: L('Cada fila va un escalón más alta que la de adelante.', 'Each row is one step higher than the one in front.') },
        {
          type: 'number',
          key: 'penCellMm',
          label: L('Tamaño de cada celda', 'Cell size'),
          unit: 'mm',
          min: 14,
          max: 70,
          step: 1,
          showIf: hasPens,
          hint: L('Diámetro (redondas), lado (cuadradas) o medida entre caras (hexagonales). 30 mm entra un puñado de biromes.', 'Diameter (round), side (square) or across flats (hexagonal). 30 mm fits a handful of pens.'),
        },
        { type: 'number', key: 'penHeightMm', label: L('Alto de la fila de atrás', 'Back row height'), unit: 'mm', min: 40, max: 150, step: 5, showIf: hasPens },
        { type: 'number', key: 'penStepMm', label: L('Escalón entre filas', 'Step between rows'), unit: 'mm', min: 0, max: 40, step: 1, showIf: (p) => p.pens && p.penRows > 1, tooltip: L('Cuánto más baja es cada fila que la de atrás (0 = todas iguales).', 'How much lower each row is than the one behind (0 = all the same).') },
      ],
    },
    {
      section: 'phone',
      title: L('Celular', 'Phone'),
      controls: [
        { type: 'checkbox', key: 'phone', label: L('Con soporte para el celular', 'With phone stand') },
        { type: 'number', key: 'phoneWidthMm', label: L('Ancho del celular', 'Phone width'), unit: 'mm', min: 60, max: 100, step: 1, showIf: hasPhone, hint: L('Con funda. La ranura mide 4 mm más.', 'With its case. The slot is 4 mm wider.') },
        { type: 'number', key: 'phoneThicknessMm', label: L('Grosor del celular', 'Phone thickness'), unit: 'mm', min: 7, max: 22, step: 0.5, showIf: hasPhone, hint: L('Con funda. La ranura mide 1,5 mm más.', 'With its case. The slot is 1.5 mm thicker.') },
        {
          type: 'slider',
          key: 'phoneAngleDeg',
          label: L('Inclinación', 'Tilt'),
          unit: '°',
          min: 0,
          max: 30,
          step: 1,
          showIf: hasPhone,
          tooltip: L('Cuánto se echa hacia atrás el celular. Más de 30° no se imprime sin soportes.', 'How far the phone leans back. More than 30° does not print without supports.'),
        },
        { type: 'checkbox', key: 'phoneCable', label: L('Muesca para el cable de carga', 'Charging cable notch'), showIf: hasPhone },
        { type: 'number', key: 'phoneLipMm', label: L('Alto del labio', 'Lip height'), unit: 'mm', min: 8, max: 30, step: 1, showIf: hasPhone, advanced: true },
        { type: 'number', key: 'phoneBackMm', label: L('Alto del respaldo', 'Back height'), unit: 'mm', min: 40, max: 120, step: 5, showIf: hasPhone, advanced: true },
      ],
    },
    {
      section: 'notes',
      title: L('Notas adhesivas', 'Sticky notes'),
      controls: [
        {
          type: 'select',
          key: 'notes',
          label: L('Taco de notas', 'Notes pad'),
          options: [
            ['none', L('Sin notas', 'No notes')],
            ['76x76', '76 × 76 mm'],
            ['51x76', '51 × 76 mm'],
            ['38x51', '38 × 51 mm'],
            ['custom', L('A medida', 'Custom')],
          ],
        },
        { type: 'number', key: 'notesWidthMm', label: L('Ancho del taco', 'Pad width'), unit: 'mm', min: 30, max: 130, step: 1, showIf: (p) => p.notes === 'custom' },
        { type: 'number', key: 'notesDepthMm', label: L('Fondo del taco', 'Pad depth'), unit: 'mm', min: 30, max: 130, step: 1, showIf: (p) => p.notes === 'custom' },
        { type: 'number', key: 'notesHeightMm', label: L('Alto del bolsillo', 'Pocket height'), unit: 'mm', min: 15, max: 60, step: 1, showIf: hasNotes },
        { type: 'checkbox', key: 'notesNotch', label: L('Muesca para agarrar las hojas', 'Notch to grab the sheets'), showIf: hasNotes },
        {
          type: 'number',
          key: 'notesClearanceMm',
          label: L('Juego del taco', 'Pad clearance'),
          unit: 'mm',
          min: 0.5,
          max: 4,
          step: 0.5,
          showIf: hasNotes,
          advanced: true,
          tooltip: L('Lo que sobra alrededor del taco, por lado: más, entra más suelto.', 'Room around the pad, per side: more is looser.'),
        },
      ],
    },
    {
      section: 'extras',
      title: L('Bandeja y tarjetas', 'Tray and cards'),
      controls: [
        { type: 'checkbox', key: 'tray', label: L('Bandeja adelante (clips, gomas, pendrives)', 'Tray in front (clips, erasers, flash drives)') },
        { type: 'number', key: 'trayDepthMm', label: L('Fondo de la bandeja', 'Tray depth'), unit: 'mm', min: 20, max: 80, step: 1, showIf: (p) => p.tray },
        { type: 'number', key: 'trayHeightMm', label: L('Alto de la bandeja', 'Tray height'), unit: 'mm', min: 12, max: 40, step: 1, showIf: (p) => p.tray },
        { type: 'number', key: 'trayDividers', label: L('Divisiones', 'Dividers'), min: 0, max: 4, step: 1, showIf: (p) => p.tray },
        { type: 'checkbox', key: 'trayScoop', label: L('Fondo redondeado adelante', 'Rounded front bottom'), showIf: (p) => p.tray, advanced: true },
        { type: 'checkbox', key: 'cards', label: L('Ranura para tarjetas personales', 'Business card slot') },
      ],
    },
    {
      section: 'label',
      title: L('Texto', 'Text'),
      controls: [
        { type: 'text', key: 'label', label: L('Texto en el frente', 'Text on the front'), maxLength: 30, placeholder: L('Mi escritorio', 'My desk') },
        { type: 'fontSelect', key: 'fontId', label: L('Fuente', 'Font'), inline: true, showIf: hasLabel },
        { type: 'segmented', key: 'labelStyle', showIf: hasLabel, options: [['engraved', L('Grabado', 'Engraved')], ['relief', L('En relieve', 'Raised')]] },
        { type: 'number', key: 'labelSizeMm', label: L('Alto de las letras', 'Letter height'), unit: 'mm', min: 4, max: 20, step: 1, showIf: hasLabel },
        { type: 'number', key: 'labelDepthMm', label: L('Relieve / profundidad', 'Relief / depth'), unit: 'mm', min: 0.4, max: 1.6, step: 0.2, showIf: hasLabel, advanced: true },
      ],
    },
    {
      section: 'general',
      title: L('Medidas generales', 'General sizes'),
      collapsed: true,
      controls: [
        { type: 'segmented', key: 'phoneSide', label: L('Celular del lado', 'Phone on the'), options: [['left', L('Izquierdo', 'Left')], ['right', L('Derecho', 'Right')]], showIf: hasPhone },
        {
          type: 'number',
          key: 'podGapMm',
          label: L('Separación entre módulos', 'Gap between modules'),
          unit: 'mm',
          min: 0,
          max: 10,
          step: 1,
          tooltip: L('Ranura entre un módulo y otro, sobre un zócalo bajo. Con 0 comparten una pared y la pieza es más angosta.', 'Groove between one module and the next, on a low base. With 0 they share a wall and the piece is narrower.'),
        },
        { type: 'number', key: 'wallMm', label: L('Pared', 'Wall'), unit: 'mm', min: 1.6, max: 5, step: 0.2 },
        { type: 'number', key: 'floorMm', label: L('Fondo', 'Floor'), unit: 'mm', min: 1.2, max: 5, step: 0.2 },
        { type: 'number', key: 'cornerRadiusMm', label: L('Esquinas redondeadas', 'Rounded corners'), unit: 'mm', min: 0, max: 20, step: 1 },
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
      controls: [
        { type: 'color', key: 'colors.base', label: L('Pieza', 'Piece') },
        { type: 'color', key: 'colors.text', label: L('Texto', 'Text'), showIf: (p) => hasLabel(p) && p.labelStyle === 'relief' },
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
