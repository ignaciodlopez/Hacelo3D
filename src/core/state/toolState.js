// Estado de una herramienta: params actuales, persistencia, deshacer/rehacer.

import { loadSaved, save, decodeShare } from './persistence.js';

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  const out = structuredClone(obj);
  let cur = out;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return out;
}

/**
 * @param {{ id:string, defaults:any, paramsVersion:number, migrate?:(p:any,v:number)=>any, normalize?:(p:any)=>any }} tool
 * @param {string|null} [sharedParam]  valor de ?p= de la URL
 */
export function createToolState(tool, sharedParam = null) {
  const normalize = tool.normalize ?? ((p) => p);
  const migrate = (obj) => {
    if (!obj || typeof obj !== 'object' || !obj.params) return null;
    try {
      const p = obj.v === tool.paramsVersion ? obj.params : (tool.migrate?.(obj.params, obj.v ?? 0) ?? obj.params);
      return normalize({ ...tool.defaults, ...p });
    } catch {
      return null;
    }
  };

  let params =
    (sharedParam && migrate(decodeShare(sharedParam))) || migrate(loadSaved(tool.id)) || normalize(structuredClone(tool.defaults));
  const listeners = new Set();
  const undoStack = [];
  const redoStack = [];
  let lastKey = null;
  let lastTime = 0;

  const emit = () => {
    save(tool.id, params, tool.paramsVersion);
    listeners.forEach((fn) => fn(params));
  };

  return {
    get params() {
      return params;
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Cambia un valor (acepta rutas con punto: "colors.base"). Cambios seguidos de la misma clave se agrupan. */
    set(path, value) {
      const next = setPath(params, path, value);
      const now = Date.now();
      if (!(lastKey === path && now - lastTime < 700)) {
        undoStack.push(params);
        if (undoStack.length > 100) undoStack.shift();
      }
      redoStack.length = 0;
      lastKey = path;
      lastTime = now;
      params = next;
      emit();
    },
    /** Reemplaza todos los params (presets, restablecer). */
    replace(next) {
      undoStack.push(params);
      redoStack.length = 0;
      lastKey = null;
      params = normalize({ ...tool.defaults, ...next });
      emit();
    },
    undo() {
      if (!undoStack.length) return;
      redoStack.push(params);
      params = undoStack.pop();
      lastKey = null;
      emit();
    },
    redo() {
      if (!redoStack.length) return;
      undoStack.push(params);
      params = redoStack.pop();
      lastKey = null;
      emit();
    },
    reset() {
      this.replace(structuredClone(tool.defaults));
    },
  };
}
