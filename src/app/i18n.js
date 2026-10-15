// i18n mínima: t('clave', {param}) y tr({es, en}) para textos declarados en las herramientas.

const dict = {
  es: {
    'app.name': 'Hacelo3D',
    'app.tools': 'Herramientas',
    'app.back': 'Herramientas',
    'app.home.title': 'Herramientas para impresión 3D',
    'app.home.subtitle': 'Todo corre en tu navegador: ajustá los parámetros, mirá el resultado en 3D y descargá el archivo listo para imprimir.',
    'app.soon': 'Próximamente',
    'app.home.available': 'Disponible ahora',
    'app.skip': 'Saltar al contenido',
    'app.credits': 'Créditos y licencias',
    'app.theme': 'Cambiar tema',
    'app.lang': 'Idioma',
    'app.printer': 'Impresora',
    'app.loading': 'Generando…',
    'app.empty': 'Escribí un texto',
    'app.reset': 'Restablecer',
    'app.preset': 'Preset',
    'app.preset.none': 'Personalizado',
    'app.advanced': 'Más opciones',
    'app.undo': 'Deshacer',
    'app.redo': 'Rehacer',
    'app.share': 'Copiar enlace',
    'app.shared': 'Enlace copiado',
    'viewer.center': 'Centrar vista',
    'viewer.top': 'Vista superior',
    'viewer.png': 'Captura PNG',
    'viewer.plate': 'Placa {n} de {total}',
    'viewer.platePrev': 'Placa anterior',
    'viewer.plateNext': 'Placa siguiente',
    'export.stl': 'STL (un color)',
    'export.zip': 'ZIP por color',
    'export.3mf': '3MF multicolor',
    'export.error': 'No se pudo generar el archivo',
    'info.size': 'Medida',
    'info.triangles': 'triángulos',
    'info.grams': 'aprox., pieza sólida',
    'info.colorChanges': 'Para imprimir sin AMS, cambiá de color',
    'info.changeAt': 'al empezar la capa {layer} (Z = {z} mm) → {color}',
    'info.needsMMU': 'Este diseño necesita impresión multimaterial (AMS / MMU).',
    'info.pieces': '{n} piezas',
    'color.base': 'Base',
    'color.text': 'Letras',
    'color.accent': 'Contorno',
    'color.border': 'Borde',
    'printer.title': 'Perfil de impresora',
    'printer.preset': 'Modelo',
    'printer.bedW': 'Cama X (mm)',
    'printer.bedH': 'Cama Y (mm)',
    'printer.nozzle': 'Boquilla (mm)',
    'printer.layer': 'Altura de capa (mm)',
    'printer.firstLayer': 'Primera capa (mm)',
    'printer.mmu': 'Tengo AMS / multimaterial',
    'printer.density': 'Densidad (g/cm³)',
    'printer.close': 'Cerrar',
    'msg.text.empty': 'Escribí un texto para generar el llavero.',
    'msg.text.missingGlyphs': 'La fuente no tiene estos caracteres y se omitieron: {chars}',
    'msg.text.thin': 'Hay trazos más finos que la boquilla; probá subir "Engrosar letras" o el tamaño.',
    'msg.shape.islands': 'El llavero quedó en varias piezas separadas; subí el margen o el suavizado, o ajustá el espaciado.',
    'msg.ring.thinWall': 'La argolla puede quedar frágil (pared fina).',
    'msg.ring.smallHole': 'El agujero es chico: puede que no entre la argolla de metal.',
    'msg.ring.noRoom': 'No hay lugar para el agujero dentro del cuerpo; subí el margen o usá oreja.',
    'msg.border.touchesText': 'El borde toca el texto; subí el margen.',
    'msg.engrave.thinFloor': 'El grabado era demasiado profundo; se limitó para dejar un piso de 0,8 mm.',
    'msg.size.tooSmall': 'El ancho total pedido es menor que el margen más la argolla.',
    'msg.size.bedOverflow': 'La pieza ({w} × {h} mm) no entra en la cama de la impresora.',
    'msg.color.needsMMU': 'Este diseño usa colores a la misma altura: necesita multimaterial (AMS / MMU).',
    'msg.build.error': 'Error al generar: {message}',
    'credits.title': 'Créditos y licencias',
    'credits.body': 'Las fuentes incluidas se distribuyen bajo la licencia SIL Open Font License 1.1. Las fuentes que subas son tu responsabilidad. Íconos: Phosphor Icons (MIT). Tipografía de la interfaz: Geist (SIL OFL 1.1). Software: three.js (MIT), manifold-3d (Apache-2.0), opentype.js (MIT), fflate (MIT).',
    'credits.fonts': 'Fuentes incluidas',
  },
  en: {
    'app.name': 'Hacelo3D',
    'app.tools': 'Tools',
    'app.back': 'Tools',
    'app.home.title': '3D printing tools',
    'app.home.subtitle': 'Everything runs in your browser: tweak the parameters, preview in 3D and download a print-ready file.',
    'app.soon': 'Coming soon',
    'app.home.available': 'Available now',
    'app.skip': 'Skip to content',
    'app.credits': 'Credits & licenses',
    'app.theme': 'Toggle theme',
    'app.lang': 'Language',
    'app.printer': 'Printer',
    'app.loading': 'Generating…',
    'app.empty': 'Type some text',
    'app.reset': 'Reset',
    'app.preset': 'Preset',
    'app.preset.none': 'Custom',
    'app.advanced': 'More options',
    'app.undo': 'Undo',
    'app.redo': 'Redo',
    'app.share': 'Copy link',
    'app.shared': 'Link copied',
    'viewer.center': 'Center view',
    'viewer.top': 'Top view',
    'viewer.png': 'PNG capture',
    'viewer.plate': 'Plate {n} of {total}',
    'viewer.platePrev': 'Previous plate',
    'viewer.plateNext': 'Next plate',
    'export.stl': 'STL (single color)',
    'export.zip': 'ZIP per color',
    'export.3mf': 'Multicolor 3MF',
    'export.error': 'Could not generate the file',
    'info.size': 'Size',
    'info.triangles': 'triangles',
    'info.grams': 'approx., solid part',
    'info.colorChanges': 'To print without an AMS, change color',
    'info.changeAt': 'at layer {layer} (Z = {z} mm) → {color}',
    'info.needsMMU': 'This design needs multi-material printing (AMS / MMU).',
    'info.pieces': '{n} pieces',
    'color.base': 'Base',
    'color.text': 'Letters',
    'color.accent': 'Outline',
    'color.border': 'Border',
    'printer.title': 'Printer profile',
    'printer.preset': 'Model',
    'printer.bedW': 'Bed X (mm)',
    'printer.bedH': 'Bed Y (mm)',
    'printer.nozzle': 'Nozzle (mm)',
    'printer.layer': 'Layer height (mm)',
    'printer.firstLayer': 'First layer (mm)',
    'printer.mmu': 'I have an AMS / multi-material',
    'printer.density': 'Density (g/cm³)',
    'printer.close': 'Close',
    'msg.text.empty': 'Type some text to generate the keychain.',
    'msg.text.missingGlyphs': 'The font lacks these characters and they were skipped: {chars}',
    'msg.text.thin': 'Some strokes are thinner than the nozzle; try "Thicken letters" or a larger size.',
    'msg.shape.islands': 'The keychain split into separate pieces; raise the margin or smoothing, or adjust spacing.',
    'msg.ring.thinWall': 'The ring may be fragile (thin wall).',
    'msg.ring.smallHole': 'The hole is small: a metal ring may not fit.',
    'msg.ring.noRoom': 'No room for the hole inside the body; raise the margin or use a tab.',
    'msg.border.touchesText': 'The border touches the text; raise the margin.',
    'msg.engrave.thinFloor': 'The engraving was too deep; it was limited to keep a 0.8 mm floor.',
    'msg.size.tooSmall': 'The requested overall width is smaller than margin plus ring.',
    'msg.size.bedOverflow': 'The part ({w} × {h} mm) does not fit on the printer bed.',
    'msg.color.needsMMU': 'This design uses colors at the same height: it needs multi-material (AMS / MMU).',
    'msg.build.error': 'Generation error: {message}',
    'credits.title': 'Credits & licenses',
    'credits.body': 'Bundled fonts are distributed under the SIL Open Font License 1.1. Fonts you upload are your responsibility. Icons: Phosphor Icons (MIT). Interface typeface: Geist (SIL OFL 1.1). Software: three.js (MIT), manifold-3d (Apache-2.0), opentype.js (MIT), fflate (MIT).',
    'credits.fonts': 'Bundled fonts',
  },
};

let lang = 'es';
const listeners = new Set();

export function detectLang() {
  try {
    const saved = localStorage.getItem('b3d.lang');
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    /* sin storage */
  }
  return (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function getLang() {
  return lang;
}

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'es';
  try {
    localStorage.setItem('b3d.lang', lang);
  } catch {
    /* sin storage */
  }
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key, params = {}) {
  const s = dict[lang][key] ?? dict.es[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
}

/** Texto declarado como { es, en } (o string plano). */
export function tr(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v[lang] ?? v.es ?? '';
}

setLang(detectLang());
