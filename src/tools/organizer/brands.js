// Marcas de herramientas para el logo de los organizadores.
//
// public/logos/ contiene las siluetas de los logos reales. Fuentes y adaptaciones: public/logos/SOURCES.md.
// Nueve provienen de vectores; Emtop se vectorizó del logo de su manual. Se usan en una sola tinta.
// npm run logos:import -- <carpeta> --force permite reemplazarlos; npm run logos conserva los archivos existentes.
// Ojo: son marcas registradas; venderlas impresas en una pieza puede requerir permiso del titular.
//
// `colors`: los de la marca, que se aplican al elegirla (base = el cuerpo, logo = el logo, latch = las trabas del estuche). Se pueden cambiar.
// `style`: cómo se dibuja la palabra (lo usa solo el script): fuente de public/fonts, inclinación y espaciado (en em).

export const BRANDS = [
  { id: 'dewalt', name: 'DeWalt', colors: { base: '#febd17', logo: '#1a1a1a', latch: '#1a1a1a' }, style: { text: 'DEWALT', font: 'ArchivoBlack-Regular.ttf', skewDeg: 0, spacing: 0.01 } },
  { id: 'milwaukee', name: 'Milwaukee', colors: { base: '#c8102e', logo: '#ffffff', latch: '#1a1a1a' }, style: { text: 'MILWAUKEE', font: 'ArchivoBlack-Regular.ttf', skewDeg: 14, spacing: 0 } },
  { id: 'makita', name: 'Makita', colors: { base: '#00909e', logo: '#ffffff', latch: '#f2f2f2' }, style: { text: 'makita', font: 'Poppins-Black.ttf', skewDeg: 8, spacing: -0.02 } },
  { id: 'bosch', name: 'Bosch', colors: { base: '#1a1a1a', logo: '#e20015', latch: '#1a1a1a' }, style: { text: 'BOSCH', font: 'ArchivoBlack-Regular.ttf', skewDeg: 0, spacing: 0.04 } },
  { id: 'stanley', name: 'Stanley', colors: { base: '#ffcc00', logo: '#1a1a1a', latch: '#1a1a1a' }, style: { text: 'STANLEY', font: 'ArchivoBlack-Regular.ttf', skewDeg: 0, spacing: 0.02 } },
  { id: 'black-decker', name: 'Black+Decker', colors: { base: '#f47a20', logo: '#1a1a1a', latch: '#1a1a1a' }, style: { text: 'BLACK+DECKER', font: 'ArchivoBlack-Regular.ttf', skewDeg: 0, spacing: 0 } },
  { id: 'total', name: 'Total', colors: { base: '#1a1a1a', logo: '#00a650', latch: '#1a1a1a' }, style: { text: 'TOTAL', font: 'RussoOne-Regular.ttf', skewDeg: 10, spacing: 0.03 } },
  { id: 'ingco', name: 'Ingco', colors: { base: '#ffd200', logo: '#1a1a1a', latch: '#1a1a1a' }, style: { text: 'INGCO', font: 'RussoOne-Regular.ttf', skewDeg: 10, spacing: 0.02 } },
  { id: 'emtop', name: 'Emtop', colors: { base: '#1a1a1a', logo: '#e30613', latch: '#1a1a1a' }, style: { text: 'EMTOP', font: 'RussoOne-Regular.ttf', skewDeg: 10, spacing: 0.02 } },
  { id: 'lusqtoff', name: 'Lusqtoff', colors: { base: '#1a1a1a', logo: '#f39200', latch: '#1a1a1a' }, style: { text: 'LUSQTOFF', font: 'ArchivoBlack-Regular.ttf', skewDeg: 8, spacing: 0 } },
];

export const brandById = (id) => BRANDS.find((b) => b.id === id) ?? null;
