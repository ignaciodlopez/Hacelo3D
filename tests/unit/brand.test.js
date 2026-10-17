import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodeStl } from '../../src/core/export/stl.js';
import { encode3mf } from '../../src/core/export/threemf.js';
import { tools } from '../../src/tools/registry.js';
import { t } from '../../src/app/i18n.js';

const root = resolve(import.meta.dirname, '../..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

describe('marca Bitcoin3D', () => {
  it('el nombre de la marca es Bitcoin3D', () => {
    expect(t('app.name')).toBe('Bitcoin3D');
    expect(t('home.foot')).toContain('www.Bitcoin3D.com.ar');
    expect(t('credits.own', { year: 2026 })).toContain('Bitcoin3D');
  });

  it('la página tiene título, descripción y datos para compartir el enlace, con la dirección real', () => {
    expect(html).toMatch(/<title>Bitcoin3D — /);
    expect(html).toContain('<link rel="canonical" href="https://bitcoin3d.com.ar/" />');
    expect(html).toContain('property="og:site_name" content="Bitcoin3D"');
    expect(html).toContain('property="og:locale" content="es_AR"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    // las redes piden una URL absoluta para la imagen
    expect(html).toContain('property="og:image" content="https://bitcoin3d.com.ar/og.png"');
    expect(html).not.toMatch(/hacelo3d/i);
  });

  it('la imagen para compartir existe, mide 1200 × 630 y pesa menos de 300 KB (lo que aceptan WhatsApp y las redes)', () => {
    const file = resolve(root, 'public/og.png');
    const png = readFileSync(file);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(statSync(file).size).toBeLessThan(300 * 1024);
  });

  it('los archivos que se exportan llevan la marca nueva', () => {
    const stl = new TextDecoder().decode(encodeStl({ positions: new Float32Array(9), indices: new Uint32Array([0, 1, 2]) }).subarray(0, 40));
    expect(stl).toContain('Bitcoin3D');
    const xml = new TextDecoder().decode(encode3mf([{ name: 'x', parts: [{ label: 'a', color: '#ffffff', positions: new Float32Array(9), indices: new Uint32Array([0, 1, 2]) }] }]));
    expect(xml).toBeTruthy();
  });

  it('cada herramienta activa tiene un nombre corto para el menú del celular, en los dos idiomas', () => {
    for (const tool of tools.filter((x) => x.status === 'active')) {
      for (const lang of ['es', 'en']) {
        const short = tool.short?.[lang];
        expect(typeof short, `${tool.id} ${lang}`).toBe('string');
        expect(short.length, `${tool.id} ${lang}`).toBeGreaterThan(0);
        expect(short.length, `${tool.id} ${lang}: cabe bajo el ícono`).toBeLessThanOrEqual(10);
      }
    }
  });
});
