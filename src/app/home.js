import { h } from '../core/ui/dom.js';
import { icon } from './icons.js';
import { t, tr } from './i18n.js';
import { tools } from '../tools/registry.js';

export function mountHome(container) {
  const active = tools.filter((tool) => tool.status === 'active');
  const soon = tools.filter((tool) => tool.status !== 'active');

  const available = active.map((tool) =>
    h(
      'a',
      { class: 'tool-card', href: `#/tool/${tool.id}` },
      h('div', { class: 'tool-card-icon' }, icon(tool.icon, 26)),
      h('h3', {}, tr(tool.name)),
      h('span', { class: 'tool-card-go', 'aria-hidden': 'true' }, icon('next', 20)),
      h('p', {}, tr(tool.description)),
    ),
  );
  const upcoming = soon.map((tool) =>
    h('li', { class: 'soon-item' }, icon(tool.icon, 20), h('strong', {}, tr(tool.name)), h('span', {}, tr(tool.description))),
  );

  container.replaceChildren(
    h(
      'div',
      { class: 'home' },
      h('header', { class: 'home-hero' }, h('h1', {}, t('app.home.title')), h('p', { class: 'lead' }, t('app.home.subtitle'))),
      h('section', { class: 'home-section' }, h('h2', {}, t('app.home.available')), h('div', { class: 'tool-cards' }, available)),
      soon.length ? h('section', { class: 'home-section' }, h('h2', {}, t('app.soon')), h('ul', { class: 'soon-list' }, upcoming)) : null,
    ),
  );
  return { dispose() {} };
}
