// Mensaje de pedido por WhatsApp. FUNCIONES PURAS (sin DOM): reciben `t` (traductor) para poder testearlas.

/**
 * @param {{
 *   t: (key:string, params?:any)=>string,
 *   productName: string,
 *   summary?: [string, string][],   // pares [etiqueta, valor]; los valores vacíos se omiten
 *   sizeText?: string,
 *   link: string,
 *   shopName?: string,
 *   customer?: string,
 *   qty?: number,
 *   notes?: string,
 * }} o
 */
export function buildOrderMessage(o) {
  const { t } = o;
  const lines = [];
  lines.push(o.shopName ? t('order.msg.hiShop', { shop: o.shopName }) : t('order.msg.hi'));
  lines.push(`*${t('order.msg.want')}* ${o.productName}`);
  if ((o.qty ?? 1) > 1) lines.push(`${t('order.msg.qty')}: ${o.qty}`);
  for (const [label, value] of o.summary ?? []) if (value) lines.push(`- ${label}: ${value}`);
  if (o.sizeText) lines.push(`${t('order.msg.size')}: ${o.sizeText}`);
  lines.push('', `${t('order.msg.design')}:`, o.link);
  if (o.notes?.trim()) lines.push('', `${t('order.msg.notes')}: ${o.notes.trim()}`);
  const who = o.customer?.trim();
  lines.push('', who ? t('order.msg.thanksName', { name: who }) : t('order.msg.thanks'));
  return lines.join('\n');
}

/** Enlace que abre WhatsApp con el texto escrito. Sin número, WhatsApp deja elegir el contacto. */
export function whatsappUrl(number, text) {
  return `https://wa.me/${number || ''}?text=${encodeURIComponent(text)}`;
}

/** "55 × 31 × 4 mm" (una cifra decimal como mucho, con coma en español). */
export function formatDims(sizeMm, lang = 'es') {
  const f = (n) => {
    const s = String(Math.round(n * 10) / 10);
    return lang === 'es' ? s.replace('.', ',') : s;
  };
  return `${sizeMm.map(f).join(' × ')} mm`;
}
