/**
 * Activa el "modo taller" (menú de archivos, datos técnicos, perfil de impresora) antes de cargar la página.
 * Hay que llamarlo DESPUÉS del `localStorage.clear()` del beforeEach: los scripts de inicio corren en orden.
 */
export function workshop(page) {
  return page.addInitScript(() => localStorage.setItem('b3d.workshop', '1'));
}

/**
 * Baja un archivo desde el menú "Archivos".
 * @param {'STL'|'ZIP'|'3MF'} kind
 */
export async function download(page, kind) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Archivos/ }).click();
  await page.getByRole('menuitem', { name: new RegExp(kind) }).click();
  return pending;
}
