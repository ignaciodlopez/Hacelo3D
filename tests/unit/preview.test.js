import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore } from './helpers.js';
import { tools } from '../../src/tools/registry.js';

let K;
const ctx = (extra = {}) => ({ getFont: (id) => fontStore.get(id), printer: {}, ...extra });
beforeAll(async () => {
  K = await initKernel();
});

const tool = (id) => tools.find((t) => t.id === id);
const run = async (id, over = {}, extra = {}) => {
  const t = tool(id);
  const { build } = await t.build();
  return build(K, { ...t.defaults, curveQuality: 'draft', ...over }, ctx(extra));
};

/** ¿Algún triángulo de la parte cubre (en planta) el punto (x, y)? */
function covers(part, x, y) {
  const P = part.positions;
  const I = part.indices;
  for (let k = 0; k < I.length; k += 3) {
    const [a, b, c] = [I[k] * 3, I[k + 1] * 3, I[k + 2] * 3];
    // las paredes verticales en planta son una línea: no cubren nada
    if (Math.abs((P[b] - P[a]) * (P[c + 1] - P[a + 1]) - (P[c] - P[a]) * (P[b + 1] - P[a + 1])) < 1e-9) continue;
    const d1 = (x - P[b]) * (P[a + 1] - P[b + 1]) - (P[a] - P[b]) * (y - P[b + 1]);
    const d2 = (x - P[c]) * (P[b + 1] - P[c + 1]) - (P[b] - P[c]) * (y - P[c + 1]);
    const d3 = (x - P[a]) * (P[c + 1] - P[a + 1]) - (P[c] - P[a]) * (y - P[a + 1]);
    const neg = d1 < 0 || d2 < 0 || d3 < 0;
    const pos = d1 > 0 || d2 > 0 || d3 > 0;
    if (!(neg && pos)) return true;
  }
  return false;
}

describe('vista previa (sin la pieza unida)', () => {
  // la unión de todos los colores es lo más lento: la vista previa no la arma, el resto sale igual
  const MULTI = [
    ['keychain', {}],
    ['topper', {}],
    ['qr', {}],
    ['tag', { colors: { base: '#2f80ed', text: '#ffffff', border: null } }],
    ['ornament', {}],
    ['plate', {}],
  ];
  for (const [id, over] of MULTI) {
    it(`${id}: mismas partes y medidas que la generación completa`, async () => {
      const full = await run(id, over);
      const prev = await run(id, over, { preview: true });
      expect(full.items[0].merged).not.toBeNull();
      expect(prev.items.length).toBe(full.items.length);
      prev.items.forEach((it, i) => {
        const f = full.items[i];
        expect(it.merged, id).toBeNull();
        expect(it.parts.map((p) => p.colorKey)).toEqual(f.parts.map((p) => p.colorKey));
        it.sizeMm.forEach((v, k) => expect(v).toBeCloseTo(f.sizeMm[k], 3));
        it.bboxXY.forEach((v, k) => expect(v).toBeCloseTo(f.bboxXY[k], 3));
        expect(it.triangles).toBeGreaterThan(0);
      });
      expect(prev.messages).toEqual(full.messages);
    });
  }

  it('con un solo color la pieza unida sale igual (no cuesta nada)', async () => {
    const r = await run('stamp', {}, { preview: true });
    expect(r.items[0].merged.status).toBe('NoError');
    // placa, letras y borde del mismo color: una sola pieza
    const one = await run('tag', { colors: { base: '#ffffff', text: '#ffffff', border: null } }, { preview: true });
    expect(one.items[0].parts.length).toBe(1);
    expect(one.items[0].merged).not.toBeNull();
  });

  it('el lote con "mismo tamaño de letra" da la misma escala para todos', async () => {
    const r = await run('keychain', { mode: 'batch', batchUniform: 'sameScale', batchText: 'Ana\nValentina\nJuan' }, { preview: true });
    expect(r.items.length).toBe(3);
    const scales = r.items.map((it) => it.scale);
    for (const s of scales) expect(s).toBeCloseTo(scales[0], 9);
    // el más largo define la escala: Valentina queda al ancho pedido y los demás más angostos
    const widths = r.items.map((it) => it.sizeMm[0]);
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(widths[1]).toBeGreaterThan(widths[2]);
  });
});

