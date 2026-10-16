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
import { getPrinter, onPrinterChange } from '../core/printer/store.js';
import { BED_PRESETS } from '../core/printer/profiles.js';
import { loadJson, saveJson } from '../core/state/persistence.js';

const NAV_KEY = 'b3d.nav';
/** Menú abierto o contraído: lo que eligió la persona; si nunca eligió, abierto solo en pantallas anchas. */
function readNavOpen() {
  const saved = loadJson(NAV_KEY, null);
  if (saved === 'open' || saved === 'closed') return saved === 'open';
  return window.matchMedia?.('(min-width: 1440px)').matches ?? false;
}

export function startApp(root) {
  const content = h('main', { class: 'content', id: 'content', tabindex: '-1' });
  const nav = h('nav', { class: 'sidebar', 'aria-label': t('app.tools') });
  const skip = h('a', { class: 'skip-link', href: '#content' }, t('app.skip'));
  skip.addEventListener('click', (e) => {
    e.preventDefault(); // el hash lo usa el router
    content.focus();
  });
  const app = h('div', { class: 'app' }, nav, content);
  root.replaceChildren(skip, app);
  let navOpen = readNavOpen();
  onLangChange(() => (skip.textContent = t('app.skip')));

  let current = null;
  let route = { name: 'home' };

  function renderNav() {
    app.dataset.nav = navOpen ? 'open' : 'closed';
    const item = (iconName, label, { href, active = false, sub = '', onclick, extra = '' } = {}) => {
      const name = sub ? `${label}: ${sub}` : label;
      const attrs = { class: 'nav-btn' + (active ? ' active' : '') + (extra ? ' ' + extra : ''), 'aria-label': name, title: navOpen ? null : name };
      const body = [icon(iconName, 22), h('span', { class: 'nav-text' }, h('span', { class: 'nav-label' }, label), sub ? h('span', { class: 'nav-sub' }, sub) : null)];
      if (href) return h('a', { ...attrs, href, 'aria-current': active ? 'page' : null }, ...body);
      return h('button', { ...attrs, type: 'button', onclick }, ...body);
    };
    const preset = BED_PRESETS.find((b) => b.id === getPrinter().presetId);
    const toggle = h(
      'button',
      {
        class: 'icon-btn nav-toggle',
        type: 'button',
        title: navOpen ? t('app.navCollapse') : t('app.navExpand'),
        'aria-label': navOpen ? t('app.navCollapse') : t('app.navExpand'),
        'aria-expanded': String(navOpen),
        onclick: () => {
          navOpen = !navOpen;
          saveJson(NAV_KEY, navOpen ? 'open' : 'closed');
          renderNav();
        },
      },
      icon('panel', 18),
    );
    nav.replaceChildren(
      h('div', { class: 'nav-head' }, h('a', { class: 'logo', href: '#/', 'aria-label': `3D · ${t('app.name')}` }, '3D'), h('a', { class: 'wordmark', href: '#/', tabindex: -1, 'aria-hidden': 'true' }, t('app.name')), toggle),
      h(
        'div',
        { class: 'nav-group' },
        h('p', { class: 'nav-heading' }, t('app.menuTools')),
        item('home', t('app.home'), { href: '#/', active: route.name === 'home', extra: 'nav-home' }),
        ...tools.filter((x) => x.status === 'active').map((x) => item(x.icon, x.name[getLang()] ?? x.name.es, { href: `#/tool/${x.id}`, active: route.name === 'tool' && route.id === x.id })),
      ),
      h(
        'div',
        { class: 'nav-group bottom' },
        item('printer', t('app.printer'), { sub: preset?.name ?? '', onclick: openPrinterDialog }),
        item(isDark() ? 'moon' : 'sun', t('app.themeLabel'), {
          sub: isDark() ? t('app.themeDark') : t('app.themeLight'),
          onclick: () => {
            toggleTheme();
            renderNav();
          },
        }),
        item('globe', t('app.lang'), { sub: t('app.langName'), onclick: () => setLang(getLang() === 'es' ? 'en' : 'es') }),
        item('info', t('app.credits'), { href: '#/credits', active: route.name === 'credits' }),
      ),
    );
  }
  onPrinterChange(() => renderNav());

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
