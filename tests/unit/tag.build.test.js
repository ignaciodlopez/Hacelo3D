import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/tag/build.js';
import { defaults, normalizeParams } from '../../src/tools/tag/params.js';
import { SHAPES } from '../../src/tools/tag/shapes.js';
import tag from '../../src/tools/tag/index.js';

let K;
beforeAll(async () => {
  K = await initKernel();
});

const STAR = [Array.from({ length: 10 }, (_, i) => [(i % 2 ? 4 : 10) * Math.cos((i * Math.PI) / 5), (i % 2 ? 4 : 10) * Math.sin((i * Math.PI) / 5)])];
const SUN = [[[0, 0], [4, 0], [4, 4], [0, 4]], [[10, 0], [14, 0], [14, 4], [10, 4]]]; // dos piezas sueltas
const ctx = (extra = {}) => ({ getFont: (id) => fontStore.get(id), printer: {}, ...extra });
const run = (over = {}, extra = {}) => build(K, { ...defaults, curveQuality: 'draft', ...over }, ctx(extra));
const codes = (r) => r.messages.map((m) => m.code);
/** Placa y letras de colores distintos (el default es todo del mismo color). */
const TWO = { colors: { base: '#2f80ed', text: '#ffffff', border: null } };

function check(r, label) {
  expect(r.messages.filter((m) => m.level === 'error'), label).toEqual([]);
  expect(r.items.length, label).toBe(1);
  const it = r.items[0];
  expect(it.merged.status, label).toBe('NoError');
  for (const p of it.parts) {
    expect(p.status, `${label} ${p.colorKey}`).toBe('NoError');
    expect(p.volumeMm3, `${label} ${p.colorKey}`).toBeGreaterThan(0);
  }
  expect(it.parts[0].positions.buffer).not.toBe(it.merged.positions.buffer);
  return it;
}

const manifoldOf = (part) => new K.Manifold(new K.Mesh({ numProp: 3, vertProperties: part.positions, triVerts: part.indices }));

/** Las letras (y todo lo del color de letras) caen dentro de la placa: no invaden agujeros ni se salen del borde. */
function textInsidePlate(it, label) {
  const base = it.parts.find((p) => p.colorKey === 'base');
  const text = it.parts.find((p) => p.colorKey === 'text');
  if (!text) return;
  const plate = manifoldOf(base).slice(base.zMax - 0.05);
  const onTop = manifoldOf(text).slice(text.zMax - 0.05);
  const out = onTop.subtract(plate).area();
  expect(out, `${label}: ${out.toFixed(3)} mm² fuera de la placa`).toBeLessThan(0.05);
}