describe('arreglos de la auditoría', () => {
  it('llavero: la ranura no avisa por las medidas de la oreja (que no usa)', async () => {
    const r = await run('keychain', { ringType: 'slot', ringOuterMm: 6, ringHoleMm: 2 });
    const codes = r.messages.map((m) => m.code);
    expect(codes).not.toContain('ring.thinWall');
    expect(codes).not.toContain('ring.smallHole');
  });

  it('llavero: el agujero interno no queda limitado por el diámetro de la oreja (oculta)', async () => {
    const p = tool('keychain').normalize({ ringType: 'internal', ringOuterMm: 9, ringHoleMm: 10 });
    expect(p.ringHoleMm).toBe(10);
    expect(tool('keychain').normalize({ ringType: 'tab', ringOuterMm: 9, ringHoleMm: 10 }).ringHoleMm).toBeCloseTo(7.4, 6);
  });

  it('chapita: si no queda lugar para el texto, avisa (antes desaparecía sin aviso)', async () => {
    const r = await run('tag', { shape: 'rounded', widthMm: 20, heightMm: 15, rimWidthMm: 5, textMarginMm: 6, attach: 'none' });
    expect(r.messages.map((m) => m.code)).toContain('tag.textTooBig');
  });

  it('adorno: un nombre corrido hacia arriba no tapa el agujero de la argolla', async () => {
    const r = await run('ornament', { name: 'O', nameOffsetYMm: 30 });
    const it = r.items[0];
    const name = it.parts.find((p) => p.colorKey === 'name');
    const d = defaults('ornament');
    const rOut = d.diameterMm / 2;
    const rl = d.loopHoleMm / 2 + d.loopWallMm;
    const cy = Math.max(rOut + 0.1 * rl, rOut - d.ringWidthMm + 0.8 + d.loopHoleMm / 2);
    const hr = d.loopHoleMm / 2;
    // el agujero baja dentro del aro (el nombre se recorta al círculo exterior, así que solo puede taparlo ahí)
    const inHole = [];
    for (let x = -hr; x <= hr; x += 0.25) for (let y = cy - hr; y < rOut - 0.05; y += 0.25) if (Math.hypot(x, y - cy) < hr - 0.1) inHole.push([x, y]);
    expect(inHole.length).toBeGreaterThan(4);
    // el nombre llega hasta esa altura…
    let top = -Infinity;
    for (let i = 1; i < name.positions.length; i += 3) top = Math.max(top, name.positions[i]);
    expect(top).toBeGreaterThan(cy - hr + 0.5);
    // …pero no tapa el agujero en ningún punto
    expect(inHole.filter(([x, y]) => covers(name, x, y))).toEqual([]);
  });

  it('topper: el palito del medio se corre si justo abajo del centro no hay material', async () => {
    // ajustado a las letras y con las palabras bien separadas: debajo del centro está el espacio entre ellas
    // (que las dos palabras queden sueltas se avisa aparte; acá importa que no se pierda el palito)
    for (const sticks of [1, 3]) {
      const r = await run('topper', { text: 'Ana      Paz', fill: 'tight', sticks });
      expect(r.messages.map((m) => m.code), `${sticks} palitos`).not.toContain('topper.sticksFewer');
    }
  });

  it('pedido: lámpara con solo la base no menciona la pantalla', () => {
    const lamp = tool('lamp');
    const rows = Object.fromEntries(lamp.orderSummary({ ...lamp.defaults, parts: 'base' }, { lang: 'es', color: (c) => c, option: (k, v) => v }));
    expect(rows.Colores).toBe(`base ${lamp.defaults.colors.base}`);
    expect(rows.Textura).toBe('');
  });

  it('pedido: el ícono va con su nombre, no con su id', () => {
    const ctxEs = { lang: 'es', color: (c) => c, option: (k, v) => v, icon: (id) => (id === 'paw-print' ? 'Huella' : id) };
    const stamp = tool('stamp');
    expect(Object.fromEntries(stamp.orderSummary({ ...stamp.defaults, icon: 'paw-print' }, ctxEs))['Ícono']).toBe('Huella');
    const tag = tool('tag');
    expect(Object.fromEntries(tag.orderSummary({ ...tag.defaults, shape: 'icon', icon: 'paw-print' }, ctxEs)).Modelo).toBe('Huella');
  });
});

function defaults(id) {
  return tool(id).defaults;
}
