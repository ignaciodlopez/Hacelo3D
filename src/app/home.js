// Home: escenario fijo con la pieza REAL que genera cada herramienta (mismo visor y mismo worker que
// las herramientas) + columna de lectura con el nombre a probar, el índice de herramientas y lo que viene.
// Pasar el mouse (o el foco) por una herramienta cambia la pieza del escenario; escribir un nombre
// regenera el llavero en vivo y "Diseñalo" lo abre en la herramienta con ese nombre.

import { h } from '../core/ui/dom.js';
import { t, tr, getLang } from './i18n.js';
import { tools } from '../tools/registry.js';
import { Viewer } from '../core/viewer/Viewer.js';
import { createWorkerClient } from '../core/worker/workerClient.js';
import { getPrinter } from '../core/printer/store.js';
import { onThemeChange, isDark } from './theme.js';
import { encodeShare, loadSaved } from '../core/state/persistence.js';
import { PHOTO_CREDITS } from './photoCredits.js';

const NAME_DEBOUNCE_MS = 220;

export function mountHome(container) {
  const active = tools.filter((tool) => tool.status === 'active');
  const soon = tools.filter((tool) => tool.status !== 'active');
  const keychain = active.find((tool) => tool.id === 'keychain');
  const num = (n, d = 1) => n.toLocaleString(getLang() === 'es' ? 'es-AR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  /** @type {Map<string, any>} resultado del build por clave (herramienta + texto) */
  const cache = new Map();
  let current = keychain?.id ?? active[0]?.id;
  let name = '';
  let disposed = false;

  // ---------- escenario (derecha)
  const stage = h('div', { class: 'stage-view', 'data-ui': '' });
  const stageName = h('span', { class: 'stage-name' });
  const stageSpec = h('span', { class: 'stage-spec' });
  const stageBar = h('div', { class: 'stage-bar' }, stageName, stageSpec);
  const stageWrap = h('aside', { class: 'home-stage', 'aria-label': t('home.stage') }, stage, stageBar);

  // ---------- columna de lectura (izquierda)
  const nameInput = h('input', {
    type: 'text',
    id: 'home-name',
    class: 'home-name-input',
    maxlength: 30,
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'Valentina',
  });
  const makeLink = h('a', { class: 'btn primary big home-make', href: '#/tool/keychain' }, t('home.make'));

  const rows = active.map((tool) => {
    const spec = h('span', { class: 'tool-row-spec' });
    const row = h(
      'a',
      { class: 'tool-row', href: `#/tool/${tool.id}`, 'data-id': tool.id },
      h('span', { class: 'tool-row-name' }, tr(tool.name)),
      h('span', { class: 'tool-row-desc' }, tr(tool.description)),
      spec,
    );
    const pick = () => select(tool.id);
    row.addEventListener('mouseenter', pick);
    row.addEventListener('focus', pick);
    return { tool, row, spec };
  });

  const base = import.meta.env.BASE_URL;
  const video = h(
    'video',
    {
      class: 'flow-video',
      muted: true,
      loop: true,
      playsinline: true,
      preload: 'metadata',
      poster: `${base}home/3d-printing-time-lapse-2026-poster.jpg`,
      width: 854,
      height: 480,
      'aria-hidden': 'true',
    },
    h('source', { src: `${base}home/3d-printing-time-lapse-2026.webm`, type: 'video/webm' }),
  );
  video.muted = true; // el atributo solo no alcanza para que el navegador permita el autoplay
  const figure = (file, w, hgt, key, cls) =>
    h(
      'figure',
      { class: `band-photo ${cls}`, 'data-reveal': '' },
      h('img', { src: `${base}home/${file}`, width: w, height: hgt, alt: t(key), loading: 'lazy', decoding: 'async' }),
      h('figcaption', {}, t(key)),
    );

  const page = h(
    'div',
    { class: 'home' },
    h(
      'div',
      { class: 'home-top' },
      h(
        'div',
        { class: 'home-read' },
        h('header', { class: 'home-intro' }, h('h1', {}, t('app.home.title')), h('p', { class: 'home-lead' }, t('home.lead'))),
        h(
          'form',
          { class: 'home-try', onsubmit: (e) => { e.preventDefault(); location.hash = makeLink.getAttribute('href'); } },
          h('label', { class: 'home-try-label', for: 'home-name' }, t('home.try')),
          h('div', { class: 'home-try-row' }, nameInput, makeLink),
        ),
        h('section', { class: 'home-tools', 'aria-labelledby': 'home-tools-title' }, h('h2', { id: 'home-tools-title' }, t('home.toolsTitle')), h('nav', { class: 'tool-rows' }, rows.map((r) => r.row))),
      ),
      stageWrap,
    ),
    // del navegador a la cama: los tres pasos reales y una impresora trabajando
    h(
      'section',
      { class: 'home-flow', 'aria-labelledby': 'home-flow-title' },
      h(
        'div',
        { class: 'flow-text' },
        h('h2', { id: 'home-flow-title', 'data-reveal': '' }, t('home.flowTitle')),
        h('ol', { class: 'flow-steps' }, [1, 2, 3].map((n) => h('li', { 'data-reveal': '' }, h('strong', {}, t(`home.step${n}`)), h('span', {}, t(`home.step${n}b`))))),
      ),
      h('div', { class: 'flow-media', 'data-reveal': '' }, video),
    ),
    h(
      'div',
      { class: 'home-band' },
      figure('3d-printing-a-snow-machine-nozzle.jpg', 1920, 1280, 'home.photo.desk', 'wide'),
      figure('flashforgefinder-printcastle1.jpg', 1024, 682, 'home.photo.castle', 'tall'),
      figure('3d-print-of-a-spool-holder-on.jpg', 1024, 768, 'home.photo.spool', 'tall'),
      figure('the-beeverycreative-bee-as-multi-colour-3d.jpg', 1920, 1080, 'home.photo.bee', 'wide'),
    ),
    soon.length
      ? h(
          'section',
          { class: 'home-soon', 'aria-labelledby': 'home-soon-title' },
          h('h2', { id: 'home-soon-title', 'data-reveal': '' }, t('app.soon')),
          h('ul', {}, soon.map((tool) => h('li', { 'data-reveal': '' }, h('strong', {}, tr(tool.name)), h('span', {}, tr(tool.description))))),
        )
      : null,
    h(
      'footer',
      { class: 'home-foot' },
      h('div', { class: 'foot-line' }, h('span', {}, t('home.foot')), h('a', { href: '#/credits' }, t('app.credits')), h('span', {}, `© ${new Date().getFullYear()} Ignacio D. López`)),
      h(
        'p',
        { class: 'foot-credits' },
        t('home.credits'),
        ' ',
        PHOTO_CREDITS.flatMap((c, i) => [
          h('a', { href: c.page, target: '_blank', rel: 'noopener' }, `“${c.title}”`),
          ` ${c.by}, `,
          h('a', { href: c.licenseUrl, target: '_blank', rel: 'noopener' }, c.license),
          i < PHOTO_CREDITS.length - 1 ? '; ' : '.',
        ]),
      ),
    ),
  );
  container.replaceChildren(page);

  // entrada escalonada de la columna al cargar; el resto aparece al entrar en pantalla
  page.querySelectorAll('.home-read > *').forEach((el, i) => el.style.setProperty('--i', String(i)));
  rows.forEach((r, i) => r.row.style.setProperty('--i', String(i + 3)));
  requestAnimationFrame(() => page.classList.add('is-in'));
  const reveals = [...page.querySelectorAll('[data-reveal]')];
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    reveals.forEach((el, i) => {
      el.style.setProperty('--d', String(i % 4));
      io.observe(el);
    });
  } else reveals.forEach((el) => el.classList.add('in'));

  // el timelapse se reproduce solo si no se pidió reducir el movimiento
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (!reduce?.matches) video.play?.().catch(() => {});

  // ---------- visor y generación (reusa el worker de las herramientas)
  let viewer = null;
  try {
    viewer = new Viewer(stage);
    viewer.setTheme(isDark());
  } catch {
    stage.append(h('p', { class: 'stage-fallback' }, t('home.noWebgl')));
  }
  const client = createWorkerClient();
  const unsubTheme = onThemeChange((dark) => viewer?.setTheme(dark));

  const paramsFor = (tool) => (tool.id === 'keychain' && name.trim() ? { ...tool.defaults, text: name.trim() } : tool.defaults);
  const keyFor = (tool) => `${tool.id}:${tool.id === 'keychain' ? name.trim() : ''}`;

  function specText(result) {
    const it = result.items[0];
    const [x, y, z] = it.sizeMm;
    const grams = (it.parts.reduce((v, p) => v + p.volumeMm3, 0) / 1000) * getPrinter().densityGcm3;
    return `${num(x)} × ${num(y)} × ${num(z)} mm · ${num(grams)} g`;
  }

  // El worker descarta un pedido si llega otro antes de que termine: acá van de a uno, en fila,
  // y dos pedidos de la misma pieza comparten el resultado.
  let queue = Promise.resolve();
  const inflight = new Map();
  function ensure(tool) {
    const key = keyFor(tool);
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (inflight.has(key)) return inflight.get(key);
    const params = paramsFor(tool);
    const job = queue.then(async () => {
      if (disposed) return null;
      const res = await client.build(tool.id, params, getPrinter());
      if (res.stale || disposed || !res.result?.items?.length) return null;
      cache.set(key, res.result);
      return res.result;
    });
    queue = job.catch(() => null);
    inflight.set(key, job);
    job.finally(() => inflight.delete(key)).catch(() => {});
    return job;
  }

  function paintStage(tool, result) {
    stageName.textContent = tr(tool.name);
    stageSpec.textContent = result ? specText(result) : t('app.loading');
    for (const r of rows) {
      const on = r.tool.id === tool.id;
      r.row.classList.toggle('active', on);
      if (on && result) r.spec.textContent = specText(result);
    }
    if (result && viewer) {
      stage.classList.remove('swap');
      void stage.offsetWidth; // reinicia la animación de cambio
      stage.classList.add('swap');
      viewer.fitted = false; // cada pieza se encuadra entera al aparecer
      viewer.setItems(result.items);
    }
  }

  async function select(id) {
    const tool = active.find((x) => x.id === id);
    if (!tool) return;
    current = id;
    const cached = cache.get(keyFor(tool));
    paintStage(tool, cached ?? null);
    if (cached) return;
    try {
      const result = await ensure(tool);
      if (result && current === id && !disposed) paintStage(tool, result);
    } catch {
      if (current === id) stageSpec.textContent = '';
    }
  }

  // ---------- nombre en vivo → llavero
  let nameTimer;
  function updateMakeLink() {
    if (!keychain) return;
    const saved = loadSaved('keychain');
    const base = { ...keychain.defaults, ...(saved?.v === keychain.paramsVersion ? saved.params : {}) };
    const text = name.trim();
    makeLink.setAttribute('href', text ? `#/tool/keychain?p=${encodeShare({ ...base, mode: 'single', text }, keychain.paramsVersion, keychain.defaults)}` : '#/tool/keychain');
  }
  nameInput.addEventListener('input', () => {
    name = nameInput.value;
    updateMakeLink();
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => select('keychain'), NAME_DEBOUNCE_MS);
  });

  // primera pieza y, después, las demás en segundo plano para tener sus medidas
  (async () => {
    await select(current);
    for (const tool of active) {
      if (disposed) return;
      try {
        const result = await ensure(tool);
        const r = rows.find((x) => x.tool.id === tool.id);
        if (result && r) r.spec.textContent = specText(result);
      } catch {
        /* la medida es opcional */
      }
    }
  })();

  return {
    dispose() {
      disposed = true;
      clearTimeout(nameTimer);
      unsubTheme();
      client.dispose();
      viewer?.dispose();
      io?.disconnect();
      video.pause();
    },
  };
}
