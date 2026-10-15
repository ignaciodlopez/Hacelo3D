import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/keychain/build.js';
import { defaults } from '../../src/tools/keychain/params.js';

let K;
let live = () => 0;
let histogram = () => ({});

/**
 * Cuenta objetos WASM vivos: envuelve los métodos de instancia y estáticos de
 * CrossSection/Manifold (cualquier cosa que devuelva una instancia) y `delete()`.
 * (Un objeto está "vivo" mientras no se llamó a delete(); los `new CrossSection(...)` del proyecto siempre pasan por `track()`.)
 */
function instrument(mod) {
  const alive = new Map(); // objeto → método que lo creó
  const classes = [mod.CrossSection, mod.Manifold];
  const isInst = (r) => classes.some((c) => r instanceof c);
  const note = (r, name = '?') => {
    if (isInst(r)) alive.set(r, name);
    else if (Array.isArray(r)) r.forEach((x) => isInst(x) && alive.set(x, name));
    return r;
  };
  for (const cls of classes) {
    for (const target of [cls.prototype, cls]) {
      for (const name of Object.getOwnPropertyNames(target)) {
        if (['constructor', 'delete', 'deleteLater', 'isDeleted', 'isAliasOf', 'clone', 'length', 'name', 'prototype'].includes(name)) continue;
        const desc = Object.getOwnPropertyDescriptor(target, name);
        if (typeof desc?.value !== 'function') continue;
        const fn = desc.value;
        target[name] = function (...a) {
          return note(fn.apply(this, a), cls.name + (target === cls ? "." : "#") + name);
        };
      }
    }
    const del = cls.prototype.delete;
    cls.prototype.delete = function () {
      alive.delete(this);
      return del.apply(this);
    };
  }
  return {
    live: () => [...alive.keys()].filter((o) => !o.isDeleted()).length,
    histogram: () => {
      const h = {};
      for (const [o, n] of alive) if (!o.isDeleted()) h[n] = (h[n] ?? 0) + 1;
      return h;
    },
  };
}

beforeAll(async () => {
  K = await initKernel();
  const inst = instrument(K);
  live = inst.live;
  histogram = inst.histogram;
});

const ctx = () => ({ getFont: (id) => fontStore.get(id), printer: {}, iconPolys: { sq: [[[0, 0], [10, 0], [10, 10], [0, 10]]] } });

describe('memoria WASM', () => {
  it('el detector funciona: un objeto sin liberar se cuenta y uno liberado no', () => {
    const base = live();
    const leaked = K.CrossSection.circle(3, 16);
    expect(live() - base).toBe(1);
    leaked.delete();
    expect(live() - base).toBe(0);
  });

  it('createScope libera TODO lo creado en cada build (ningún CrossSection/Manifold queda vivo)', async () => {
    // `new CrossSection()` no se envuelve: lo contamos a mano comparando contra una línea base
    const variants = [
      {},
      { text: 'Mateo', letterStyle: 'flush', border: true },
      { text: 'Ana\nLuz', shape: 'heart', ringPosition: 'top' },
      { text: 'Valentina', textEffect: 'outline', fontId: 'lobster', shape: 'cloud' },
      { text: 'Sol', ringType: 'slot', shape: 'rounded', letterStyle: 'engraved', faceDown: true },
      { text: 'Lu', ringType: 'internal', marginMm: 9, shape: 'hexagon', textEffect: 'shadow' },
      { icon: 'sq', iconPosition: 'both' },
      { mode: 'batch', batchText: 'Ana\nLuz\nSol', batchUniform: 'sameScale' },
      { sizeMode: 'overallWidth', sizeMm: 70, shape: 'badge' },
    ];
    await build(K, { ...defaults }, ctx()); // calentamiento
    const base = live();
    for (const v of variants) {
      await build(K, { ...defaults, ...v }, ctx());
      expect(live() - base, JSON.stringify(v) + ' ' + JSON.stringify(histogram())).toBe(0);
    }
  });

  it('200 builds seguidos: sin objetos vivos acumulados', async () => {
    const base = live();
    for (let i = 0; i < 200; i++) await build(K, { ...defaults, text: i % 2 ? 'Mateo' : 'Sofía', shape: i % 3 ? 'follow' : 'heart' }, ctx());
    expect(live() - base).toBe(0);
  }, 180000);
});
