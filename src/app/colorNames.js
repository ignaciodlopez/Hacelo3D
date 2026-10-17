// Nombre aproximado de un color (#rrggbb) en español o inglés, para que el pedido diga "celeste" y no "#4fb3f0".

const PALETTE = [
  ['#ffffff', 'blanco', 'white'],
  ['#1c1c1e', 'negro', 'black'],
  ['#8a8a8a', 'gris', 'gray'],
  ['#d3d3d3', 'gris claro', 'light gray'],
  ['#e53935', 'rojo', 'red'],
  ['#fb8c00', 'naranja', 'orange'],
  ['#fdd835', 'amarillo', 'yellow'],
  ['#43a047', 'verde', 'green'],
  ['#a5d66b', 'verde claro', 'light green'],
  ['#4fb3f0', 'celeste', 'light blue'],
  ['#1e5fd8', 'azul', 'blue'],
  ['#1a237e', 'azul oscuro', 'navy'],
  ['#8e24aa', 'violeta', 'purple'],
  ['#ec407a', 'rosa', 'pink'],
  ['#f8bbd0', 'rosa claro', 'light pink'],
  ['#795548', 'marrón', 'brown'],
  ['#e8d8b8', 'beige', 'beige'],
  ['#26a69a', 'turquesa', 'teal'],
  ['#d4af37', 'dorado', 'gold'],
  ['#b0b6bd', 'plateado', 'silver'],
];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Distancia de color "redmean" (más cercana a lo que ve el ojo que la euclídea simple). */
function dist(a, b) {
  const rm = (a[0] + b[0]) / 2;
  const [dr, dg, db] = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

/**
 * @param {string|null|undefined} hex  "#rrggbb"
 * @param {'es'|'en'} [lang]
 */
export function colorName(hex, lang = 'es') {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return '';
  const c = rgb(hex.toLowerCase());
  let best = PALETTE[0];
  let bestD = Infinity;
  for (const entry of PALETTE) {
    const d = dist(c, rgb(entry[0]));
    if (d < bestD) {
      bestD = d;
      best = entry;
    }
  }
  return lang === 'en' ? best[2] : best[1];
}
