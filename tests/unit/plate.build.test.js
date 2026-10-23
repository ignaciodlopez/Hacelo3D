import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/plate/build.js';
import { defaults, normalizeParams } from '../../src/tools/plate/params.js';

let K;
const ctx = () => ({ getFont: (id) => fontStore.get(id), printer: {} });
beforeAll(async () => {
  K = await initKernel();
});

const run = (over = {}) => build(K, { ...defaults, ...over, colors: { ...defaults.colors, ...over.colors } }, ctx());

function check(r, over) {
  const label = JSON.stringify(over);
  expect(r.items.length, label).toBe(1);
  const it = r.items[0];
  expect(r.messages.filter((m) => m.level === 'error'), label).toEqual([]);
  expect(it.merged.status, label).toBe('NoError');
  for (const p of it.parts) {
    expect(p.status, label).toBe('NoError');
    expect(p.volumeMm3, label).toBeGreaterThan(0);
  }
  // las partes no se solapan: la suma de volúmenes = volumen de la unión
  const sum = it.parts.reduce((s, p) => s + p.volumeMm3, 0);
  expect(Math.abs(sum - it.merged.volumeMm3) / it.merged.volumeMm3, label).toBeLessThan(0.002);
  return it;
}

const charMm = (r) => r.messages.find((m) => m.code === 'plate.charSize')?.params.mm;

