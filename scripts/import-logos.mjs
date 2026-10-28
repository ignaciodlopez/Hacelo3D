// Copia los logos OFICIALES de las marcas (SVG que conseguiste vos) a public/logos/<id>.svg.
// Uso:  node scripts/import-logos.mjs <carpeta> [--force]
// La carpeta tiene archivos <id>.svg con los ids de src/tools/organizer/brands.js (ingco.svg, dewalt.svg, ...).
// Solo se importan las marcas cuyo archivo existe y es usable; el resto queda como estaba.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRANDS } from '../src/tools/organizer/brands.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/logos');
const args = process.argv.slice(2);
const srcDir = args.find((a) => !a.startsWith('--'));
if (!srcDir) {
  console.error('Uso: node scripts/import-logos.mjs <carpeta con los SVG> [--force]');
  process.exit(1);
}

/** Problemas que hacen que un SVG no sirva para la herramienta (null si está bien). */
function problem(svg) {
  if (!/<svg[\s>]/i.test(svg)) return 'no es un SVG';
  if (/<image[\s>]/i.test(svg)) return 'es una imagen incrustada (PNG/JPG dentro del SVG); hace falta el vectorial';
  if (/<text[\s>]/i.test(svg)) return 'tiene texto sin convertir a curvas (convertilo a trazados en Inkscape/Illustrator)';
  if (!/<(path|polygon|polyline|rect|circle|ellipse)[\s>]/i.test(svg)) return 'no tiene formas dibujadas';
  return null;
}

mkdirSync(outDir, { recursive: true });
let imported = 0;
for (const b of BRANDS) {
  const from = resolve(srcDir, `${b.id}.svg`);
  if (!existsSync(from)) continue;
  const bad = problem(readFileSync(from, 'utf8'));
  if (bad) {
    console.warn(`${b.id}: se saltea, ${bad}`);
    continue;
  }
  const to = resolve(outDir, `${b.id}.svg`);
  if (existsSync(to) && !args.includes('--force')) {
    console.warn(`${b.id}: ya existe; usá --force para reemplazarlo`);
    continue;
  }
  if (from !== to) copyFileSync(from, to);
  imported++;
  console.log(`${b.id}: importado`);
}
console.log(`${imported} logo(s) importado(s). "npm run logos" conserva los SVG existentes.`);
