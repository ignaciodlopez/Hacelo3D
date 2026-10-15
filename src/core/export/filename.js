/** Nombre de archivo seguro: sin acentos, espacios → '-', solo [a-z0-9-_], máx 40. */
export function safeName(text, fallback = 'llavero') {
  const s = String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 40);
  return s || fallback;
}
