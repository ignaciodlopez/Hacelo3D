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
    // en la vista previa no viene la pieza unida (ver mergeParts)
    if (item.merged) list.push(item.merged.positions.buffer, item.merged.indices.buffer);
    for (const p of item.parts) list.push(p.positions.buffer, p.indices.buffer);
  }
  return list;
}

/** La vista previa más nueva que llegó: las anteriores que todavía no arrancaron ya no hacen falta. */
let newestPreview = 0;

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'build' && msg.preview) newestPreview = Math.max(newestPreview, msg.reqId);
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
      if (msg.preview) {
        // mientras se generaba la anterior pueden haber llegado pedidos nuevos (se arrastra un control): se los deja
        // entrar y, si hay una vista previa más nueva, esta se descarta sin calcularla
        await new Promise((r) => setTimeout(r, 0));
        if (msg.reqId < newestPreview) {
          self.postMessage({ type: 'skipped', reqId: msg.reqId });
          return;
        }
      }
      const t0 = performance.now();
      const result = await build(K, msg.params, {
        getFont: (id) => fonts.get(id),
        printer: msg.printer,
        iconPolys: msg.extra?.iconPolys,
        logoPolys: msg.extra?.logoPolys,
        preview: !!msg.preview,
      });
      result.ms = performance.now() - t0;
      self.postMessage({ type: 'result', reqId: msg.reqId, result }, transferables(result));
    }
  } catch (err) {
    self.postMessage({ type: 'error', reqId: msg.reqId, message: String(err?.message ?? err) });
  }
};
