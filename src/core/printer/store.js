import { defaultPrinter, normalizePrinter } from './profiles.js';
import { loadJson, saveJson } from '../state/persistence.js';

const KEY = 'b3d.printer';
let printer = normalizePrinter(loadJson(KEY, defaultPrinter));
const listeners = new Set();

export const getPrinter = () => printer;

export function setPrinter(next) {
  printer = normalizePrinter({ ...printer, ...next });
  saveJson(KEY, printer);
  listeners.forEach((fn) => fn(printer));
}

export function onPrinterChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
