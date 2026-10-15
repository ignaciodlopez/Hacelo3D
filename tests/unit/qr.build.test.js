import { describe, it, expect, beforeAll } from 'vitest';
import jsQR from 'jsqr';
import { initKernel, fontStore } from './helpers.js';
import { build } from '../../src/tools/qr/build.js';
import { defaults, normalizeParams, stripVolatile } from '../../src/tools/qr/params.js';
import { buildPayload, escapeWifi } from '../../src/tools/qr/payload.js';

let K;
const ctx = () => ({ getFont: (id) => fontStore.get(id), printer: {} });
beforeAll(async () => {
  K = await initKernel();
});

const run = (over = {}) => build(K, { ...defaults, ...over }, ctx());

/**
 * Lee el QR de la geometría generada: rasteriza la huella (XY) de la parte "código" sobre fondo claro
 * y la decodifica con jsQR. Prueba de punta a punta que la pieza se puede escanear.
 */
function scan(result, p) {
  const item = result.items[0];
  const code = item.parts.find((x) => x.colorKey === 'code');
  const S = p.sizeMm;
  const q = Math.max(p.marginMm, 4); // zona de silencio alrededor del cuadrado del código
  const ppm = 8 / item.moduleMm; // ~8 px por módulo
  const x0 = -S / 2 - q;
  const W = Math.ceil((S + 2 * q) * ppm);
  const Hh = W;
  const img = new Uint8ClampedArray(W * Hh * 4).fill(255);
  const { positions: P, indices: I } = code;
  for (let t = 0; t < I.length; t += 3) {
    const v = [0, 1, 2].map((k) => [(P[I[t + k] * 3] - x0) * ppm, (S + q - P[I[t + k] * 3 + 1]) * ppm]);
    const minX = Math.max(0, Math.floor(Math.min(v[0][0], v[1][0], v[2][0])));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(v[0][0], v[1][0], v[2][0])));
    const minY = Math.max(0, Math.floor(Math.min(v[0][1], v[1][1], v[2][1])));
    const maxY = Math.min(Hh - 1, Math.ceil(Math.max(v[0][1], v[1][1], v[2][1])));
    const [a, b, c] = v;
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) < 1e-9) continue;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den;
        const l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den;
        if (l1 >= 0 && l2 >= 0 && 1 - l1 - l2 >= 0) {
          const o = (y * W + x) * 4;
          img[o] = img[o + 1] = img[o + 2] = 0;
        }
      }
    }
  }
  return jsQR(img, W, Hh, { inversionAttempts: 'dontInvert' });
}

function check(r, label) {
  expect(r.items.length, label).toBe(1);
  const it = r.items[0];
  expect(r.messages.filter((m) => m.level === 'error'), label).toEqual([]);
  expect(it.merged.status, label).toBe('NoError');
  for (const part of it.parts) {
    expect(part.status, label).toBe('NoError');
    expect(part.volumeMm3, label).toBeGreaterThan(0);
  }
  const sum = it.parts.reduce((s, x) => s + x.volumeMm3, 0);
  expect(Math.abs(sum - it.merged.volumeMm3) / it.merged.volumeMm3, label).toBeLessThan(0.002);
  return it;
}

describe('qr: contenido', () => {
  it('Wi-Fi: escapa \\ ; , : " y respeta seguridad y red oculta', () => {
    expect(escapeWifi('a;b,c:d"e\\f')).toBe('a\\;b\\,c\\:d\\"e\\\\f');
    const p = { ...defaults, contentType: 'wifi', wifiSsid: 'Casa;1', wifiPassword: 'p:w"d', wifiHidden: true };
    expect(buildPayload(p).data).toBe('WIFI:T:WPA;S:Casa\\;1;P:p\\:w\\"d;H:true;;');
    expect(buildPayload({ ...p, wifiSecurity: 'nopass' }).data).toBe('WIFI:T:nopass;S:Casa\\;1;H:true;;');
  });

  it('el título del archivo nunca incluye la contraseña', () => {
    const { title } = buildPayload({ ...defaults, contentType: 'wifi', wifiSsid: 'Casa', wifiPassword: 'secreto123' });
    expect(title).toBe('wifi Casa');
  });

  it('contacto: vCard 3.0 con escapes', () => {
    const { data } = buildPayload({ ...defaults, contentType: 'contact', contactName: 'María José Pérez', contactPhone: '+54 11 5555-1234', contactEmail: 'm@x.com', contactOrg: 'Ana, Pérez; SA' });
    expect(data.split('\n')).toEqual(['BEGIN:VCARD', 'VERSION:3.0', 'N:Pérez;María José;;;', 'FN:María José Pérez', 'ORG:Ana\\, Pérez\\; SA', 'TEL:+54 11 5555-1234', 'EMAIL:m@x.com', 'END:VCARD']);
  });

  it('enlace sin esquema: se agrega https://; con esquema o texto libre no se toca', () => {
    expect(buildPayload({ ...defaults, text: 'hacelo3d.com/qr' }).data).toBe('https://hacelo3d.com/qr');
    expect(buildPayload({ ...defaults, text: 'mailto:a@b.com' }).data).toBe('mailto:a@b.com');
    expect(buildPayload({ ...defaults, text: 'Hola, mundo' }).data).toBe('Hola, mundo');
  });

  it('contenido vacío → data vacío', () => {
    expect(buildPayload({ ...defaults, text: '  ' }).data).toBe('');
    expect(buildPayload({ ...defaults, contentType: 'wifi' }).data).toBe('');
    expect(buildPayload({ ...defaults, contentType: 'contact' }).data).toBe('');
  });
});

