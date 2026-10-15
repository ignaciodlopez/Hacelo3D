import { h } from '../core/ui/dom.js';
import { t } from './i18n.js';
import { loadCatalog } from '../core/fonts/catalog.js';

export function mountCredits(container) {
  const list = h('ul', { class: 'credits-list' });
  loadCatalog().then((fonts) => {
    for (const f of fonts.filter((x) => !x.buffer)) list.append(h('li', {}, `${f.name} — ${f.license ?? 'OFL-1.1'}`));
  });
  container.replaceChildren(
    h('div', { class: 'home' }, h('a', { class: 'back', href: '#/' }, '← ' + t('app.back')), h('h1', {}, t('credits.title')), h('p', { class: 'sub' }, t('credits.body')), h('h2', {}, t('credits.fonts')), list),
  );
  return { dispose() {} };
}
