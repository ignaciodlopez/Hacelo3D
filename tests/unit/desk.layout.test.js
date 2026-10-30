import { describe, it, expect } from 'vitest';
import { defaults, normalizeParams } from '../../src/tools/desk/params.js';
import { layoutDesk, penCell, spacing } from '../../src/tools/desk/layout.js';

const lay = (over = {}) => layoutDesk(normalizeParams({ ...defaults, ...over }));
const kinds = (l) => l.zones.map((z) => z.kind);

describe('organizador de escritorio: acomodo en planta', () => {
  it('por defecto: celular, lapicero y notas, de izquierda a derecha', () => {
    const l = lay();
    expect(l.ok).toBe(true);
    expect(kinds(l)).toEqual(['phone', 'pens', 'notes']);
  });

  it('con el celular del lado derecho el orden se invierte', () => {
    expect(kinds(lay({ phoneSide: 'right' }))).toEqual(['notes', 'pens', 'phone']);
    expect(kinds(lay({ phoneSide: 'right', cards: true }))).toEqual(['cards', 'notes', 'pens', 'phone']);
  });

  it('entre módulos vecinos quedan sus dos paredes y la ranura, y el ancho total es la suma más lo que separa', () => {
    const l = lay({ cards: true, wallMm: 3, podGapMm: 4 });
    expect(spacing({ wallMm: 3, podGapMm: 4 })).toBe(10);
    for (let i = 1; i < l.zones.length; i++) expect(l.zones[i].x0 - l.zones[i - 1].x1).toBeCloseTo(10, 9);
    expect(l.zones[0].x0 - -l.width / 2).toBeCloseTo(3, 9);
    expect(l.width / 2 - l.zones.at(-1).x1).toBeCloseTo(3, 9);
    expect(l.width).toBeCloseTo(l.zones.reduce((s, z) => s + z.w, 0) + (l.zones.length - 1) * 10 + 6, 9);
  });

  it('sin ranura (0) los módulos comparten una sola pared', () => {
    const l = lay({ cards: true, wallMm: 3, podGapMm: 0 });
    for (let i = 1; i < l.zones.length; i++) expect(l.zones[i].x0 - l.zones[i - 1].x1).toBeCloseTo(3, 9);
    expect(l.width).toBeCloseTo(l.zones.reduce((s, z) => s + z.w, 0) + (l.zones.length + 1) * 3, 9);
  });

  it('el fondo principal es el de la zona más honda y todas quedan dentro de él', () => {
    const l = lay();
    expect(l.mainDepth).toBeCloseTo(Math.max(...l.zones.map((z) => z.d)), 9);
    for (const z of l.zones) {
      expect(z.y0).toBeGreaterThanOrEqual(l.mainY0 - 1e-9);
      expect(z.y1).toBeLessThanOrEqual(l.mainY1 + 1e-9);
    }
    // las ranuras inclinadas van pegadas atrás; el resto, centrado
    const phone = l.zones.find((z) => z.kind === 'phone');
    expect(phone.y1).toBeCloseTo(l.mainY1, 9);
    const pens = l.zones.find((z) => z.kind === 'pens');
    expect(pens.y0 - l.mainY0).toBeCloseTo(l.mainY1 - pens.y1, 9);
    expect(l.depth).toBeCloseTo(l.mainDepth + 2 * defaults.wallMm, 9);
  });

  it('con bandeja: queda adelante, separada de la fila principal como los demás módulos', () => {
    for (const podGapMm of [0, 4]) {
      const l = lay({ tray: true, trayDepthMm: 30, podGapMm });
      const sp = spacing({ wallMm: defaults.wallMm, podGapMm });
      expect(l.tray.y1 - l.tray.y0).toBeCloseTo(30, 9);
      expect(l.mainY0 - l.tray.y1).toBeCloseTo(sp, 9);
      expect(l.depth).toBeCloseTo(l.mainDepth + 2 * defaults.wallMm + 30 + sp, 9);
    }
  });

  it('todo apagado: error claro', () => {
    const l = lay({ pens: false, phone: false, notes: 'none', cards: false });
    expect(l.ok).toBe(false);
    expect(l.messages.map((m) => m.code)).toContain('desk.empty');
  });

  it('hexagonal: el ancho de la celda es la medida entre caras por 2/√3, y el fondo, la medida entre caras', () => {
    const c = penCell(normalizeParams({ ...defaults, penShape: 'hex', penCellMm: 30 }));
    expect(c.w).toBeCloseTo((30 * 2) / Math.sqrt(3), 9);
    expect(c.d).toBe(30);
    expect(penCell(normalizeParams({ ...defaults, penShape: 'square', penCellMm: 25 }))).toEqual({ w: 25, d: 25 });
  });

  it('notas: tamaños de Post-it con el juego por lado; a medida usa sus medidas', () => {
    const z = lay({ notes: '51x76', notesClearanceMm: 2 }).zones.find((x) => x.kind === 'notes');
    expect(z.w).toBeCloseTo(55, 9);
    expect(z.d).toBeCloseTo(80, 9);
    const c = lay({ notes: 'custom', notesWidthMm: 60, notesDepthMm: 100, notesClearanceMm: 1 }).zones.find((x) => x.kind === 'notes');
    expect([c.w, c.d]).toEqual([62, 102]);
  });

  it('avisa cuando el respaldo del celular supera mucho al lapicero', () => {
    expect(lay({ phoneBackMm: 120, penHeightMm: 60 }).messages.map((m) => m.code)).toContain('desk.phoneTaller');
    expect(lay().messages).toEqual([]);
  });

  it('normalizar nunca falla y respeta los límites', () => {
    for (const raw of [null, undefined, 'x', 5, {}, { penCols: 'x', phoneAngleDeg: 999, notes: 'zzz', wallMm: -1, colors: 7 }]) {
      const p = normalizeParams(raw);
      expect(p.phoneAngleDeg).toBeLessThanOrEqual(30);
      expect(p.wallMm).toBeGreaterThanOrEqual(1.6);
      expect(p.podGapMm).toBeLessThanOrEqual(10);
      expect(p.edgeRadiusMm).toBeLessThanOrEqual(4);
      expect(['none', '76x76', '51x76', '38x51', 'custom']).toContain(p.notes);
      expect(p.colors.base).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
