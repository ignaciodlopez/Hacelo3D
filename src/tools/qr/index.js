// Definición de la herramienta "Código QR": metadata, schema del panel y presets.
import { defaults, normalizeParams, PARAMS_VERSION, VOLATILE_KEYS } from './params.js';

const L = (es, en) => ({ es, en });
const isType = (type) => (p) => p.contentType === type;
const hasRing = (p) => p.ring !== 'none';
const hasLabel = (p) => p.label.trim() !== '';
const hasMagnets = (p) => p.magnets > 0;

export default {
  id: 'qr',
  status: 'active',
  icon: 'qr',
  filePrefix: 'qr',
  name: L('Código QR', 'QR code'),
  short: L('QR', 'QR'),
  description: L('Enlace, Wi-Fi o contacto en una placa o llavero, con el código en relieve o al ras', 'A link, Wi-Fi or contact on a plaque or keychain, with the code raised or flush'),
  paramsVersion: PARAMS_VERSION,
  migrate: (old) => old,
  normalize: normalizeParams,
  defaults,
  volatileKeys: VOLATILE_KEYS,
  exports: ['stl-merged', 'zip-per-color', '3mf', 'png'],
  build: () => import('./build.js'),

  /** Resumen para el pedido por WhatsApp. No incluye el contenido: puede ser una contraseña de Wi-Fi o un dato personal. */
  orderSummary: (p, { lang, option }) => {
    const es = lang === 'es';
    return [
      [es ? 'Tipo de código' : 'Code type', option('contentType', p.contentType)],
      [es ? 'Tamaño' : 'Size', `${p.sizeMm} mm`],
      [es ? 'Texto debajo' : 'Label', (p.label ?? '').trim()],
    ];
  },

  presets: [
    { id: 'classic', name: L('Placa blanca y negra', 'Black and white plaque'), params: {} },
    { id: 'keychain', name: L('Llavero', 'Keychain'), params: { sizeMm: 30, marginMm: 3, cornerRadiusMm: 3, ring: 'top' } },
    { id: 'wifi', name: L('Placa Wi-Fi', 'Wi-Fi plaque'), params: { contentType: 'wifi', label: 'Wi-Fi', sizeMm: 50 } },
    { id: 'inverted', name: L('Claro sobre oscuro', 'Light on dark'), params: { colors: { base: '#111111', code: '#ffffff' } } },
  ],

  schema: [
    {
      section: 'content',
      title: L('Contenido', 'Content'),
      controls: [
        { type: 'segmented', key: 'contentType', options: [['text', L('Enlace', 'Link')], ['wifi', 'Wi-Fi'], ['contact', L('Contacto', 'Contact')]] },
        {
          type: 'textarea',
          key: 'text',
          showIf: isType('text'),
          label: L('Enlace o texto', 'Link or text'),
          hint: L('Si escribís una dirección sin https://, se la agregamos.', 'If you type an address without https://, we add it.'),
          rows: 3,
          maxLength: 300,
        },
        { type: 'text', key: 'wifiSsid', showIf: isType('wifi'), label: L('Nombre de la red', 'Network name'), maxLength: 64 },
        { type: 'select', key: 'wifiSecurity', showIf: isType('wifi'), label: L('Seguridad', 'Security'), options: [['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP'], ['nopass', L('Sin contraseña', 'No password')]] },
        {
          type: 'text',
          key: 'wifiPassword',
          showIf: (p) => p.contentType === 'wifi' && p.wifiSecurity !== 'nopass',
          label: L('Contraseña', 'Password'),
          maxLength: 64,
          hint: L('No se guarda en el navegador ni viaja en el enlace compartido.', 'It is not saved in the browser nor included in the shared link.'),
        },
        { type: 'checkbox', key: 'wifiHidden', showIf: isType('wifi'), label: L('Red oculta', 'Hidden network') },
        { type: 'text', key: 'contactName', showIf: isType('contact'), label: L('Nombre', 'Name'), maxLength: 80 },
        { type: 'text', key: 'contactPhone', showIf: isType('contact'), label: L('Teléfono', 'Phone'), inputmode: 'tel', maxLength: 40 },
        { type: 'text', key: 'contactEmail', showIf: isType('contact'), label: L('Correo', 'Email'), inputmode: 'email', maxLength: 80 },
        { type: 'text', key: 'contactOrg', showIf: isType('contact'), label: L('Empresa', 'Company'), maxLength: 80, advanced: true },
        {
          type: 'select',
          key: 'ecc',
          label: L('Corrección de errores', 'Error correction'),
          advanced: true,
          options: [['L', L('Baja (7 %)', 'Low (7%)')], ['M', L('Media (15 %)', 'Medium (15%)')], ['Q', L('Alta (25 %)', 'High (25%)')], ['H', L('Máxima (30 %)', 'Max (30%)')]],
          hint: L('Más corrección tolera más daño, pero el código se hace más denso (cuadraditos más chicos).', 'More correction tolerates more damage, but makes the code denser (smaller squares).'),
        },
      ],
    },
    {
      section: 'size',
      title: L('Tamaño y forma', 'Size and shape'),
      controls: [
        { type: 'number', key: 'sizeMm', label: L('Tamaño del código', 'Code size'), unit: 'mm', min: 15, max: 150, step: 1 },
        { type: 'number', key: 'marginMm', label: L('Borde alrededor', 'Margin around'), unit: 'mm', min: 1, max: 20, step: 0.5 },
        { type: 'number', key: 'baseThicknessMm', label: L('Grosor de la base', 'Base thickness'), unit: 'mm', min: 1.2, max: 10, step: 0.2 },
        { type: 'number', key: 'cornerRadiusMm', label: L('Esquinas redondeadas', 'Rounded corners'), unit: 'mm', min: 0, max: 30, step: 0.5, advanced: true },
      ],
    },
    {
      section: 'code',
      title: L('Código', 'Code'),
      controls: [
        { type: 'segmented', key: 'style', options: [['relief', L('En relieve', 'Raised')], ['flush', L('Al ras', 'Flush')]] },
        { type: 'number', key: 'reliefMm', label: L('Alto del relieve', 'Relief height'), unit: 'mm', min: 0.4, max: 3, step: 0.2, showIf: (p) => p.style === 'relief' },
        {
          type: 'number',
          key: 'reliefMm',
          label: L('Profundidad', 'Depth'),
          unit: 'mm',
          min: 0.4,
          max: 3,
          step: 0.2,
          showIf: (p) => p.style === 'flush',
          hint: L('Al ras deja la cara plana pero usa dos colores en las mismas capas: necesita AMS / MMU.', 'Flush keeps the face flat but uses two colors in the same layers: it needs AMS / MMU.'),
        },
      ],
    },
    {
      section: 'label',
      collapsed: true,
      title: L('Texto debajo', 'Text below'),
      controls: [
        { type: 'text', key: 'label', label: L('Texto', 'Text'), maxLength: 40, placeholder: L('Opcional: Wi-Fi, nombre…', 'Optional: Wi-Fi, name…') },
        { type: 'fontSelect', key: 'fontId', label: L('Fuente', 'Font'), inline: true, showIf: hasLabel },
        { type: 'number', key: 'labelSizeMm', label: L('Alto de mayúscula', 'Capital height'), unit: 'mm', min: 2, max: 20, step: 0.5, showIf: hasLabel },
      ],
    },
    {
      section: 'magnets',
      collapsed: true,
      title: L('Imanes (cara de atrás)', 'Magnets (back face)'),
      controls: [
        { type: 'segmented', key: 'magnets', options: [[0, L('Ninguno', 'None')], [1, '1'], [2, '2'], [4, '4']] },
        {
          type: 'number',
          key: 'magnetDiameterMm',
          label: L('Diámetro del imán', 'Magnet diameter'),
          unit: 'mm',
          min: 3,
          max: 30,
          step: 0.5,
          showIf: hasMagnets,
          hint: L('Los huecos se abren en la cara de atrás. Pegá los imanes con epoxi o cianoacrilato, todos con la misma polaridad hacia afuera.', 'The pockets open on the back face. Glue the magnets with epoxy or cyanoacrylate, all with the same polarity facing out.'),
        },
        { type: 'number', key: 'magnetThicknessMm', label: L('Grosor del imán', 'Magnet thickness'), unit: 'mm', min: 0.5, max: 10, step: 0.5, showIf: hasMagnets },
        {
          type: 'number',
          key: 'magnetClearanceMm',
          label: L('Holgura', 'Clearance'),
          unit: 'mm',
          min: 0,
          max: 1,
          step: 0.05,
          advanced: true,
          showIf: hasMagnets,
          tooltip: L('Se suma al diámetro y a la profundidad del hueco para que el imán entre sin forzar.', 'Added to the pocket diameter and depth so the magnet fits without forcing.'),
        },
      ],
    },
    {
      section: 'ring',
      collapsed: true,
      title: L('Argolla', 'Key ring'),
      controls: [
        { type: 'segmented', key: 'ring', options: [['none', L('Sin argolla', 'None')], ['top', L('Arriba', 'Top')], ['left', L('Izquierda', 'Left')]] },
        { type: 'number', key: 'ringOuterMm', label: L('Diámetro de la oreja', 'Tab diameter'), unit: 'mm', min: 6, max: 30, step: 0.5, showIf: hasRing },
        { type: 'number', key: 'ringHoleMm', label: L('Diámetro del agujero', 'Hole diameter'), unit: 'mm', min: 1.5, max: 20, step: 0.5, showIf: hasRing },
      ],
    },
    {
      section: 'colors',
      title: L('Colores', 'Colors'),
      controls: [
        { type: 'color', key: 'colors.base', label: L('Base', 'Base') },
        { type: 'color', key: 'colors.code', label: L('Código y texto', 'Code and text') },
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
