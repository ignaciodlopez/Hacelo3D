// Layout general: sidebar + contenedor de la vista actual. Re-monta la vista al cambiar de ruta o idioma.

import { h } from '../core/ui/dom.js';
import { icon } from './icons.js';
import { t, getLang, setLang, onLangChange } from './i18n.js';
import { toggleTheme, isDark } from './theme.js';
import { startRouter } from './router.js';
import { getTool, tools } from '../tools/registry.js';
import { mountHome } from './home.js';
import { mountCredits } from './credits.js';
import { mountToolPage } from './toolPage.js';
import { openPrinterDialog } from './printerDialog.js';

export function startApp(root) {
  const content = h('main', { class: 'content', id: 'content', tabindex: '-1' });
  const nav = h('nav', { class: 'sidebar', 'aria-label': t('app.tools') });
  const skip = h('a', { class: 'skip-link', href: '#content' }, t('app.skip'));
  skip.addEventListener('click', (e) => {
    e.preventDefault(); // el hash lo usa el router
    content.focus();
  });
  root.replaceChildren(skip, h('div', { class: 'app' }, nav, content));
  onLangChange(() => (skip.textContent = t('app.skip')));

  let current = null;
  let route = { name: 'home' };

  function renderNav() {
    const navBtn = (iconName, label, href, active, extra = '') =>
      h('a', { class: 'nav-btn' + (active ? ' active' : '') + (extra ? ' ' + extra : ''), href, title: label, 'aria-label': label, 'aria-current': active ? 'page' : null }, icon(iconName, 22));
    const iconBtn = (iconName, label, onclick) =>
      h('button', { class: 'nav-btn', type: 'button', title: label, 'aria-label': label, onclick }, icon(iconName, 22));
    nav.replaceChildren(
      h('a', { class: 'logo', href: '#/', 'aria-label': `3D · ${t('app.name')}` }, '3D'),
      h(
        'div',
        { class: 'nav-group' },
        navBtn('home', t('app.tools'), '#/', route.name === 'home', 'nav-home'),
        ...tools.filter((x) => x.status === 'active').map((x) => navBtn(x.icon, x.name[getLang()] ?? x.name.es, `#/tool/${x.id}`, route.name === 'tool' && route.id === x.id)),
      ),
      h(
        'div',
        { class: 'nav-group bottom' },
        iconBtn('printer', t('app.printer'), openPrinterDialog),
        iconBtn(isDark() ? 'sun' : 'moon', t('app.theme'), () => {
          toggleTheme();
          renderNav();
        }),
        h('button', { class: 'nav-btn lang', type: 'button', title: t('app.lang'), 'aria-label': `${t('app.lang')}: ${getLang().toUpperCase()}`, onclick: () => setLang(getLang() === 'es' ? 'en' : 'es') }, getLang().toUpperCase()),
        navBtn('info', t('app.credits'), '#/credits', route.name === 'credits'),
      ),
    );
  }

  function mount() {
    current?.dispose();
    current = null;
    renderNav();
    if (route.name === 'tool') {
      const tool = getTool(route.id);
      if (tool && tool.status === 'active') {
        current = mountToolPage(content, tool, route);
        return;
      }
      location.hash = '#/';
      return;
    }
    current = route.name === 'credits' ? mountCredits(content) : mountHome(content);
  }

  startRouter((r) => {
    route = r;
    mount();
  });
  onLangChange(() => mount());
}
