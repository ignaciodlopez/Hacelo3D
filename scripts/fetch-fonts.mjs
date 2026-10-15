// Descarga fuentes OFL (TTF estático) del repo google/fonts, valida que tengan los
// caracteres del español y genera public/fonts/fonts.json + LICENSES/.
//
// Uso:  node scripts/fetch-fonts.mjs
// Solo se descargan archivos nuevos; las fuentes que fallen la validación se descartan.

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
const { parse } = opentype;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/fonts');
const licDir = resolve(outDir, 'LICENSES');
mkdirSync(licDir, { recursive: true });
const BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl';

// [id, nombre, carpeta, archivo, categoría, fina, engrosar recomendado]
const MANIFEST = [
  // cursivas que conectan
  ['pacifico', 'Pacifico', 'pacifico', 'Pacifico-Regular.ttf', 'script-connected', false, 0],
  ['lobster', 'Lobster', 'lobster', 'Lobster-Regular.ttf', 'script-connected', false, 0],
  ['kaushan-script', 'Kaushan Script', 'kaushanscript', 'KaushanScript-Regular.ttf', 'script-connected', false, 0],
  ['satisfy', 'Satisfy', 'satisfy', 'Satisfy-Regular.ttf', 'script-connected', false, 0.1],
  ['yellowtail', 'Yellowtail', 'yellowtail', 'Yellowtail-Regular.ttf', 'script-connected', false, 0.1],
  ['cookie', 'Cookie', 'cookie', 'Cookie-Regular.ttf', 'script-connected', false, 0.1],
  ['damion', 'Damion', 'damion', 'Damion-Regular.ttf', 'script-connected', false, 0.1],
  ['leckerli-one', 'Leckerli One', 'leckerlione', 'LeckerliOne-Regular.ttf', 'script-connected', false, 0],
  ['grand-hotel', 'Grand Hotel', 'grandhotel', 'GrandHotel-Regular.ttf', 'script-connected', false, 0.1],
  ['norican', 'Norican', 'norican', 'Norican-Regular.ttf', 'script-connected', false, 0.1],
  ['courgette', 'Courgette', 'courgette', 'Courgette-Regular.ttf', 'script-connected', false, 0],
  ['playball', 'Playball', 'playball', 'Playball-Regular.ttf', 'script-connected', false, 0.1],
  ['lobster-two', 'Lobster Two', 'lobstertwo', 'LobsterTwo-Bold.ttf', 'script-connected', false, 0],
  ['oleo-script', 'Oleo Script', 'oleoscript', 'OleoScript-Bold.ttf', 'script-connected', false, 0],
  ['rancho', 'Rancho', 'rancho', 'Rancho-Regular.ttf', 'script-connected', false, 0.1],
  // cursivas finas / elegantes
  ['great-vibes', 'Great Vibes', 'greatvibes', 'GreatVibes-Regular.ttf', 'script-thin', true, 0.4],
  ['allura', 'Allura', 'allura', 'Allura-Regular.ttf', 'script-thin', true, 0.4],
  ['alex-brush', 'Alex Brush', 'alexbrush', 'AlexBrush-Regular.ttf', 'script-thin', true, 0.4],
  ['parisienne', 'Parisienne', 'parisienne', 'Parisienne-Regular.ttf', 'script-thin', true, 0.3],
  ['sacramento', 'Sacramento', 'sacramento', 'Sacramento-Regular.ttf', 'script-thin', true, 0.5],
  ['pinyon-script', 'Pinyon Script', 'pinyonscript', 'PinyonScript-Regular.ttf', 'script-thin', true, 0.4],
  ['tangerine', 'Tangerine', 'tangerine', 'Tangerine-Bold.ttf', 'script-thin', true, 0.5],
  // a mano / casual
  ['permanent-marker', 'Permanent Marker', 'permanentmarker', 'PermanentMarker-Regular.ttf', 'handwritten', false, 0],
  ['caveat-brush', 'Caveat Brush', 'caveatbrush', 'CaveatBrush-Regular.ttf', 'handwritten', false, 0],
  ['gochi-hand', 'Gochi Hand', 'gochihand', 'GochiHand-Regular.ttf', 'handwritten', false, 0],
  ['patrick-hand', 'Patrick Hand', 'patrickhand', 'PatrickHand-Regular.ttf', 'handwritten', true, 0.3],
  ['kalam', 'Kalam', 'kalam', 'Kalam-Bold.ttf', 'handwritten', false, 0.1],
  ['indie-flower', 'Indie Flower', 'indieflower', 'IndieFlower-Regular.ttf', 'handwritten', true, 0.3],
  ['amatic-sc', 'Amatic SC', 'amaticsc', 'AmaticSC-Bold.ttf', 'handwritten', true, 0.3],
  // display / gruesas
  ['bebas-neue', 'Bebas Neue', 'bebasneue', 'BebasNeue-Regular.ttf', 'display', false, 0],
  ['anton', 'Anton', 'anton', 'Anton-Regular.ttf', 'display', false, 0],
  ['lilita-one', 'Lilita One', 'lilitaone', 'LilitaOne-Regular.ttf', 'display', false, 0],
  ['titan-one', 'Titan One', 'titanone', 'TitanOne-Regular.ttf', 'display', false, 0],
  ['bangers', 'Bangers', 'bangers', 'Bangers-Regular.ttf', 'display', false, 0],
  ['bowlby-one', 'Bowlby One', 'bowlbyone', 'BowlbyOne-Regular.ttf', 'display', false, 0],
  ['righteous', 'Righteous', 'righteous', 'Righteous-Regular.ttf', 'display', false, 0],
  ['carter-one', 'Carter One', 'carterone', 'CarterOne-Regular.ttf', 'display', false, 0],
  ['chewy', 'Chewy', 'chewy', 'Chewy-Regular.ttf', 'display', false, 0],
  ['shrikhand', 'Shrikhand', 'shrikhand', 'Shrikhand-Regular.ttf', 'display', false, 0],
  ['bungee', 'Bungee', 'bungee', 'Bungee-Regular.ttf', 'display', false, 0],
  ['russo-one', 'Russo One', 'russoone', 'RussoOne-Regular.ttf', 'display', false, 0],
  ['black-ops-one', 'Black Ops One', 'blackopsone', 'BlackOpsOne-Regular.ttf', 'display', false, 0],
  ['fredoka-one', 'Fredoka One', 'fredokaone', 'FredokaOne-Regular.ttf', 'display', false, 0],
  ['passion-one', 'Passion One', 'passionone', 'PassionOne-Bold.ttf', 'display', false, 0],
  // serif / slab
  ['alfa-slab-one', 'Alfa Slab One', 'alfaslabone', 'AlfaSlabOne-Regular.ttf', 'serif', false, 0],
  ['abril-fatface', 'Abril Fatface', 'abrilfatface', 'AbrilFatface-Regular.ttf', 'serif', false, 0],
  ['ultra', 'Ultra', 'ultra', 'Ultra-Regular.ttf', 'serif', false, 0],
  ['bevan', 'Bevan', 'bevan', 'Bevan-Regular.ttf', 'serif', false, 0],
  ['rozha-one', 'Rozha One', 'rozhaone', 'RozhaOne-Regular.ttf', 'serif', false, 0],
  ['arvo', 'Arvo Bold', 'arvo', 'Arvo-Bold.ttf', 'serif', false, 0],
  // sans
  ['archivo-black', 'Archivo Black', 'archivoblack', 'ArchivoBlack-Regular.ttf', 'sans', false, 0],
  ['poppins-black', 'Poppins Black', 'poppins', 'Poppins-Black.ttf', 'sans', false, 0],
  ['poppins-bold', 'Poppins Bold', 'poppins', 'Poppins-Bold.ttf', 'sans', false, 0],
  ['lato-black', 'Lato Black', 'lato', 'Lato-Black.ttf', 'sans', false, 0],
  ['ubuntu-bold', 'Ubuntu Bold', 'ubuntu', 'Ubuntu-Bold.ttf', 'sans', false, 0],
  // temáticas
  ['pirata-one', 'Pirata One', 'pirataone', 'PirataOne-Regular.ttf', 'themed', false, 0],
  ['unifraktur', 'UnifrakturMaguntia', 'unifrakturmaguntia', 'UnifrakturMaguntia-Book.ttf', 'themed', false, 0],
  ['press-start-2p', 'Press Start 2P', 'pressstart2p', 'PressStart2P-Regular.ttf', 'themed', false, 0],
  ['creepster', 'Creepster', 'creepster', 'Creepster-Regular.ttf', 'themed', false, 0],
  ['mountains-of-christmas', 'Mountains of Christmas', 'mountainsofchristmas', 'MountainsofChristmas-Bold.ttf', 'themed', false, 0],
  ['stardos-stencil', 'Stardos Stencil', 'stardosstencil', 'StardosStencil-Bold.ttf', 'themed', false, 0],
  ['metal-mania', 'Metal Mania', 'metalmania', 'MetalMania-Regular.ttf', 'themed', false, 0],
  ['special-elite', 'Special Elite', 'specialelite', 'SpecialElite-Regular.ttf', 'themed', false, 0],
  ['fontdiner-swanky', 'Fontdiner Swanky', 'fontdinerswanky', 'FontdinerSwanky-Regular.ttf', 'themed', false, 0],
  ['bungee-shade', 'Bungee Shade', 'bungeeshade', 'BungeeShade-Regular.ttf', 'themed', false, 0],
];

