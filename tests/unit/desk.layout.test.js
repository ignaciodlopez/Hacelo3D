import { describe, it, expect } from 'vitest';
import { defaults, normalizeParams } from '../../src/tools/desk/params.js';
import { layoutDesk, standProfile, BRACE, ARCH_TOP } from '../../src/tools/desk/layout.js';

const norm = (over = {}) => normalizeParams({ ...defaults, ...over });
const lay = (over = {}) => layoutDesk(norm(over));
const rad = (deg) => (deg * Math.PI) / 180;

describe('organizador de escritorio: acomodo', () => {
  it('por defecto: lapicero a la izquierda y soporte a la derecha, con las medidas del modelo de referencia', () => {
    const l = lay();
    expect(l.ok).toBe(true);
    expect(l.messages).toEqual([]);
    // 6,5 × 3,25 pulgadas de base; la taza ocupa 3 pulgadas y el soporte, 3,5
    expect(l.width).toBeCloseTo(165.1, 9);
    expect(l.depth).toBeCloseTo(82.55, 9);
    expect(l.cup.x0).toBeCloseTo(-82.55, 9);
    expect(l.cup.x1).toBeCloseTo(l.stand.x0, 9);
    expect(l.stand.x1).toBeCloseTo(82.55, 9);
    expect(l.cup.y1 - l.cup.y0).toBeCloseTo(82.55, 9);
    expect(l.height).toBeCloseTo(81.28, 9);
  });

  it('con el celular del lado izquierdo el orden se invierte', () => {
    const l = lay({ phoneSide: 'left' });
    expect(l.stand.x0).toBeCloseTo(-l.width / 2, 9);
    expect(l.stand.x1).toBeCloseTo(l.cup.x0, 9);
    expect(l.cup.x1).toBeCloseTo(l.width / 2, 9);
  });

  it('el ancho total es la suma de los dos módulos, y un módulo apagado no ocupa lugar', () => {
    const both = lay({ cupWidthMm: 70, phoneWidthMm: 100 });
    expect(both.width).toBeCloseTo(170, 9);
    const penOnly = lay({ phone: false, cupWidthMm: 70 });
    expect(penOnly.width).toBeCloseTo(70, 9);
    expect(penOnly.stand).toBeNull();
    expect(penOnly.depth).toBeCloseTo(defaults.cupDepthMm, 9);
    const phoneOnly = lay({ pens: false, phoneWidthMm: 100 });
    expect(phoneOnly.width).toBeCloseTo(100, 9);
    expect(phoneOnly.cup).toBeNull();
  });

  it('el soporte queda centrado en el fondo y la base crece si él necesita más que la taza', () => {
    const l = lay();
    expect(l.stand.shiftY + l.stand.depth / 2).toBeCloseTo(0, 9);
    const tall = lay({ cupDepthMm: 50, phoneHeightMm: 140, phoneAngleDeg: 30 });
    expect(tall.depth).toBeGreaterThan(50);
    // adelante y atrás queda al menos una esquina redondeada de aire
    expect(tall.depth).toBeCloseTo(tall.stand.depth + 2 * defaults.cornerRadiusMm, 9);
    // la taza acompaña el fondo de la base
    expect(tall.cup.y1 - tall.cup.y0).toBeCloseTo(tall.depth, 9);
  });

  it('todo apagado: error claro', () => {
    const l = lay({ pens: false, phone: false });
    expect(l.ok).toBe(false);
    expect(l.messages.map((m) => m.code)).toContain('desk.empty');
  });

  it('las divisiones se limitan para que cada compartimiento entre un lápiz', () => {
    expect(lay({ cupDividers: 2 }).cup.dividers).toBe(2);
    expect(lay({ cupDividers: 2 }).messages).toEqual([]);
    const l = lay({ cupWidthMm: 40, cupDividers: 3 });
    expect(l.cup.dividers).toBeLessThan(3);
    expect(l.messages.map((m) => m.code)).toContain('desk.dividersLimited');
  });
});