describe('qr: geometría y lectura real', () => {
  it('enlace por defecto: base + código, y el código se decodifica', async () => {
    const r = await run();
    const it = check(r, 'default');
    expect(it.parts.map((x) => x.colorKey).sort()).toEqual(['base', 'code']);
    expect(scan(r, defaults)?.data).toBe('https://hacelo3d.com');
  });

  it('Wi-Fi con caracteres especiales se decodifica igual al payload', async () => {
    const over = { contentType: 'wifi', wifiSsid: 'Casa;Nacho', wifiPassword: 'cl@ve:"x,y"', sizeMm: 50 };
    const r = await run(over);
    check(r, 'wifi');
    expect(scan(r, { ...defaults, ...over })?.data).toBe(buildPayload({ ...defaults, ...over }).data);
  });

  it('contacto y UTF-8 (ñ, tildes, emoji) se decodifican', async () => {
    const c = { contentType: 'contact', contactName: 'Ñandú Pérez', contactPhone: '1155551234', sizeMm: 60 };
    const rc = await run(c);
    check(rc, 'contact');
    expect(scan(rc, { ...defaults, ...c })?.data).toBe(buildPayload({ ...defaults, ...c }).data);
    const u = { text: 'Ñandú 😀 ¿qué tal?', sizeMm: 50 };
    const ru = await run(u);
    check(ru, 'utf8');
    expect(scan(ru, { ...defaults, ...u })?.data).toBe('Ñandú 😀 ¿qué tal?');
  });

  it('al ras, con texto debajo y argolla arriba: sigue siendo válido y legible', async () => {
    const over = { style: 'flush', label: 'Wi-Fi Casa', ring: 'top', sizeMm: 45 };
    const r = await run(over);
    const it = check(r, 'flush+label+ring');
    expect(it.merged.genus).toBe(1); // el agujero de la argolla
    expect(it.sizeMm[2]).toBeLessThan(2.7); // al ras: no sobresale
    expect(scan(r, { ...defaults, ...over })?.data).toBe('https://hacelo3d.com');
  });

  it('argolla a la izquierda y esquinas cuadradas', async () => {
    check(await run({ ring: 'left', cornerRadiusMm: 0 }), 'left');
  });

  it('el relieve suma altura y los módulos miden tamaño/cantidad', async () => {
    const r = await run({ sizeMm: 40, reliefMm: 1 });
    const it = r.items[0];
    expect(it.sizeMm[2]).toBeGreaterThan(3.2);
    expect(it.moduleMm * it.modules).toBeCloseTo(40, 6);
  });
});

describe('qr: avisos y errores', () => {
  it('contenido vacío → error qr.empty, sin geometría', async () => {
    const r = await run({ text: '' });
    expect(r.items).toEqual([]);
    expect(r.messages.some((m) => m.code === 'qr.empty')).toBe(true);
  });

  it('módulos chicos y poco contraste avisan', async () => {
    const r = await run({ text: 'x'.repeat(250), ecc: 'H', sizeMm: 20, colors: { base: '#888888', code: '#999999' } });
    const codes = r.messages.map((m) => m.code);
    expect(codes).toContain('qr.smallModules');
    expect(codes).toContain('qr.lowContrast');
  });

  it('borde menor a 2 módulos avisa; con borde suficiente no', async () => {
    expect((await run({ marginMm: 1 })).messages.map((m) => m.code)).toContain('qr.smallQuiet');
    expect((await run({ marginMm: 4 })).messages.map((m) => m.code)).not.toContain('qr.smallQuiet');
  });

  it('claro sobre oscuro informa (no es error)', async () => {
    const r = await run({ colors: { base: '#111111', code: '#ffffff' } });
    expect(r.messages.find((m) => m.code === 'qr.inverted')?.level).toBe('info');
  });
});