// Respaldo para caracteres que la fuente elegida no tiene (no se lista en el selector).
const FALLBACKS = [
  ['noto-sans-bold', 'Noto Sans Bold', 'notosans', 'static/NotoSans-Bold.ttf', 'sans'],
  ['lato-bold', 'Lato Bold', 'lato', 'Lato-Bold.ttf', 'sans'],
];

const REQUIRED = 'áéíóúüñÁÉÍÓÚÜÑ¿¡ABCabc012';

async function download(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {
      /* reintentar */
    }
  }
  return null;
}

function checkFont(buf) {
  try {
    const font = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const missing = [...REQUIRED].filter((ch) => font.charToGlyphIndex(ch) === 0);
    return { font, missing };
  } catch (e) {
    return { font: null, missing: [], error: String(e.message ?? e) };
  }
}

const catalog = [];
const licensesDone = new Set();

async function ensure(id, name, dir, file, category, extra = {}) {
  const base = file.split('/').pop();
  const dest = resolve(outDir, base);
  let buf = existsSync(dest) ? readFileSync(dest) : await download(`${BASE}/${dir}/${file}`);
  if (!buf) {
    console.log(`  ✗ ${name}: no encontrada (${dir}/${file})`);
    return null;
  }
  const { font, missing, error } = checkFont(buf);
  if (!font) {
    console.log(`  ✗ ${name}: no se pudo leer (${error})`);
    return null;
  }
  if (missing.length) {
    console.log(`  ✗ ${name}: le faltan caracteres: ${missing.join('')}`);
    return null;
  }
  writeFileSync(dest, buf);
  if (!licensesDone.has(dir)) {
    licensesDone.add(dir);
    const lic = await download(`${BASE}/${dir}/OFL.txt`);
    if (lic) writeFileSync(resolve(licDir, `OFL-${dir}.txt`), lic);
  }
  console.log(`  ✓ ${name}`);
  return { id, name, file: base, category, license: 'OFL-1.1', ...extra };
}

console.log('Fuentes del catálogo:');
for (const [id, name, dir, file, category, thin, bold] of MANIFEST) {
  const entry = await ensure(id, name, dir, file, category, { thin, recommendedBold: bold });
  if (entry) catalog.push(entry);
}
console.log('Respaldo:');
for (const [id, name, dir, file, category] of FALLBACKS) {
  const entry = await ensure(id, name, dir, file, category, { thin: false, recommendedBold: 0, hidden: true, fallback: true });
  if (entry) catalog.push(entry);
}

writeFileSync(resolve(outDir, 'fonts.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`\n${catalog.filter((f) => !f.hidden).length} fuentes en el catálogo (+${catalog.filter((f) => f.hidden).length} de respaldo).`);
