import { h } from '../core/ui/dom.js';
import { t } from './i18n.js';
import { loadCatalog } from '../core/fonts/catalog.js';
import { PHOTO_CREDITS } from './photoCredits.js';

/** Software y recursos de terceros que usa la app (nombre, licencia, sitio). */
const SOFTWARE = [
  ['three.js', 'MIT', 'https://threejs.org'],
  ['manifold-3d', 'Apache-2.0', 'https://github.com/elalish/manifold'],
  ['opentype.js', 'MIT', 'https://opentype.js.org'],
  ['fflate', 'MIT', 'https://github.com/101arrowz/fflate'],
  ['qrcode-generator', 'MIT', 'https://github.com/kazuhikoarase/qrcode-generator'],
  ['Geist', 'SIL OFL 1.1', 'https://vercel.com/font'],
  ['Phosphor Icons', 'MIT', 'https://phosphoricons.com'],
];

export function mountCredits(container) {
  const base = import.meta.env.BASE_URL;
  const fonts = h('ul', { class: 'credits-fonts' });
  loadCatalog().then((list) => {
    for (const f of list.filter((x) => !x.buffer)) {
      const lic = f.license && f.license !== 'OFL-1.1' ? f.license : null; // casi todas son OFL 1.1: se aclara una sola vez arriba
      fonts.append(h('li', {}, f.name, lic ? h('span', { class: 'lic' }, ` · ${lic}`) : null));
    }
  });
  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text);
  container.replaceChildren(
    h(
      'div',
      { class: 'credits' },
      h('header', { class: 'credits-intro' }, h('a', { class: 'back', href: '#/' }, '← ' + t('app.back')), h('h1', {}, t('credits.title')), h('p', { class: 'credits-lead' }, t('credits.lead')), h('p', { class: 'credits-own' }, t('credits.own', { year: new Date().getFullYear() }))),
      h(
        'div',
        { class: 'credits-main' },
        h(
          'section',
          {},
          h('h2', {}, t('credits.softwareTitle')),
          h('ul', { class: 'credits-tiles' }, SOFTWARE.map(([name, lic, url]) => h('li', {}, link(url, name), h('span', { class: 'lic' }, lic)))),
        ),
        h(
          'section',
          {},
          h('h2', {}, t('credits.mediaTitle')),
          h(
            'ul',
            { class: 'credits-photos' },
            PHOTO_CREDITS.map((c) =>
              h(
                'li',
                {},
                h('img', { src: `${base}home/${c.file}`, alt: '', width: 320, height: 200, loading: 'lazy', decoding: 'async' }),
                link(c.page, `“${c.title.replace(/_/g, '_​')}”`), // el salto de línea cae después del guion bajo, no en la comilla
                h('span', { class: 'lic' }, `${c.by.replace(/^by /, '')} · `, link(c.licenseUrl, c.license)),
              ),
            ),
          ),
        ),
        h('section', {}, h('h2', {}, t('credits.fonts')), h('p', { class: 'credits-note' }, t('credits.fontsNote')), fonts),
      ),
    ),
  );
  return { dispose() {} };
}
