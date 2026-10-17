import { describe, it, expect } from 'vitest';
import { t } from '../../src/app/i18n.js';
import { normalizeShopConfig } from '../../src/app/shopConfig.js';
import { colorName } from '../../src/app/colorNames.js';
import { buildOrderMessage, whatsappUrl, formatDims } from '../../src/app/orderMessage.js';
import { tools } from '../../src/tools/registry.js';
import tag from '../../src/tools/tag/index.js';
import keychain from '../../src/tools/keychain/index.js';
import qr from '../../src/tools/qr/index.js';

const ctx = (lang = 'es') => ({ lang, color: (hex) => colorName(hex, lang), option: (_key, v) => String(v) });

describe('configuración de la tienda', () => {
  it('normaliza el número de WhatsApp', () => {
    const n = (whatsapp) => normalizeShopConfig({ whatsapp }).whatsapp;
    expect(n('5493416686947')).toBe('5493416686947');
    expect(n('+54 9 341 668-6947')).toBe('5493416686947');
    expect(n('0054 9 341 6686947')).toBe('5493416686947');
    expect(n('3416686947')).toBe('5493416686947'); // 10 dígitos: celular argentino sin código de país
    expect(n('(341) 668-6947')).toBe('5493416686947');
    expect(n('')).toBe('');
    expect(n('123')).toBe('');
    expect(n('abc')).toBe('');
    expect(n(null)).toBe('');
    expect(n('1'.repeat(20))).toBe('');
  });

  it('el botón se muestra salvo que se oculte, y nunca tira con datos raros', () => {
    expect(normalizeShopConfig({}).showOrderButton).toBe(true);
    expect(normalizeShopConfig({ showOrderButton: false }).showOrderButton).toBe(false);
    expect(normalizeShopConfig({ shopName: '  Mi Taller  ' }).shopName).toBe('Mi Taller');
    for (const raw of [null, undefined, 5, 'x', [], { shopName: 7, whatsapp: {} }]) expect(() => normalizeShopConfig(raw)).not.toThrow();
  });
});

describe('nombre de color', () => {
  it('da el nombre aproximado en español e inglés', () => {
    expect(colorName('#4fb3f0')).toBe('celeste');
    expect(colorName('#ffffff')).toBe('blanco');
    expect(colorName('#000000')).toBe('negro');
    expect(colorName('#ff0000')).toBe('rojo');
    expect(colorName('#4FB3F0', 'en')).toBe('light blue');
    expect(colorName('#fdd835', 'en')).toBe('yellow');
  });
  it('un color inválido da vacío', () => {
    for (const bad of [null, undefined, '', 'rojo', '#fff', '#gggggg', 5]) expect(colorName(bad)).toBe('');
  });
});

describe('mensaje de pedido', () => {
  const base = { t, productName: 'Chapita para mascota', summary: [['Nombre', 'Boster'], ['Teléfono', '3416686947'], ['Línea extra', '']], sizeText: '55 × 31 × 4 mm', link: 'https://x.test/#/tool/tag?p=~abc' };

  it('arma un mensaje claro con el resumen, la medida y el enlace', () => {
    const msg = buildOrderMessage({ ...base, shopName: 'Hacelo3D', customer: 'Ana', qty: 3, notes: 'Para el 15' });
    expect(msg).toContain('¡Hola, Hacelo3D!');
    expect(msg).toContain('*Quiero pedir:* Chapita para mascota');
    expect(msg).toContain('Cantidad: 3');
    expect(msg).toContain('- Nombre: Boster');
    expect(msg).toContain('- Teléfono: 3416686947');
    expect(msg).not.toContain('Línea extra'); // los valores vacíos se omiten
    expect(msg).toContain('Medida: 55 × 31 × 4 mm');
    expect(msg).toContain('https://x.test/#/tool/tag?p=~abc');
    expect(msg).toContain('Comentarios: Para el 15');
    expect(msg).toContain('¡Gracias! Soy Ana.');
  });

  it('con lo mínimo: sin cantidad, sin comentarios y sin nombre', () => {
    const msg = buildOrderMessage({ ...base, qty: 1, notes: '   ', customer: ' ' });
    expect(msg.startsWith('¡Hola!')).toBe(true);
    expect(msg).not.toContain('Cantidad');
    expect(msg).not.toContain('Comentarios');
    expect(msg.trim().endsWith('¡Gracias!')).toBe(true);
  });

  it('el enlace de WhatsApp codifica bien tildes, saltos de línea y emojis', () => {
    const text = buildOrderMessage({ ...base, customer: 'Ñandú 💛' });
    const url = whatsappUrl('5493416686947', text);
    expect(url.startsWith('https://wa.me/5493416686947?text=')).toBe(true);
    expect(url).not.toMatch(/\s/);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(text);
    // sin número, WhatsApp deja elegir a quién enviarlo
    expect(whatsappUrl('', 'hola').startsWith('https://wa.me/?text=')).toBe(true);
  });

  it('las medidas se formatean con coma en español y punto en inglés', () => {
    expect(formatDims([55, 31.04, 4], 'es')).toBe('55 × 31 × 4 mm');
    expect(formatDims([55.25, 31, 4], 'es')).toBe('55,3 × 31 × 4 mm');
    expect(formatDims([55.25, 31, 4], 'en')).toBe('55.3 × 31 × 4 mm');
  });
});

describe('resumen de cada herramienta', () => {
  it('la chapita lista nombre, teléfono, modelo y colores en palabras', () => {
    const rows = Object.fromEntries(tag.orderSummary({ ...tag.defaults, name: 'Rex', phone: '11 5555 1234' }, ctx()));
    expect(rows.Nombre).toBe('Rex');
    expect(rows['Teléfono']).toBe('11 5555 1234');
    expect(rows.Colores).toBe('celeste con letras blanco');
    const en = Object.fromEntries(tag.orderSummary(tag.defaults, ctx('en')));
    expect(en.Name).toBe('Boster');
    expect(en.Colors).toBe('light blue with white letters');
  });

  it('el llavero en lote lista todos los nombres', () => {
    const rows = Object.fromEntries(keychain.orderSummary({ ...keychain.defaults, mode: 'batch', batchText: 'Sofía\nMateo, Lucía' }, ctx()));
    expect(rows.Nombres).toBe('Sofía, Mateo, Lucía');
  });

  it('el QR no revela el contenido (puede ser una contraseña de Wi-Fi)', () => {
    const rows = qr.orderSummary({ ...qr.defaults, contentType: 'wifi', wifiSsid: 'MiRed', wifiPassword: 'secreto123', text: 'https://privado.test' }, ctx());
    const flat = JSON.stringify(rows);
    expect(flat).not.toContain('secreto123');
    expect(flat).not.toContain('MiRed');
    expect(flat).not.toContain('privado.test');
  });

  it('todas las herramientas activas devuelven pares [texto, texto] con sus valores por defecto', () => {
    for (const tool of tools.filter((x) => x.status === 'active')) {
      expect(typeof tool.orderSummary, tool.id).toBe('function');
      for (const lang of ['es', 'en']) {
        const rows = tool.orderSummary(tool.defaults, ctx(lang));
        expect(Array.isArray(rows), tool.id).toBe(true);
        expect(rows.length, tool.id).toBeGreaterThan(0);
        for (const row of rows) {
          expect(row.length, tool.id).toBe(2);
          expect(typeof row[0], tool.id).toBe('string');
          expect(typeof row[1], `${tool.id} ${row[0]}`).toBe('string');
        }
      }
    }
  });
});