describe('llavero patente', () => {
  it('Mercosur por defecto: placa, caracteres, franja y bandera, con la proporción 400 × 130', async () => {
    const r = await run();
    const it = check(r, {});
    expect(it.parts.map((p) => p.colorKey)).toEqual(['base', 'text', 'band', 'flag']);
    expect(it.parts.find((p) => p.colorKey === 'base').color).toBe('#ffffff');
    // la orejita sale por la izquierda: el ancho es la placa más la orejita, el alto es el de la patente
    expect(it.sizeMm[0]).toBeGreaterThan(70);
    expect(it.sizeMm[1]).toBeCloseTo(70 / (400 / 130), 1);
    expect(charMm(r)).toBeGreaterThan(9);
    expect(r.messages.some((m) => m.code === 'plate.smallText')).toBe(false);
  });

  it('vieja (1994): placa blanca, recuadro negro con los caracteres calados y leyenda celeste', async () => {
    const r = await run({ style: 'old' });
    const it = check(r, { style: 'old' });
    expect(it.parts.map((p) => [p.colorKey, p.color])).toEqual([
      ['base', '#ffffff'],
      ['panel', '#111111'],
      ['legend', '#2b9fd3'],
    ]);
    expect(it.sizeMm[1]).toBeCloseTo(70 / (294 / 129), 1);
    expect(r.messages.some((m) => m.code === 'plate.smallText')).toBe(false);
    // las ranuras se graban en la placa: sin ellas hay más material
    const plain = check(await run({ style: 'old', showSlots: false }), { showSlots: false });
    const vol = (x) => x.parts.find((p) => p.colorKey === 'base').volumeMm3;
    expect(vol(plain)).toBeGreaterThan(vol(it));
  });

  it('vieja con la leyenda del color del recuadro: un solo cambio de color, sin AMS', async () => {
    const it = check(await run({ style: 'old', colors: { oldLegend: '#111111' } }), { oldLegend: 'panel' });
    expect(it.parts.map((p) => p.colorKey)).toEqual(['base', 'panel']);
    expect(it.analysis.needsMMU).toBe(false);
  });

  it('cada estilo usa su propia patente', async () => {
    const neu = check(await run({ plateNew: 'AE 456 FG' }), {});
    const old = check(await run({ style: 'old', plateOld: 'XYZ 789' }), {});
    expect(neu.name).toBe('AE 456 FG');
    expect(old.name).toBe('XYZ 789');
  });

  it('sin estrellas, sin bandera, sin leyenda y sin borde sigue armando', async () => {
    for (const over of [{ showStars: false }, { showFlag: false }, { topText: '' }, { border: false }, { style: 'old', topTextOld: '', border: false }, { style: 'old', showShield: false, showSlots: false }, { style: 'old', attach: 'inside' }, { style: 'old', attach: 'inside', colorMode: 'mmu', textStyle: 'inlay' }]) {
      const it = check(await run(over), over);
      if (over.showFlag === false) expect(it.parts.some((p) => p.colorKey === 'flag')).toBe(false);
    }
  });

  it('sujeción: orejita a cada lado, agujero adentro y sin sujeción', async () => {
    const none = check(await run({ attach: 'none' }), { attach: 'none' });
    expect(none.sizeMm[0]).toBeCloseTo(70, 1);
    const top = check(await run({ ringSide: 'top' }), { ringSide: 'top' });
    expect(top.sizeMm[1]).toBeGreaterThan(none.sizeMm[1] + 4);
    check(await run({ ringSide: 'right' }), { ringSide: 'right' });
    const inside = await run({ attach: 'inside', charWidth: 160 });
    const it = check(inside, { attach: 'inside' });
    expect(it.sizeMm[0]).toBeCloseTo(70, 1);
    // con letras anchas manda el ancho: el agujero le quita lugar a los caracteres
    expect(charMm(inside)).toBeLessThan(charMm(await run({ attach: 'none', charWidth: 160 })));
  });

  it('por capas (por defecto): cada color en su propia altura, sin AMS, en los dos estilos', async () => {
    for (const style of ['mercosur', 'old']) {
      const it = check(await run({ style, layerStepMm: 0.4, plateThicknessMm: 3 }), { style });
      expect(it.analysis.needsMMU, style).toBe(false);
      // un cambio de filamento por cada color después de la placa, en orden de abajo hacia arriba
      const changes = it.analysis.colorChanges;
      expect(changes.length, style).toBe(it.parts.length - 1);
      expect(changes.map((c) => c.zMm), style).toEqual(style === 'old' ? [3, 3.4] : [3, 3.4, 3.8]);
      // la pieza sube un escalón por color
      expect(it.sizeMm[2], style).toBeCloseTo(3 + 0.4 * (it.parts.length - 1), 2);
    }
    const mercosur = check(await run(), {});
    expect(mercosur.analysis.colorChanges.map((c) => c.toColorKey)).toEqual(['band', 'flag', 'text']);
  });

  it('por capas: un color igual al de la placa no suma cambios de filamento', async () => {
    const it = check(await run({ colors: { band: '#ffffff' } }), { band: 'base' });
    expect(it.parts.map((p) => p.colorKey)).toEqual(['base', 'text', 'flag']);
    expect(it.analysis.colorChanges.map((c) => c.toColorKey)).toEqual(['flag', 'text']);
  });

  it('misma altura (AMS): todos los colores llegan a la misma capa, sin huecos más bajos', async () => {
    for (const style of ['mercosur', 'old']) {
      const r = await run({ style, colorMode: 'mmu' });
      const it = check(r, { style, colorMode: 'mmu' });
      expect(it.analysis.needsMMU, style).toBe(true);
      // la placa también sube hasta arriba donde rellena la leyenda, las estrellas, la bandera o los caracteres calados
      const tops = it.parts.map((p) => p.zMax);
      for (const z of tops) expect(z, style).toBeCloseTo(tops[0], 3);
      // relleno: más material del color de la placa que con los huecos
      const flat = check(await run({ style, colorMode: 'mmu', textStyle: 'inlay' }), { style, textStyle: 'inlay' });
      const base = (x) => x.parts.find((p) => p.colorKey === 'base').volumeMm3;
      expect(base(it), style).toBeGreaterThan(base(flat));
    }
  });

  it('embutido (misma altura): la cara de arriba queda plana', async () => {
    const it = check(await run({ colorMode: 'mmu', textStyle: 'inlay', plateThicknessMm: 3 }), { textStyle: 'inlay' });
    expect(it.sizeMm[2]).toBeLessThan(3.3);
  });

  it('colores iguales se juntan en una sola parte', async () => {
    const it = check(await run({ colors: { flag: '#1d4fa3' } }), { flag: 'band' });
    expect(it.parts.map((p) => p.colorKey)).toEqual(['base', 'text', 'band']);
  });

  it('llavero chico: avisa que la leyenda queda muy chica', async () => {
    const r = await run({ widthMm: 40 });
    check(r, { widthMm: 40 });
    expect(r.messages.some((m) => m.code === 'plate.smallText')).toBe(true);
  });

  it('patente vacía → error sin geometría', async () => {
    const r = await run({ plateNew: '   ' });
    expect(r.items).toEqual([]);
    expect(r.messages.some((m) => m.code === 'plate.empty')).toBe(true);
  });

  it('normalizeParams nunca lanza y clampea', () => {
    expect(() => normalizeParams(null)).not.toThrow();
    const p = normalizeParams({ style: 'nope', widthMm: 5, attach: 'x', colors: { band: 'azul' } });
    expect(p.style).toBe('mercosur');
    expect(p.widthMm).toBe(40);
    expect(p.attach).toBe(defaults.attach);
    expect(p.colors.band).toBe(defaults.colors.band);
  });
});
