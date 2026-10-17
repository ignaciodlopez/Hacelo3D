// Definición de la herramienta "Topper de torta": metadata, schema del panel y presets.
import { defaults, normalizeParams, PARAMS_VERSION } from './params.js';

const L = (es, en) => ({ es, en });
const hasSticks = (p) => p.sticks > 0;

export default {
  id: 'topper',
  status: 'active',
  icon: 'cake',
  filePrefix: 'topper',
  name: L('Topper de torta', 'Cake topper'),
  short: L('Topper', 'Topper'),
  description: L('Escribí el texto y descargá el adorno de torta listo para imprimir, con sus palitos', 'Type the text and download a print-ready cake topper, with its sticks'),
  paramsVersion: PARAMS_VERSION,
  migrate: (old) => old,
  normalize: normalizeParams,
  defaults,
  exports: ['stl-merged', 'zip-per-color', '3mf', 'png'],
  build: () => import('./build.js'),

  /** Resumen para el pedido por WhatsApp: pares [etiqueta, valor]. */
  orderSummary: (p, { lang, color }) => {
    const es = lang === 'es';
    return [
      [es ? 'Texto' : 'Text', p.text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).join(' / ')],
      [es ? 'Palitos' : 'Sticks', String(p.sticks)],
      [es ? 'Colores' : 'Colors', es ? `${color(p.colors.base)} con letras ${color(p.colors.text)}` : `${color(p.colors.base)} with ${color(p.colors.text)} letters`],
    ];
  },

  presets: [
    { id: 'classic', name: L('Clásico (2 palitos)', 'Classic (2 sticks)'), params: {} },
    { id: 'round', name: L('Redondo', 'Round'), params: { shape: 'circle', sizeMm: 110, lineSpacing: 0.9, sticks: 1, marginMm: 5 } },
    { id: 'oval', name: L('Óvalo con letras al ras', 'Oval, flush letters'), params: { shape: 'ellipse', relief: false, sizeMm: 130, marginMm: 6, sticks: 2 } },
    { id: 'bold', name: L('Letras gruesas', 'Bold letters'), params: { fontId: 'archivo-black', fill: 'tight', sizeMm: 140, lineSpacing: 0.9, colors: { base: '#e53935', text: '#ffffff' } } },
  ],

  schema: [
    {
      section: 'text',
      title: L('Texto', 'Text'),
      controls: [
        { type: 'textarea', key: 'text', label: L('Texto del topper', 'Topper text'), hint: L('Con Enter pasás a otro renglón. Todo queda unido en una sola pieza.', 'Press Enter for another line. Everything stays joined in one piece.'), rows: 3, maxLength: 130 },
        { type: 'fontSelect', key: 'fontId', label: L('Fuente', 'Font'), inline: true },
        { type: 'segmented', key: 'align', options: [['left', L('Izquierda', 'Left')], ['center', L('Centro', 'Center')], ['right', L('Derecha', 'Right')]] },
        { type: 'number', key: 'lineSpacing', label: L('Interlineado', 'Line spacing'), unit: 'em', min: 0.6, max: 2, step: 0.05 },
        { type: 'number', key: 'sizeMm', label: L('Ancho de las letras', 'Letters width'), unit: 'mm', min: 20, max: 250, step: 5 },
        { type: 'number', key: 'letterSpacingMm', label: L('Espaciado de letras', 'Letter spacing'), unit: 'mm', min: -3, max: 5, step: 0.1, advanced: true, tooltip: L('Negativo acerca las letras: útil para que las cursivas se toquen.', 'Negative values bring letters closer: useful so scripts connect.') },
        { type: 'number', key: 'boldOffsetMm', label: L('Engrosar letras', 'Thicken letters'), unit: 'mm', min: 0, max: 1, step: 0.1, advanced: true, tooltip: L('Útil para fuentes finas.', 'Useful for thin fonts.') },
        { type: 'checkbox', key: 'uppercase', label: L('Todo en mayúsculas', 'All caps'), advanced: true },
      ],
    },
    {
      section: 'shape',
      title: L('Forma', 'Shape'),
      controls: [
        { type: 'segmented', key: 'shape', options: [['silhouette', L('Silueta', 'Silhouette')], ['circle', L('Círculo', 'Circle')], ['ellipse', L('Óvalo', 'Oval')]] },
        { type: 'segmented', key: 'fill', showIf: (p) => p.shape === 'silhouette', options: [['filled', L('Fondo relleno', 'Filled')], ['tight', L('Ajustado a las letras', 'Tight to letters')]] },
        { type: 'number', key: 'marginMm', label: L('Borde alrededor', 'Margin around'), unit: 'mm', min: 1, max: 15, step: 0.5 },
        { type: 'number', key: 'baseThicknessMm', label: L('Grosor', 'Thickness'), unit: 'mm', min: 1.2, max: 10, step: 0.2 },
        { type: 'checkbox', key: 'relief', label: L('Letras en relieve', 'Raised letters') },
        { type: 'number', key: 'reliefMm', label: L('Alto del relieve', 'Relief height'), unit: 'mm', min: 0.4, max: 5, step: 0.1, showIf: (p) => p.relief },
      ],
    },
    {
      section: 'sticks',
      title: L('Palitos', 'Sticks'),
      controls: [
        { type: 'segmented', key: 'sticks', options: [[0, L('Ninguno', 'None')], [1, '1'], [2, '2'], [3, '3']] },
        { type: 'number', key: 'stickLengthMm', label: L('Largo del palito', 'Stick length'), unit: 'mm', min: 20, max: 200, step: 5, showIf: hasSticks, hint: L('Medido desde el borde inferior de la base. El PLA no es apto para alimentos: no lo claves directo en la torta.', 'Measured from the bottom edge of the base. PLA is not food-safe: do not push it directly into the cake.') },
        { type: 'number', key: 'stickWidthMm', label: L('Ancho del palito', 'Stick width'), unit: 'mm', min: 2, max: 12, step: 0.5, showIf: hasSticks },
      ],
    },
    {
      section: 'colors',
      title: L('Colores', 'Colors'),
      controls: [
        { type: 'color', key: 'colors.base', label: L('Base y palitos', 'Base and sticks') },
        { type: 'color', key: 'colors.text', label: L('Letras', 'Letters') },
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