describe('organizador de escritorio: perfil del soporte', () => {
  const s = standProfile(norm());

  it('la placa se inclina el ángulo pedido y tiene el espesor de la pared', () => {
    const [foot, top, topBack] = s.outer;
    const rise = defaults.phoneHeightMm - defaults.baseMm;
    expect(Math.atan((top[0] - s.yF) / rise)).toBeCloseTo(rad(defaults.phoneAngleDeg), 6);
    expect(top[1]).toBeCloseTo(defaults.phoneHeightMm, 9);
    // el espesor medido en perpendicular a la placa es el de la pared
    expect((topBack[0] - top[0]) * Math.cos(rad(defaults.phoneAngleDeg))).toBeCloseTo(defaults.wallMm, 9);
    expect(foot[1]).toBeLessThan(defaults.baseMm);
  });

  it('la ranura mide lo pedido en perpendicular a la placa, entre el labio y la placa', () => {
    const a = rad(defaults.phoneAngleDeg);
    // distancia entre la cara de atrás del labio (vertical) y la de adelante de la placa, al nivel de la base
    expect((s.yF - s.lipW) * Math.cos(a)).toBeCloseTo(defaults.phoneSlotMm, 9);
    expect(s.lipW).toBeCloseTo(defaults.wallMm, 9);
  });

  it('el respaldo vertical se une a la placa a BRACE de su altura', () => {
    const [, , , join] = s.outer;
    const rise = defaults.phoneHeightMm - defaults.baseMm;
    expect(join[1]).toBeCloseTo(defaults.baseMm + BRACE * rise, 9);
    expect(join[0]).toBeCloseTo(s.yW, 9);
  });

  it('el túnel va entre la placa y el respaldo, y termina en un techo a 45° (sin puentes)', () => {
    expect(s.cavity).not.toBeNull();
    const [, , right, apex, left] = s.cavity;
    // el ancho arriba es ARCH_TOP y el techo sube 45° hasta la punta
    expect(right[0] - left[0]).toBeCloseTo(ARCH_TOP, 9);
    expect(apex[1] - right[1]).toBeCloseTo(ARCH_TOP / 2, 9);
    expect(right[0] - apex[0]).toBeCloseTo(ARCH_TOP / 2, 9);
    // queda por debajo de donde el respaldo se une a la placa
    expect(apex[1]).toBeLessThan(s.outer[3][1]);
    // la pared de adelante del túnel es la cara de atrás de la placa (paralela, a un espesor de la de adelante)
    expect(s.cavity[0][0]).toBeGreaterThan(s.yF);
  });

  it('con poca inclinación no hay lugar para el túnel, y con 0° la placa es vertical', () => {
    expect(standProfile(norm({ phoneAngleDeg: 3 })).cavity).toBeNull();
    const flat = standProfile(norm({ phoneAngleDeg: 0 }));
    expect(flat.cavity).toBeNull();
    expect(flat.outer[1][0]).toBeCloseTo(flat.yF, 9);
  });

  it('el labio llega a su altura y termina en medio círculo', () => {
    const top = Math.max(...s.lip.map((pt) => pt[1]));
    expect(top).toBeCloseTo(defaults.baseMm + defaults.phoneLipMm, 9);
    expect(Math.min(...s.lip.map((pt) => pt[0]))).toBeCloseTo(0, 9);
    expect(Math.max(...s.lip.map((pt) => pt[0]))).toBeCloseTo(s.lipW, 9);
  });

  it('el fondo del soporte es lo que ocupa de frente del labio al borde de atrás de la placa', () => {
    expect(s.depth).toBeCloseTo(Math.max(s.outer[2][0], s.yW), 9);
    // con el modelo de referencia: unos 44 mm
    expect(s.depth).toBeGreaterThan(43);
    expect(s.depth).toBeLessThan(46);
  });
});

describe('organizador de escritorio: parámetros', () => {
  it('normalizar nunca falla y respeta los límites', () => {
    for (const raw of [null, undefined, 'x', 5, {}, { cupWidthMm: 'x', phoneAngleDeg: 999, phoneSide: 'zzz', wallMm: -1, colors: 7, cupDividers: 99 }]) {
      const p = normalizeParams(raw);
      expect(p.phoneAngleDeg).toBeLessThanOrEqual(30);
      expect(p.wallMm).toBeGreaterThanOrEqual(1.6);
      expect(p.cupDividers).toBeLessThanOrEqual(3);
      expect(p.edgeRadiusMm).toBeLessThanOrEqual(4);
      expect(['left', 'right']).toContain(p.phoneSide);
      expect(p.colors.base).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
