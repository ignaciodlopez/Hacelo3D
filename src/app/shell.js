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
import { isWorkshop, hasPin, lockWorkshop, enableWithoutPin, onWorkshopChange } from './workshop.js';
import { openPinDialog } from './pinDialog.js';
import { getPrinter, onPrinterChange } from '../core/printer/store.js';
import { BED_PRESETS } from '../core/printer/profiles.js';
import { loadJson, saveJson } from '../core/state/persistence.js';

const NAV_KEY = 'b3d.nav';
/** Menú abierto o contraído: lo que eligió la persona; si nunca eligió, abierto solo en pantallas anchas. */
function readNavOpen() {
  const saved = loadJson(NAV_KEY, null);
  if (saved === 'open' || saved === 'closed') return saved === 'open';
  return window.matchMedia?.('(min-width: 1100px)').matches ?? false;
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
    // `short`: nombre corto que se ve debajo del ícono en el celular (el menú ahí es una barra de íconos con texto)
    const item = (iconName, label, { href, active = false, sub = '', onclick, extra = '', short } = {}) => {
      const name = sub ? `${label}: ${sub}` : label;
      const attrs = { class: 'nav-btn' + (active ? ' active' : '') + (extra ? ' ' + extra : ''), 'aria-label': name, title: navOpen ? null : name };
      const body = [icon(iconName, 22), h('span', { class: 'nav-text' }, h('span', { class: 'nav-label' }, label), sub ? h('span', { class: 'nav-sub' }, sub) : null), h('span', { class: 'nav-short', 'aria-hidden': 'true' }, short ?? label)];
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
      h(
        'div',
        { class: 'nav-head' },
        // abierto: "Bitcoin3D" grande con su leyenda; contraído y en el celular: solo "B3"
        h(
          'a',
          { class: 'logo', href: '#/', 'aria-label': t('app.name') },
          h('span', { class: 'logo-b3', 'aria-hidden': 'true' }, 'B3'),
          h('span', { class: 'logo-full', 'aria-hidden': 'true' }, h('strong', { class: 'wordmark' }, t('app.name').slice(0, -2), h('span', { class: 'wm-3d' }, '3D')), h('span', { class: 'tagline' }, t('app.tagline'))),
        ),
        toggle,
      ),
      h(
        'div',
        { class: 'nav-group' },
        h('p', { class: 'nav-heading' }, t('app.menuTools')),
        item('home', t('app.home'), { href: '#/', active: route.name === 'home', extra: 'nav-home' }),
        ...tools.filter((x) => x.status === 'active').map((x) => item(x.icon, x.name[getLang()] ?? x.name.es, { href: `#/tool/${x.id}`, active: route.name === 'tool' && route.id === x.id, short: x.short?.[getLang()] })),
      ),
      h(
        'div',
        { class: 'nav-group bottom' },
        // el perfil de la impresora es de quien fabrica: a un cliente solo le confunde
        __WORKSHOP__ && isWorkshop() ? item('printer', t('app.printer'), { sub: preset?.name ?? '', onclick: openPrinterDialog }) : null,
        // el interruptor existe solo en la compilación completa; con PIN configurado, activar pide el PIN y apagar lo olvida
        __WORKSHOP__
          ? item('wrench', t('app.workshop'), { short: t('app.workshopShort'), sub: isWorkshop() ? t('app.workshopOn') : t('app.workshopOff'), onclick: () => (isWorkshop() ? lockWorkshop() : hasPin() ? openPinDialog() : enableWithoutPin()) })
          : null,
        item(isDark() ? 'moon' : 'sun', t('app.themeLabel'), {
          sub: isDark() ? t('app.themeDark') : t('app.themeLight'),
          onclick: () => {
            toggleTheme();
            renderNav();
          },
        }),
        item('globe', t('app.lang'), { sub: t('app.langName'), onclick: () => setLang(getLang() === 'es' ? 'en' : 'es') }),
        item('info', t('app.credits'), { href: '#/credits', active: route.name === 'credits', short: t('app.creditsShort') }),
      ),
    );
  }
  onPrinterChange(() => renderNav());
  onWorkshopChange(() => renderNav());

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
