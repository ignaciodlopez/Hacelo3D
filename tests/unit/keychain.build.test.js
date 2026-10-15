import { describe, it, expect, beforeAll } from 'vitest';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/keychain/build.js';
import { defaults } from '../../src/tools/keychain/params.js';

let K;
const ctx = () => ({ getFont: (id) => fontStore.get(id), printer: {} });
beforeAll(async () => {
  K = await initKernel();
});

const run = (over = {}) => build(K, { ...defaults, ...over }, ctx());

describe('llavero: caso de la captura', () => {
  it('Valentina/Pacifico genera una pieza manifold con un agujero (genus 1)', async () => {
    const r = await run();
    expect(r.items).toHaveLength(1);
    const it0 = r.items[0];
    console.log('size', it0.sizeMm.map((n) => n.toFixed(1)), 'tri', it0.triangles, 'msgs', JSON.stringify(r.messages), 'changes', JSON.stringify(r.info.colorChanges));
    expect(it0.merged.status).toBe('NoError');
    expect(it0.merged.genus).toBe(1);
    expect(it0.parts.map((p) => p.colorKey).sort()).toEqual(['base', 'text']);
    expect(r.messages.filter((m) => m.level === 'error')).toEqual([]);
    expect(it0.sizeMm[2]).toBeCloseTo(4.4, 0);
    expect(r.info.colorChanges).toHaveLength(1);
  });
});