describe('qr: parámetros', () => {
  it('normalizeParams nunca lanza y clampea', () => {
    expect(() => normalizeParams(null)).not.toThrow();
    const p = normalizeParams({ sizeMm: 9999, contentType: 'x', ecc: 'Z', ring: 'nope', text: 'a'.repeat(999), colors: { base: 'zz' } });
    expect(p.sizeMm).toBe(150);
    expect(p.contentType).toBe('text');
    expect(p.ecc).toBe('M');
    expect(p.ring).toBe('none');
    expect(p.text.length).toBe(300);
    expect(p.colors.base).toBe(defaults.colors.base);
  });

  it('stripVolatile quita la contraseña', () => {
    const out = stripVolatile({ ...defaults, wifiPassword: 'secreto' });
    expect('wifiPassword' in out).toBe(false);
    expect(out.wifiSsid).toBe('');
  });
});

describe('qr: imanes en la cara de atrás', () => {
  const baseVol = (r) => r.items[0].parts.find((x) => x.colorKey === 'base').volumeMm3;

  it('1, 2 y 4 huecos restan el volumen de los cilindros (Ø10 × 2,2 mm)', async () => {
    const none = await run({ sizeMm: 50, baseThicknessMm: 4 }); // base gruesa: no se ajusta el grosor
    const pocket = Math.PI * 5.1 ** 2 * 2.2; // Ø10 + 0,2 de holgura; 2 + 0,2 de profundidad
    for (const n of [1, 2, 4]) {
      const r = await run({ sizeMm: 50, baseThicknessMm: 4, magnets: n });
      const it = check(r, `magnets ${n}`);
      expect(it.merged.genus).toBe(0); // son huecos ciegos: no atraviesan
      expect(r.messages.some((m) => m.code === 'magnet.noRoom')).toBe(false);
      const removed = baseVol(none) - baseVol(r);
      // la profundidad se ajusta a la capa (±0,2 mm): tolerancia del 12 %
      expect(Math.abs(removed - n * pocket) / (n * pocket), `n=${n}`).toBeLessThan(0.12);
    }
  });

  it('el frente queda intacto: el código no pierde volumen por los imanes', async () => {
    const a = await run({ sizeMm: 50, baseThicknessMm: 4 });
    const b = await run({ sizeMm: 50, baseThicknessMm: 4, magnets: 2 });
    const codeVol = (r) => r.items[0].parts.find((x) => x.colorKey === 'code').volumeMm3;
    expect(codeVol(b)).toBeCloseTo(codeVol(a), 3);
  });

  it('base fina: sube el grosor para dejar tapa y avisa (info)', async () => {
    const r = await run({ sizeMm: 50, magnets: 1, baseThicknessMm: 1.2 });
    const it = check(r, 'thin');
    expect(r.messages.find((m) => m.code === 'magnet.thickened')?.level).toBe('info');
    // hueco 2,2 + tapa 0,8 = 3 mm de base + 0,8 de relieve del código
    expect(it.sizeMm[2]).toBeGreaterThanOrEqual(3.6);
  });

  it('al ras + imanes: base alcanza para el hueco del código y el del imán', async () => {
    const r = await run({ sizeMm: 50, magnets: 2, style: 'flush', baseThicknessMm: 2 });
    const it = check(r, 'flush+magnets');
    expect(it.sizeMm[2]).toBeGreaterThanOrEqual(3.8); // 2,2 + 0,8 + 0,8 de profundidad del código
  });

  it('placa muy chica: omite los que no entran y avisa', async () => {
    const r = await run({ sizeMm: 15, marginMm: 1, magnets: 4, magnetDiameterMm: 12 });
    expect(r.messages.find((m) => m.code === 'magnet.noRoom')?.params.n).toBe(4);
    expect(r.items.length).toBe(1);
  });

  it('con argolla y texto debajo sigue siendo válido', async () => {
    check(await run({ sizeMm: 45, label: 'Wi-Fi', ring: 'top', magnets: 2, magnetDiameterMm: 8 }), 'all');
  });

  it('normalizeParams: cantidad inválida vuelve a 0', () => {
    expect(normalizeParams({ magnets: 3 }).magnets).toBe(0);
    expect(normalizeParams({ magnets: '2' }).magnets).toBe(2);
    expect(normalizeParams({ magnetDiameterMm: 999 }).magnetDiameterMm).toBe(30);
  });
});
