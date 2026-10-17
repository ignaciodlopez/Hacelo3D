import { describe, it, expect } from 'vitest';
import { inflateSync } from 'fflate';
import { encodeShare, decodeShare } from '../../src/core/state/persistence.js';
import { createToolState } from '../../src/core/state/toolState.js';
import tag from '../../src/tools/tag/index.js';
import keychain from '../../src/tools/keychain/index.js';
import lamp from '../../src/tools/lamp/index.js';

/** Formato anterior (el que usaban los enlaces ya compartidos): base64url(JSON({ v, params })). */
function oldEncode(params, version) {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: version, params }));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Lo que realmente viaja dentro de un enlace nuevo (JSON descomprimido). */
function payloadOf(code) {
  const b64 = code.slice(1).replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(inflateSync(bytes));
}

const DEF = { name: 'Boster', size: 5, on: true, nothing: null, colors: { base: '#4fb3f0', text: '#ffffff', border: null }, list: [1, 2] };

describe('enlace compartido', () => {
  it('ida y vuelta: solo viaja lo que difiere de los valores por defecto', () => {
    const params = { ...DEF, name: 'Luna 💛', size: 7.5, colors: { ...DEF.colors, text: '#ff0000' } };
    const code = encodeShare(params, 1, DEF);
    const out = decodeShare(code, DEF);
    expect(out.v).toBe(1);
    expect(out.params).toEqual(params);
    // lo que no cambió no está en el enlace
    const raw = payloadOf(code);
    expect(raw).not.toContain('Boster');
    expect(raw).not.toContain('#4fb3f0');
    expect(raw).toContain('Luna');
    expect(raw).toContain('#ff0000');
  });

  it('un valor puesto en null (o vuelto al default) se respeta', () => {
    const params = { ...DEF, colors: { ...DEF.colors, base: null, border: '#00ff00' }, list: [3] };
    expect(decodeShare(encodeShare(params, 1, DEF), DEF).params).toEqual(params);
  });

  it('sin cambios, el enlace es cortísimo', () => {
    const code = encodeShare(DEF, 1, DEF);
    expect(code.length).toBeLessThan(40);
    expect(decodeShare(code, DEF).params).toEqual(DEF);
  });

  it('sin defaults se manda todo (pero comprimido) y se abre igual', () => {
    const code = encodeShare(DEF, 2);
    const out = decodeShare(code);
    expect(out).toEqual({ v: 2, params: DEF });
  });

  it('los enlaces viejos (sin "~") se siguen abriendo', () => {
    const old = oldEncode({ ...DEF, name: 'Vieja 💛' }, 1);
    expect(old.startsWith('~')).toBe(false);
    expect(decodeShare(old, DEF)).toEqual({ v: 1, params: { ...DEF, name: 'Vieja 💛' } });
  });

  it('enlaces rotos o truncados dan null y no tiran', () => {
    for (const bad of ['', '~', '~@@@', '~AAAA', 'no-es-base64!!', encodeShare(DEF, 1, DEF).slice(0, 8)]) expect(() => decodeShare(bad, DEF)).not.toThrow();
    expect(decodeShare('~AAAA', DEF)).toBeNull();
    expect(decodeShare('no-es-base64!!', DEF)).toBeNull();
  });

  it('el estado de una herramienta se restaura con enlace nuevo y con enlace viejo', () => {
    const changed = { ...tag.defaults, name: 'Rex', phone: '11 5555 1234', shape: 'heart', colors: { ...tag.defaults.colors, base: '#ff8800' } };
    for (const code of [encodeShare(changed, tag.paramsVersion, tag.defaults), oldEncode(changed, tag.paramsVersion)]) {
      const state = createToolState(tag, code);
      expect(state.params.name).toBe('Rex');
      expect(state.params.shape).toBe('heart');
      expect(state.params.colors.base).toBe('#ff8800');
      expect(state.params.colors.text).toBe(tag.defaults.colors.text);
    }
  });

  it('el enlace de una herramienta real es mucho más corto que el viejo', () => {
    const rows = [];
    for (const [tool, over] of [
      [tag, {}],
      [tag, { name: 'Rex', phone: '3416686947', shape: 'paw', colors: { ...tag.defaults.colors, base: '#ff8800' } }],
      [keychain, { text: 'Valentina', sizeMm: 40 }],
      [lamp, { pattern: 'ribs', heightMm: 200, twistDeg: 90 }],
    ]) {
      const params = { ...tool.defaults, ...over };
      const nuevo = encodeShare(params, tool.paramsVersion, tool.defaults).length;
      const viejo = oldEncode(params, tool.paramsVersion).length;
      rows.push(`${tool.id}: ${viejo} -> ${nuevo}`);
      expect(nuevo, `${tool.id}`).toBeLessThan(viejo * 0.25);
      expect(nuevo, `${tool.id}`).toBeLessThan(160);
    }
    console.log('largo del enlace (viejo -> nuevo):', rows.join(' | '));
  });
});
