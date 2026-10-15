import Module from 'manifold-3d';

let kernelPromise = null;

/**
 * Inicializa manifold-3d una sola vez. En el navegador hay que pasar `wasmUrl`
 * (importado con `?url` desde el worker); en Node se resuelve solo.
 * @param {{ wasmUrl?: string }} [opts]
 */
export function initKernel(opts = {}) {
  if (!kernelPromise) {
    kernelPromise = (async () => {
      const wasm = await Module(opts.wasmUrl ? { locateFile: () => opts.wasmUrl } : undefined);
      wasm.setup();
      return wasm;
    })();
  }
  return kernelPromise;
}

/**
 * Registro de objetos WASM (CrossSection / Manifold) para liberarlos con .delete().
 * `track(obj)` devuelve el mismo objeto; `dispose(...keep)` libera todo menos `keep`.
 */
export function createScope() {
  /** @type {any[]} */
  const objs = [];
  const track = (o) => {
    objs.push(o);
    return o;
  };
  const dispose = (...keep) => {
    for (const o of objs) {
      if (keep.includes(o)) continue;
      try {
        o.delete();
      } catch {
        /* ya liberado */
      }
    }
    objs.length = 0;
  };
  return { track, dispose };
}

/** Ejecuta fn(track) y libera todo lo creado, salvo lo que fn devuelva en `keep`. */
export function withScope(fn) {
  const scope = createScope();
  try {
    return fn(scope.track);
  } finally {
    scope.dispose();
  }
}
