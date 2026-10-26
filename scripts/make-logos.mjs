// Genera public/logos/<id>.svg y public/logos/logos.json a partir de src/tools/organizer/brands.js.
// Cada logo es la palabra de la marca con una fuente parecida (recreación aproximada, no el archivo oficial).
// Para usar el logo oficial de una marca, reemplazá su SVG en public/logos/ y NO vuelvas a correr este script
// (o sacá esa marca de la lista de abajo con --skip id1,id2).
// Uso:  node scripts/make-logos.mjs [--skip dewalt,makita]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { BRANDS } from '../src/tools/organizer/brands.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/logos');
mkdirSync(outDir, { recursive: true });
const skipArg = process.argv.indexOf('--skip');
const skip = skipArg > 0 ? process.argv[skipArg + 1].split(',') : [];

const SIZE = 100; // alto de la fuente (unidades del SVG)
const r = (n) => Math.round(n * 100) / 100;

for (const b of BRANDS) {
  if (skip.includes(b.id)) continue;
  const buf = readFileSync(resolve(root, 'public/fonts', b.style.font));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const scale = SIZE / font.unitsPerEm;
  // letra por letra, con el espaciado de la marca (opentype ya aplica el kerning dentro de getPath)
  const commands = [];
  let x = 0;
  const glyphs = font.stringToGlyphs(b.style.text);
  glyphs.forEach((g, i) => {
    commands.push(...g.getPath(x, 0, SIZE).commands);
    x += g.advanceWidth * scale + b.style.spacing * SIZE;
    if (i < glyphs.length - 1) x += font.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  // inclinación: corre cada punto hacia la derecha según su alto sobre la línea base (en el SVG la Y va hacia abajo)
  const k = Math.tan((b.style.skewDeg * Math.PI) / 180);
  const tx = (px, py) => r(px - k * py);
  let d = '';
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const see = (px, py) => {
    minX = Math.min(minX, tx(px, py));
    maxX = Math.max(maxX, tx(px, py));
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  };
  for (const c of commands) {
    if (c.type === 'M' || c.type === 'L') {
      see(c.x, c.y);
      d += `${c.type}${tx(c.x, c.y)} ${r(c.y)}`;
    } else if (c.type === 'Q') {
      see(c.x, c.y);
      d += `Q${tx(c.x1, c.y1)} ${r(c.y1)} ${tx(c.x, c.y)} ${r(c.y)}`;
    } else if (c.type === 'C') {
      see(c.x, c.y);
      d += `C${tx(c.x1, c.y1)} ${r(c.y1)} ${tx(c.x2, c.y2)} ${r(c.y2)} ${tx(c.x, c.y)} ${r(c.y)}`;
    } else if (c.type === 'Z') d += 'Z';
  }
  const pad = 2;
  const vb = [r(minX - pad), r(minY - pad), r(maxX - minX + 2 * pad), r(maxY - minY + 2 * pad)];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}"><!-- ${b.name}: recreación aproximada (ver src/tools/organizer/brands.js) --><path fill="#000" d="${d}"/></svg>\n`;
  writeFileSync(resolve(outDir, `${b.id}.svg`), svg);
  console.log(`${b.id}.svg  ${vb[2]} × ${vb[3]}`);
}

const catalog = BRANDS.map((b) => ({ id: b.id, name: { es: b.name, en: b.name }, tags: `${b.name.toLowerCase()} ${b.id}`, file: `${b.id}.svg` }));
writeFileSync(resolve(outDir, 'logos.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`logos.json (${catalog.length})`);