describe('chapita para mascota', () => {
  it('por defecto: huesito clásico de 55 × 31, placa celeste y letras blancas, con UN solo cambio de color', async () => {
    expect(defaults.colors).toEqual({ base: '#4fb3f0', text: '#ffffff', border: null });
    const r = await run();
    const it = check(r, 'default');
    expect(it.parts.map((p) => p.colorKey).sort()).toEqual(['base', 'text']);
    expect(it.parts.find((p) => p.colorKey === 'base').color).toBe('#4fb3f0');
    expect(it.parts.find((p) => p.colorKey === 'text').color).toBe('#ffffff');
    expect(it.sizeMm[0]).toBeCloseTo(55, 1);
    expect(it.sizeMm[2]).toBeCloseTo(4, 1); // placa 3 + relieve 1
    expect(it.merged.genus).toBe(1); // el agujero de la argolla
    expect(r.info.needsMMU).toBe(false);
    expect(r.info.colorChanges).toEqual([{ zMm: 3, layer: 16, toColorKey: 'text' }]);
    expect(r.messages.filter((m) => m.level === 'warn')).toEqual([]);
    textInsidePlate(it, 'default');
    // el borde (bajo) y las letras (más altas) son del mismo color: terminan a alturas distintas
    expect(it.parts.find((p) => p.colorKey === 'text').zMax).toBeCloseTo(4, 1);
  });

  it('con placa y letras del mismo color: una sola pieza, de un tirón', async () => {
    const r = await run({ colors: { base: '#ececec', text: '#ececec', border: null } });
    const it = check(r, 'monocolor');
    expect(it.parts.map((p) => p.colorKey)).toEqual(['base']);
    expect(r.info.colorChanges).toEqual([]);
  });

  it('informa siempre el alto de letra real, y avisa si se achicó para entrar', async () => {
    const roomy = await run({ shape: 'circle', widthMm: 90, attach: 'none', nameSizeMm: 12, phoneSizeMm: 8, extra: 'Me perdí' });
    const m = roomy.messages.find((x) => x.code === 'tag.textSizes');
    expect(m.params.name).toBe('12.0');
    expect(m.params.phone).toBe('8.0');
    expect(m.params.extra).toContain('4.5');
    expect(codes(roomy)).not.toContain('tag.textSizesShrunk');
    const tight = await run({ shape: 'circle', widthMm: 30, attach: 'none' });
    const s = tight.messages.find((x) => x.code === 'tag.textSizesShrunk');
    expect(s).toBeTruthy();
    expect(Number(s.params.name)).toBeLessThan(defaults.nameSizeMm);
    // sin texto no hay nada que informar
    expect((await run({ name: '', phone: '', extra: '' })).messages.map((x) => x.code).some((c) => c.startsWith('tag.textSizes'))).toBe(false);
  });

  it('los tamaños del nombre y del teléfono se respetan (si entran) y se pueden cambiar', async () => {
    const big = { shape: 'circle', widthMm: 90, attach: 'none', rim: false };
    const heightOf = async (over) => {
      const it = check(await run({ ...big, ...over }), JSON.stringify(over));
      expect(it.textScale, JSON.stringify(over)).toBe(1); // entra: no se toca
      const text = it.parts.find((p) => p.colorKey === 'text');
      const b = manifoldOf(text).slice(text.zMax - 0.05).bounds();
      return b.max[1] - b.min[1];
    };
    const small = await heightOf({ nameSizeMm: 5, phoneSizeMm: 4 });
    const large = await heightOf({ nameSizeMm: 12, phoneSizeMm: 9 });
    // alto del bloque = nombre + espacio + teléfono (con tipografía, ~1:1 con el alto de letra)
    expect(small).toBeGreaterThan(8);
    expect(small).toBeLessThan(13);
    expect(large).toBeGreaterThan(small * 1.8);
    // cada línea por separado: subir solo el nombre agranda el bloque, pero no tanto como subir las dos
    const onlyName = await heightOf({ nameSizeMm: 12, phoneSizeMm: 4 });
    expect(onlyName).toBeGreaterThan(small);
    expect(onlyName).toBeLessThan(large);
  });

  it('todas las formas salen cerradas, en una pieza y con el texto adentro', async () => {
    for (const shape of SHAPES.filter((s) => s !== 'icon')) {
      for (const attach of ['ring', 'inside', 'none']) {
        const over = { shape, attach, widthMm: 46 };
        const it = check(await run(over), JSON.stringify(over));
        expect(it.merged.genus, JSON.stringify(over)).toBe(attach === 'none' ? 0 : 1);
        textInsidePlate(it, JSON.stringify(over));
      }
    }
  });

  it('la orejita puede ir en los cuatro lados y se corre a lo largo del borde', async () => {
    for (const ringSide of ['top', 'bottom', 'left', 'right']) {
      const it = check(await run({ ringSide, shape: 'rounded', widthMm: 50, heightMm: 30 }), ringSide);
      expect(it.merged.genus, ringSide).toBe(1);
      if (ringSide === 'top' || ringSide === 'bottom') expect(it.sizeMm[1]).toBeGreaterThan(30 + 3);
      else expect(it.sizeMm[0]).toBeGreaterThan(50 + 3);
    }
    const centered = (await run({ ringOffsetMm: 0 })).items[0].bboxXY;
    const moved = (await run({ ringOffsetMm: 12 })).items[0];
    expect(moved.merged.status).toBe('NoError');
    // la orejita sigue el borde: corrida 12 mm sobre el nudo del hueso queda más arriba que sobre la barra
    expect(moved.bboxXY[3]).toBeGreaterThan(centered[3] + 2);
    expect(moved.merged.genus).toBe(1);
  });

  it('pasante: dos ranuras para el collar; si no entran, avisa y no las hace', async () => {
    const ok = await run({ shape: 'rounded', widthMm: 50, heightMm: 30, cornerRadiusMm: 5, attach: 'slots', collarWidthMm: 20 });
    const it = check(ok, 'pasante');
    expect(it.merged.genus).toBe(2);
    expect(codes(ok)).not.toContain('tag.slotNoRoom');
    textInsidePlate(it, 'pasante');

    const tight = await run({ shape: 'rounded', widthMm: 50, heightMm: 30, attach: 'slots', collarWidthMm: 40 });
    expect(codes(tight)).toContain('tag.slotNoRoom');
    expect(tight.messages.find((m) => m.code === 'tag.slotNoRoom').params.mm).toBeLessThan(40);
    expect(check(tight, 'sin lugar').merged.genus).toBe(0);
  });

  it('auto llena el espacio y fijo respeta los tamaños (y avisa si achica)', async () => {
    const auto = check(await run({ name: 'Bo', phone: '', shape: 'circle', widthMm: 50, textSizing: 'auto' }), 'auto');
    expect(auto.textScale).toBeGreaterThan(1.2);
    const fixed = await run({ name: 'Bo', phone: '', shape: 'circle', widthMm: 50, textSizing: 'fixed' });
    expect(check(fixed, 'fijo').textScale).toBe(1);
    const long = await run({ name: 'Maximiliano Alejandro', phone: '11 1234 5678', textSizing: 'fixed', shape: 'circle', widthMm: 60 });
    expect(codes(long)).toContain('tag.textSizesShrunk');
    expect(long.messages.find((m) => m.code === 'tag.textSizesShrunk').params.pct).toBeLessThan(100);
    expect(check(long, 'largo').textScale).toBeLessThan(1);
    textInsidePlate(long.items[0], 'largo');
  });

  it('automático: cada línea crece por su cuenta si tiene lugar a su altura (el nombre, más corto, sale más grande que el teléfono)', async () => {
    // pasante: el teléfono manda el ancho entre las ranuras y el nombre aprovecha lo que sobra
    const over = { shape: 'rounded', widthMm: 50, heightMm: 30, cornerRadiusMm: 5, attach: 'slots' };
    const auto = check(await run({ ...over, textSizing: 'auto' }), 'pasante auto');
    const [name, phone] = auto.lineScales;
    expect(name).toBeGreaterThan(phone * 1.05);
    expect(name / phone).toBeLessThanOrEqual(1.8 + 1e-6);
    textInsidePlate(auto, 'pasante auto');
    // en tamaño fijo las líneas no crecen por separado
    const fixed = check(await run({ ...over, textSizing: 'fixed' }), 'pasante fijo');
    expect(fixed.lineScales[0]).toBeCloseTo(fixed.lineScales[1], 6);
    // círculo con el agujero adentro: no queda nada de la orejita, mide justo lo pedido
    const round = check(await run({ shape: 'circle', widthMm: 50, attach: 'inside' }), 'círculo');
    expect(round.sizeMm[0]).toBeCloseTo(50, 1);
    expect(round.sizeMm[1]).toBeCloseTo(50, 1);
  });

  it('en formas simétricas el texto queda centrado en la forma, aunque haya un agujero arriba', async () => {
    const centerOf = (it) => {
      const text = it.parts.find((p) => p.colorKey === 'text');
      const b = manifoldOf(text).slice(text.zMax - 0.05).bounds();
      return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];
    };
    for (const over of [{ shape: 'circle', widthMm: 50, attach: 'inside' }, { shape: 'circle', widthMm: 50, attach: 'ring' }, { shape: 'hexagon', widthMm: 44, attach: 'inside' }, { shape: 'oval', widthMm: 50, heightMm: 34, attach: 'inside' }]) {
      const it = check(await run({ ...TWO, rim: false, ...over }), JSON.stringify(over));
      const [cx, cy] = centerOf(it);
      expect(Math.abs(cx), JSON.stringify(over)).toBeLessThan(1);
      expect(Math.abs(cy), JSON.stringify(over)).toBeLessThan(1);
    }
    // con un corrimiento manual se respeta lo que pidió el usuario
    const moved = check(await run({ ...TWO, rim: false, shape: 'circle', widthMm: 50, attach: 'inside', textOffsetYMm: -4 }), 'corrido');
    expect(moved.parts.length).toBe(2);
    const [, cyMoved] = ((it) => {
      const text = it.parts.find((p) => p.colorKey === 'text');
      const b = manifoldOf(text).slice(text.zMax - 0.05).bounds();
      return [0, (b.min[1] + b.max[1]) / 2];
    })(moved);
    expect(cyMoved).toBeLessThan(-2.5);
  });

  it('texto imposible de ajustar: avisa en vez de salirse de la placa', async () => {
    const r = await run({ name: 'Nombre larguísimo de una mascota', phone: '11 1234 5678 11 1234 5678', widthMm: 20, shape: 'circle' });
    expect(codes(r)).toContain('tag.textTooBig');
    check(r, 'imposible');
  });

  it('estilos: embutido necesita multicolor, grabado deja las letras huecas', async () => {
    const inlay = await run({ ...TWO, textStyle: 'inlay' });
    check(inlay, 'inlay');
    expect(inlay.info.needsMMU).toBe(true);
    textInsidePlate(inlay.items[0], 'inlay');
    // con el mismo color en placa y letras el embutido no se ve: avisa
    expect(codes(await run({ textStyle: 'inlay', colors: { base: '#ececec', text: '#ececec', border: null } }))).toContain('tag.inlaySameColor');
    const engraved = await run({ ...TWO, textStyle: 'engraved', engraveDepthMm: 1 });
    const it = check(engraved, 'engraved');
    expect(it.parts.map((p) => p.colorKey).sort()).toEqual(['base', 'text']); // el borde sigue siendo del color de las letras
    const raised = (await run(TWO)).items[0].parts.find((p) => p.colorKey === 'base');
    expect(it.parts.find((p) => p.colorKey === 'base').volumeMm3).toBeLessThan(raised.volumeMm3); // le falta el hueco de las letras
  });

  it('borde: se puede sacar y puede ser de otro color', async () => {
    const withRim = check(await run(TWO), 'borde').parts.find((p) => p.colorKey === 'text').volumeMm3;
    const noRim = check(await run({ ...TWO, rim: false }), 'sin borde').parts.find((p) => p.colorKey === 'text').volumeMm3;
    expect(noRim).toBeLessThan(withRim - 20); // el borde es fino y bajo: unos mm³, pero se nota
    const own = check(await run({ colors: { base: '#2f80ed', text: '#ffffff', border: '#ff0000' } }), 'borde rojo');
    expect(own.parts.map((p) => p.colorKey).sort()).toEqual(['base', 'border', 'text']);
    expect(own.parts.find((p) => p.colorKey === 'border').color).toBe('#ff0000');
  });

  it('chapita sin texto: sale igual, solo con la placa y el borde', async () => {
    const it = check(await run({ name: '', phone: '', extra: '' }), 'vacía');
    expect(it.textScale).toBe(0);
    expect(it.name).toBe('chapita');
  });

  it('silueta de un ícono: usa el contorno; sin ícono, o con piezas sueltas, da error claro', async () => {
    const ok = await run({ shape: 'icon', icon: 'star', widthMm: 46 }, { iconPolys: { star: STAR } });
    check(ok, 'ícono');
    expect(ok.items[0].sizeMm[0]).toBeGreaterThan(40);
    const none = await run({ shape: 'icon', icon: null });
    expect(none.items).toEqual([]);
    expect(codes(none)).toContain('tag.noIcon');
    const loose = await run({ shape: 'icon', icon: 'sun', widthMm: 46, attach: 'none' }, { iconPolys: { sun: SUN } });
    expect(codes(loose)).toContain('tag.islands');
  });

  it('los presets salen bien y respetan lo que el usuario ya eligió', async () => {
    for (const preset of tag.presets) {
      const it = check(await run(preset.params), preset.id);
      textInsidePlate(it, preset.id);
    }
    // presetKeep: el texto, los colores y las medidas de hardware no se pisan
    for (const k of ['name', 'phone', 'colors', 'ringHoleMm', 'collarWidthMm']) expect(tag.presetKeep).toContain(k);
    for (const preset of tag.presets) for (const k of tag.presetKeep) expect(Object.keys(preset.params), `${preset.id} pisa ${k}`).not.toContain(k);
  });

  it('el texto con acentos y la ñ no rompe nada', async () => {
    check(await run({ name: 'Ñandú', phone: '☎ 11 1234', extra: 'Soy cariñoso' }), 'acentos');
  });

  it('normalizeParams nunca lanza y clampea', () => {
    expect(() => normalizeParams(null)).not.toThrow();
    const p = normalizeParams({ shape: 'x', attach: 'y', widthMm: 9999, ringHoleMm: -3, name: 'a'.repeat(100), colors: { base: 'zz', border: 'nope' } });
    expect(p.shape).toBe(defaults.shape);
    expect(p.attach).toBe(defaults.attach);
    expect(p.widthMm).toBe(150);
    expect(p.ringHoleMm).toBe(2);
    expect(p.name.length).toBe(30);
    expect(p.colors.base).toBe(defaults.colors.base);
    expect(p.colors.border).toBeNull();
  });
});
