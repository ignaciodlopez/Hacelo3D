import { describe, it, expect } from 'vitest';
import { createToolState } from '../../src/core/state/toolState.js';

// Claves "volátiles" (p. ej. la contraseña de un Wi-Fi): se usan, pero no se guardan ni se comparten.
describe('toolState: claves volátiles', () => {
  const tool = { id: 'demo', defaults: { ssid: '', password: '' }, paramsVersion: 1, volatileKeys: ['password'] };

  it('shareParams omite las claves volátiles, params las conserva', () => {
    const state = createToolState(tool);
    state.set('ssid', 'Casa');
    state.set('password', 'secreto');
    expect(state.params.password).toBe('secreto');
    expect(state.shareParams).toEqual({ ssid: 'Casa' });
  });

  it('sin volatileKeys, shareParams es igual a params', () => {
    const state = createToolState({ ...tool, volatileKeys: undefined });
    state.set('password', 'x');
    expect(state.shareParams).toEqual({ ssid: '', password: 'x' });
  });
});
