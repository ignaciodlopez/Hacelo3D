import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// La única protección real contra saltear el "modo taller" es que el sitio público NO TENGA ese código.
// Esta prueba compila las dos versiones y busca marcas del código de exportación y del PIN en lo que se publicaría.
const ROOT = resolve(import.meta.dirname, '../..');
const VITE = join(ROOT, 'node_modules/vite/bin/vite.js');
const dirs = [];

function build(mode) {
  const out = mkdtempSync(join(tmpdir(), `b3d-${mode ?? 'full'}-`));
  dirs.push(out);
  execFileSync(process.execPath, [VITE, 'build', ...(mode ? ['--mode', mode] : []), '--outDir', out, '--emptyOutDir'], { cwd: ROOT, stdio: 'pipe', timeout: 240000 });
  return out;
}

/** Todo el JavaScript publicado, concatenado. */
function bundle(dir) {
  const files = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|mjs)$/.test(name)) files.push(p);
    }
  };
  walk(dir);
  return files.map((f) => readFileSync(f, 'utf8')).join('\n');
}

afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

// cada marca es un texto que solo existe dentro de ese código
const WORKSHOP_ONLY = {
  'exportador 3MF': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  'tipo de archivo 3MF': 'model/3mf',
  'tipo de archivo STL': 'model/stl',
  'PIN (token)': 'b3d-token:',
  'PIN (verificador)': 'b3d-check:',
  'PIN (almacenamiento)': 'b3d.workshop.token',
  'interruptor del modo taller': 'b3d.workshop',
};

describe('compilación pública vs. completa', () => {
  let full;
  let pub;
  it('compila las dos', () => {
    full = bundle(build());
    pub = bundle(build('public'));
    expect(full.length).toBeGreaterThan(100000);
    expect(pub.length).toBeGreaterThan(100000);
  });

  it('la completa tiene el código del taller (si no, esta prueba no prueba nada)', () => {
    for (const [what, marker] of Object.entries(WORKSHOP_ONLY)) expect(full.includes(marker), what).toBe(true);
  });

  it('la pública NO contiene el código de exportación ni del PIN', () => {
    for (const [what, marker] of Object.entries(WORKSHOP_ONLY)) expect(pub.includes(marker), `la pública contiene: ${what}`).toBe(false);
  });

  it('la pública conserva lo que los clientes necesitan', () => {
    expect(pub).toContain('wa.me'); // pedir por WhatsApp
    expect(pub).toContain('config.json'); // número de la tienda
    expect(pub.length).toBeLessThan(full.length);
  });
});
