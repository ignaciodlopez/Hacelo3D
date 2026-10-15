import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore, catalog } from './helpers.js';
import { build } from '../../src/tools/keychain/build.js';
import { defaults } from '../../src/tools/keychain/params.js';
import { textToCrossSection } from '../../src/core/kernel/text.js';
import { createScope } from '../../src/core/kernel/manifold.js';

let K;
const ctx = () => ({ getFont: (id) => fontStore.get(id), printer: {} });
beforeAll(async () => {
  K = await initKernel();
});

const visible = catalog.filter((f) => !f.hidden);

describe('catálogo de fuentes', () => {
  it('tiene al menos 45 fuentes visibles, una de respaldo y archivos únicos', () => {
    expect(visible.length).toBeGreaterThanOrEqual(45);
    expect(catalog.some((f) => f.fallback)).toBe(true);
    expect(new Set(catalog.map((f) => f.id)).size).toBe(catalog.length);
  });

  it('cada fuente genera una pieza manifold de una sola isla (follow, margen 3) con Sofía / MATEO / ñandú', async () => {
    const failures = [];
    for (const f of visible) {
      for (const text of ['Sofía', 'MATEO', 'ñandú']) {
        const r = await build(K, { ...defaults, fontId: f.id, text, boldOffsetMm: f.recommendedBold ?? 0 }, ctx());
        const errs = r.messages.filter((m) => m.level === 'error').map((m) => m.code);
        const ok = r.items.length === 1 && r.items[0].merged.status === 'NoError' && errs.length === 0 && r.items[0].merged.volumeMm3 > 0;
        if (!ok) failures.push(`${f.id}/${text}: ${errs.join(',') || 'geometría inválida'}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('fuente de respaldo', () => {
  it('los caracteres que la fuente no tiene se toman de la de respaldo en vez de omitirse', async () => {
    const main = await fontStore.get('cookie');
    const fb = await fontStore.get('lato-bold');
    const candidate = 'č'; // Cookie no lo tiene; Lato Bold sí
    expect(main.charToGlyphIndex(candidate)).toBe(0);
    expect(fb.charToGlyphIndex(candidate)).not.toBe(0);
    const sc = createScope();
    try {
      const without = textToCrossSection(K, sc.track, main, { lines: ['A' + candidate], sizeMm: 30 });
      const withFb = textToCrossSection(K, sc.track, main, { lines: ['A' + candidate], sizeMm: 30, fallbackFont: fb });
      expect(without.missing).toContain(candidate);
      expect(withFb.missing).toEqual([]);
      expect(withFb.cs.decompose().length).toBeGreaterThan(without.cs.decompose().length);
    } finally {
      sc.dispose();
    }
  });
});
