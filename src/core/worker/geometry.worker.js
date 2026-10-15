// Worker de geometría: carga manifold-3d y las fuentes UNA vez, y ejecuta tool.build().
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { initKernel } from '../kernel/manifold.js';
import { createFontStore } from '../fonts/fontStore.js';
import { tools } from '../../tools/registry.js';

const BASE = import.meta.env.BASE_URL;
let fontStore = null;

async function getFontStore() {
  if (!fontStore) {
    const catalog = await (await fetch(`${BASE}fonts/fonts.json`)).json();
    fontStore = createFontStore({
      catalog,
      loadBuffer: async (entry) => (await fetch(`${BASE}fonts/${entry.file}`)).arrayBuffer(),
    });
  }
  return fontStore;
}

/** Junta los buffers de los typed arrays para transferirlos sin copiar. */
function transferables(result) {
  const list = [];
  for (const item of result.items ?? []) {
    list.push(item.merged.positions.buffer, item.merged.indices.buffer);
    for (const p of item.parts) list.push(p.positions.buffer, p.indices.buffer);
  }
  return list;
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'addFont') {
      (await getFontStore()).addFromBuffer(msg.id, msg.buffer);
      self.postMessage({ type: 'fontAdded', reqId: msg.reqId, id: msg.id });
      return;
    }
    if (msg.type === 'build') {
      const [K, fonts] = await Promise.all([initKernel({ wasmUrl }), getFontStore()]);
      const tool = tools.find((t) => t.id === msg.toolId);
      if (!tool) throw new Error(`Herramienta desconocida: ${msg.toolId}`);
      const { build } = await tool.build();
      const t0 = performance.now();
      const result = await build(K, msg.params, {
        getFont: (id) => fonts.get(id),
        printer: msg.printer,
        iconPolys: msg.extra?.iconPolys,
      });
      result.ms = performance.now() - t0;
      self.postMessage({ type: 'result', reqId: msg.reqId, result }, transferables(result));
    }
  } catch (err) {
    self.postMessage({ type: 'error', reqId: msg.reqId, message: String(err?.message ?? err) });
  }
};
