import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initKernel, createScope } from '../../src/core/kernel/manifold.js';
import { createFontStore } from '../../src/core/fonts/fontStore.js';

const root = resolve(import.meta.dirname, '../..');
const catalog = JSON.parse(readFileSync(resolve(root, 'public/fonts/fonts.json'), 'utf8'));

export const fontStore = createFontStore({
  catalog,
  loadBuffer: async (entry) => {
    const b = readFileSync(resolve(root, 'public/fonts', entry.file));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  },
});

export { catalog, initKernel, createScope };
