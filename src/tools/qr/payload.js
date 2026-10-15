// Contenido del QR a partir de los params: texto/enlace, Wi-Fi (formato WIFI:) o contacto (vCard 3.0).
// Funciones puras, sin DOM.

/** Escapa los caracteres especiales del formato WIFI:  \ ; , : " */
export const escapeWifi = (s) => s.replace(/([\\;,:"])/g, '\\$1');

/** Escapa un valor de vCard: \ ; , y saltos de línea. */
export const escapeVcard = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const looksLikeDomain = (s) => /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#]\S*)?$/i.test(s);

/**
 * @param {import('./params.js').defaults} p
 * @returns {{ data: string, title: string }} `data` es lo que se codifica ('' = falta contenido);
 *   `title` es un nombre seguro para el archivo (nunca incluye contraseñas).
 */
export function buildPayload(p) {
  if (p.contentType === 'wifi') {
    const ssid = p.wifiSsid.trim();
    if (!ssid) return { data: '', title: 'wifi' };
    let data = `WIFI:T:${p.wifiSecurity};S:${escapeWifi(ssid)};`;
    if (p.wifiSecurity !== 'nopass' && p.wifiPassword) data += `P:${escapeWifi(p.wifiPassword)};`;
    if (p.wifiHidden) data += 'H:true;';
    return { data: data + ';', title: `wifi ${ssid}` };
  }
  if (p.contentType === 'contact') {
    const name = p.contactName.trim();
    const phone = p.contactPhone.trim();
    const email = p.contactEmail.trim();
    const org = p.contactOrg.trim();
    if (!name && !phone && !email) return { data: '', title: 'contacto' };
    const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    if (name) {
      const parts = name.split(/\s+/);
      const last = parts.length > 1 ? parts.pop() : '';
      lines.push(`N:${escapeVcard(last)};${escapeVcard(parts.join(' '))};;;`, `FN:${escapeVcard(name)}`);
    } else lines.push('FN:');
    if (org) lines.push(`ORG:${escapeVcard(org)}`);
    if (phone) lines.push(`TEL:${escapeVcard(phone)}`);
    if (email) lines.push(`EMAIL:${escapeVcard(email)}`);
    lines.push('END:VCARD');
    return { data: lines.join('\n'), title: `contacto ${name || phone || email}` };
  }
  const text = p.text.trim();
  if (!text) return { data: '', title: 'qr' };
  const data = !/^[a-z][a-z0-9+.-]*:/i.test(text) && looksLikeDomain(text) ? `https://${text}` : text;
  return { data, title: text.replace(/^https?:\/\//i, '').replace(/^www\./i, '') };
}
