// Menú desplegable "Archivos" (STL / ZIP / 3MF) del modo taller. Está en su propio módulo para que la compilación pública
// (npm run build:public) lo deje afuera junto con todo el código de exportación.

import { h } from '../core/ui/dom.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { exportStl, exportZipPerColor, export3mf } from '../core/export/exports.js';

/**
 * @param {{ run: (exporter: Function) => void }} o  `run` baja el archivo que arma el exportador
 * @returns {{ el: HTMLElement, button: HTMLButtonElement, setMulti: (multi: boolean) => void, close: () => void }}
 */
export function createFilesMenu({ run }) {
  let open = false;
  const item = (key, exporter) =>
    h(
      'button',
      { class: 'menu-item', role: 'menuitem', type: 'button', onclick: () => (close(), run(exporter)) },
      h('strong', {}, t(`files.${key}`)),
      h('small', {}, t(`files.${key}.desc`)),
    );
  const stl = item('stl', exportStl);
  const zip = item('zip', exportZipPerColor);
  const mf = item('3mf', export3mf);
  const menu = h('div', { class: 'menu', role: 'menu', 'aria-label': t('files.button'), hidden: true }, stl, zip, mf);
  const button = h('button', { class: 'btn files', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => (open ? close() : show()) }, icon('download', 18), t('files.button'), icon('caret', 16));
  const el = h('div', { class: 'menu-wrap' }, button, menu);

  const items = () => [...menu.querySelectorAll('.menu-item:not([hidden])')];
  const onOutside = (e) => {
    if (!el.contains(e.target)) close();
  };
  function show() {
    open = true;
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);
    items()[0]?.focus();
  }
  function close(refocus = false) {
    if (!open) return;
    open = false;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside);
    if (refocus) button.focus();
  }
  menu.addEventListener('keydown', (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
    } else if (e.key === 'Tab') close();
  });

  return {
    el,
    button,
    /** ZIP y 3MF solo valen con más de un color (o varias piezas): con uno solo no aportan nada. */
    setMulti(multi) {
      zip.hidden = mf.hidden = !multi;
    },
    close,
  };
}
