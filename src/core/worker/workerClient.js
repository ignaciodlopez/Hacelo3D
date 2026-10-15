// API promisificada sobre el worker de geometría.
// - Descarta respuestas viejas (reqId menor al último enviado de ese tipo).
// - Si el worker muere, lo recrea y reintenta una vez.

export function createWorkerClient() {
  let worker = null;
  let seq = 0;
  let latestBuild = 0;
  /** @type {Map<number, {resolve:Function, reject:Function, msg:any, transfer:any[], retried:boolean, isBuild:boolean}>} */
  const pending = new Map();

  function start() {
    worker = new Worker(new URL('./geometry.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const m = e.data;
      const p = pending.get(m.reqId);
      if (!p) return;
      pending.delete(m.reqId);
      if (m.type === 'error') p.reject(new Error(m.message));
      else if (p.isBuild && m.reqId < latestBuild) p.resolve({ stale: true });
      else p.resolve(m.type === 'result' ? { stale: false, result: m.result } : { stale: false });
    };
    worker.onerror = () => recover();
  }

  function recover() {
    worker?.terminate();
    start();
    for (const [id, p] of [...pending]) {
      // los builds se reintentan una vez; subir fuentes no (el buffer ya se transfirió)
      if (p.retried || p.msg.type !== 'build') {
        pending.delete(id);
        p.reject(new Error('El generador de geometría se reinició. Probá de nuevo.'));
      } else {
        p.retried = true;
        worker.postMessage(p.msg);
      }
    }
  }

  function send(msg, isBuild, transfer = []) {
    if (!worker) start();
    const reqId = ++seq;
    if (isBuild) latestBuild = reqId;
    const full = { ...msg, reqId };
    return new Promise((resolve, reject) => {
      pending.set(reqId, { resolve, reject, msg: full, transfer: [], retried: false, isBuild });
      worker.postMessage(full, transfer);
    });
  }

  return {
    /** @returns {Promise<{stale:boolean, result?:any}>} */
    build: (toolId, params, printer, extra = {}) => send({ type: 'build', toolId, params, printer, extra }, true),
    addFont: (id, buffer) => send({ type: 'addFont', id, buffer }, false, [buffer]),
    dispose: () => {
      worker?.terminate();
      worker = null;
      pending.clear();
    },
  };
}
