// Descarga íconos Phosphor (MIT, peso "fill") y genera public/icons/icons.json.
// Uso:  node scripts/fetch-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');
mkdirSync(outDir, { recursive: true });
const BASE = 'https://raw.githubusercontent.com/phosphor-icons/core/main/assets/fill';

// [id phosphor, es, en, tags]
const ICONS = [
  ['heart', 'Corazón', 'Heart', 'amor love corazon'],
  ['star', 'Estrella', 'Star', 'estrella star'],
  ['crown-simple', 'Corona', 'Crown', 'corona crown rey reina king queen'],
  ['paw-print', 'Huella', 'Paw print', 'pata huella perro gato mascota paw dog cat pet'],
  ['bone', 'Hueso', 'Bone', 'hueso perro bone dog'],
  ['flower', 'Flor', 'Flower', 'flor flower'],
  ['flower-lotus', 'Loto', 'Lotus', 'loto flor lotus yoga'],
  ['leaf', 'Hoja', 'Leaf', 'hoja planta leaf plant'],
  ['butterfly', 'Mariposa', 'Butterfly', 'mariposa butterfly'],
  ['lightning', 'Rayo', 'Lightning', 'rayo energia lightning bolt'],
  ['music-note', 'Nota musical', 'Music note', 'musica nota music'],
  ['soccer-ball', 'Pelota de fútbol', 'Soccer ball', 'futbol pelota soccer football ball'],
  ['basketball', 'Básquet', 'Basketball', 'basquet basket pelota basketball'],
  ['car', 'Auto', 'Car', 'auto coche carro car'],
  ['airplane', 'Avión', 'Airplane', 'avion viaje airplane travel'],
  ['house', 'Casa', 'House', 'casa hogar house home'],
  ['key', 'Llave', 'Key', 'llave key'],
  ['anchor', 'Ancla', 'Anchor', 'ancla mar anchor sea'],
  ['moon', 'Luna', 'Moon', 'luna noche moon night'],
  ['sun', 'Sol', 'Sun', 'sol dia sun day'],
  ['cloud', 'Nube', 'Cloud', 'nube cloud'],
  ['drop', 'Gota', 'Drop', 'gota agua drop water'],
  ['fire', 'Fuego', 'Fire', 'fuego llama fire flame'],
  ['skull', 'Calavera', 'Skull', 'calavera skull'],
  ['ghost', 'Fantasma', 'Ghost', 'fantasma halloween ghost'],
  ['tree-evergreen', 'Pino', 'Pine tree', 'pino arbol navidad tree christmas'],
  ['gift', 'Regalo', 'Gift', 'regalo gift'],
  ['coffee', 'Café', 'Coffee', 'cafe taza coffee cup'],
  ['game-controller', 'Joystick', 'Game controller', 'joystick juego gamer game'],
  ['camera', 'Cámara', 'Camera', 'camara foto camera photo'],
  ['book-open', 'Libro', 'Book', 'libro book'],
  ['graduation-cap', 'Birrete', 'Graduation cap', 'birrete egresado graduation'],
  ['cross', 'Cruz', 'Cross', 'cruz cross'],
  ['star-of-david', 'Estrella de David', 'Star of David', 'estrella david'],
  ['club', 'Trébol', 'Club', 'trebol club cartas'],
  ['rainbow', 'Arcoíris', 'Rainbow', 'arcoiris rainbow'],
  ['diamond', 'Diamante', 'Diamond', 'diamante diamond'],
  ['smiley', 'Carita feliz', 'Smiley', 'carita feliz sonrisa smile smiley'],
  ['thumbs-up', 'Pulgar arriba', 'Thumbs up', 'pulgar like thumbs'],
  ['bicycle', 'Bicicleta', 'Bicycle', 'bici bicicleta bike bicycle'],
  ['mountains', 'Montañas', 'Mountains', 'montana mountain'],
  ['cat', 'Gato', 'Cat', 'gato cat'],
  ['dog', 'Perro', 'Dog', 'perro dog'],
  ['fish', 'Pez', 'Fish', 'pez fish'],
  ['rocket', 'Cohete', 'Rocket', 'cohete rocket espacio space'],
  ['planet', 'Planeta', 'Planet', 'planeta planet'],
  ['cake', 'Torta', 'Cake', 'torta cumpleanos cake birthday'],
  ['pizza', 'Pizza', 'Pizza', 'pizza comida food'],
  ['headphones', 'Auriculares', 'Headphones', 'auriculares musica headphones'],
  ['guitar', 'Guitarra', 'Guitar', 'guitarra guitar'],
  ['dice-five', 'Dado', 'Dice', 'dado dice'],
  ['bell', 'Campana', 'Bell', 'campana bell'],
  ['flag', 'Bandera', 'Flag', 'bandera flag'],
  ['hand-heart', 'Mano con corazón', 'Hand with heart', 'mano corazon hand heart'],
];

const catalog = [];
for (const [id, es, en, tags] of ICONS) {
  let ok = false;
  for (let i = 0; i < 3 && !ok; i++) {
    try {
      const res = await fetch(`${BASE}/${id}-fill.svg`);
      if (res.status === 404) break;
      if (!res.ok) continue;
      const svg = await res.text();
      if (!svg.includes('<path')) break;
      writeFileSync(resolve(outDir, `${id}.svg`), svg);
      catalog.push({ id, name: { es, en }, tags, file: `${id}.svg` });
      ok = true;
    } catch {
      /* reintentar */
    }
  }
  console.log(ok ? `  ✓ ${id}` : `  ✗ ${id}`);
}
writeFileSync(resolve(outDir, 'icons.json'), JSON.stringify(catalog, null, 2) + '\n');
writeFileSync(
  resolve(outDir, 'LICENSE-PHOSPHOR.txt'),
  'Phosphor Icons — MIT License. https://github.com/phosphor-icons/core\nCopyright (c) 2020-present Phosphor Icons\n',
);
console.log(`\n${catalog.length} íconos.`);
