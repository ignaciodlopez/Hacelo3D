import { describe, it, expect, beforeAll } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/keychain/build.js';
import { defaults } from '../../src/tools/keychain/params.js';
import { encodeStl } from '../../src/core/export/stl.js';
import { exportStl, exportZipPerColor, export3mf } from '../../src/core/export/exports.js';
import { safeName } from '../../src/core/export/filename.js';

let result;
beforeAll(async () => {
  const K = await initKernel();
  result = await build(K, { ...defaults }, { getFont: (id) => fontStore.get(id), printer: {} });
});

describe('exportadores', () => {
  it('STL binario: bytes = 84 + 50·n, header sin "solid", normales unitarias', () => {
    const m = result.items[0].merged;
    const bytes = encodeStl(m);
    const n = m.indices.length / 3;
    expect(bytes.length).toBe(84 + 50 * n);
    const dv = new DataView(bytes.buffer);
    expect(dv.getUint32(80, true)).toBe(n);
    expect(String.fromCharCode(...bytes.slice(0, 5)).toLowerCase()).not.toBe('solid');
    for (const f of [0, Math.floor(n / 2), n - 1]) {
      const o = 84 + f * 50;
      const len = Math.hypot(dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true));
      expect(len).toBeCloseTo(1, 4);
    }
  });

  it('exportStl devuelve un .stl con nombre seguro', () => {
    expect(exportStl(result).filename).toBe('llavero-valentina.stl');
  });

  it('ZIP por color contiene un STL por parte', () => {
    const files = Object.keys(unzipSync(exportZipPerColor(result).data)).sort();
    expect(files).toEqual(['llavero-valentina_base.stl', 'llavero-valentina_letras.stl']);
  });

  it('3MF: 3 archivos, un objeto por parte + contenedor, colores', () => {
    const z = unzipSync(export3mf(result).data);
    expect(Object.keys(z)).toEqual(['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']);
    const xml = strFromU8(z['3D/3dmodel.model']);
    expect((xml.match(/<object /g) ?? []).length).toBe(3);
    expect(xml).toContain('displaycolor="#3A3A3AFF"');
    expect(xml).toContain('displaycolor="#F2E08AFF"');
    expect(xml).toContain('<components>');
    expect(xml).toContain('unit="millimeter"');
  });

  it('safeName quita acentos y símbolos', () => {
    expect(safeName('Sofía López!')).toBe('sofia-lopez');
    expect(safeName('😀')).toBe('llavero');
  });
});
