import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, createScope, fontStore } from './helpers.js';
import { textToCrossSection, fontCapHeight } from '../../src/core/kernel/text.js';

let K;
beforeAll(async () => {
  K = await initKernel();
});

async function run(fontId, opts, fn) {
  const font = await fontStore.get(fontId);
  const sc = createScope();
  try {
    return fn(textToCrossSection(K, sc.track, font, opts), font, sc.track);
  } finally {
    sc.dispose();
  }
}

describe('texto → CrossSection', () => {
  it('"Sofía" en Pacifico: área > 0 y ancho = 50 mm', async () => {
    await run('pacifico', { lines: ['Sofía'], sizeMode: 'textWidth', sizeMm: 50 }, (r) => {
      expect(r.cs.area()).toBeGreaterThan(10);
      const b = r.cs.bounds();
      expect(b.max[0] - b.min[0]).toBeCloseTo(50, 1);
      expect(r.cs.decompose().length).toBeGreaterThanOrEqual(1);
    });
  });

  it('capHeight = 10 mm → la H mide 10 mm', async () => {
    await run('archivo-black', { lines: ['H'], sizeMode: 'capHeight', sizeMm: 10 }, (r) => {
      const b = r.cs.bounds();
      expect(b.max[1] - b.min[1]).toBeCloseTo(10, 1);
    });
  });

  it('textHeight', async () => {
    await run('bebas-neue', { lines: ['MATEO'], sizeMode: 'textHeight', sizeMm: 12 }, (r) => {
      const b = r.cs.bounds();
      expect(b.max[1] - b.min[1]).toBeCloseTo(12, 1);
    });
  });

  it('acentos y ñ funcionan sin glifos faltantes', async () => {
    for (const txt of ['ñandú', '¿Qué?', 'ÁÉÍÓÚ']) {
      await run('pacifico', { lines: [txt], sizeMode: 'textWidth', sizeMm: 40 }, (r) => {
        expect(r.missing).toEqual([]);
        expect(r.cs.area()).toBeGreaterThan(5);
      });
    }
  });

  it('un carácter inexistente se informa como faltante', async () => {
    await run('bebas-neue', { lines: ['Hola ☺'], sizeMm: 30 }, (r) => {
      expect(r.missing).toEqual(['☺']);
      expect(r.cs.area()).toBeGreaterThan(1);
    });
  });

  it('letterSpacing negativo con el mismo ancho objetivo mantiene 50 mm', async () => {
    await run('pacifico', { lines: ['Sofía'], sizeMm: 50, letterSpacingMm: -1 }, (r) => {
      const b = r.cs.bounds();
      expect(b.max[0] - b.min[0]).toBeCloseTo(50, 1);
    });
  });

  it('multilínea: dos líneas ocupan más alto que una', async () => {
    const one = await run('pacifico', { lines: ['Ana'], sizeMm: 30 }, (r) => r.bbox.maxY - r.bbox.minY);
    const two = await run('pacifico', { lines: ['Ana', 'Luz'], sizeMm: 30 }, (r) => r.bbox.maxY - r.bbox.minY);
    expect(two).toBeGreaterThan(one * 1.5);
  });

  it('texto vacío devuelve cs null', async () => {
    await run('pacifico', { lines: ['   '] }, (r) => expect(r.cs).toBeNull());
  });

  it('fontCapHeight es positivo', async () => {
    expect(fontCapHeight(await fontStore.get('pacifico'))).toBeGreaterThan(0);
  });
});
