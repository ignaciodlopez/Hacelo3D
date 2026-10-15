import { zipSync } from 'fflate';

/** @param {Record<string, Uint8Array>} files */
export function makeZip(files) {
  return zipSync(files, { level: 6 });
}
