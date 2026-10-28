// Controles de formulario. Cada uno: createX(def, ctx) → { el, update(value, params) }.
// `ctx.onChange(value)` se llama con el valor ya validado.

import { h } from '../dom.js';
import { t, tr, getLang } from '../../../app/i18n.js';
import { toNumber } from '../../util/number.js';
import { loadCatalog, ensureFontFace, fontFamilyOf } from '../../fonts/catalog.js';
import { loadIconCatalog, iconUrl, loadLogoCatalog, logoUrl } from '../iconPolygons.js';
import { loadJson, saveJson } from '../../state/persistence.js';

const fmt = (n) => {
  const s = String(Math.round(n * 1000) / 1000);
  return getLang() === 'es' ? s.replace('.', ',') : s;
};

export function createSegmented(def, ctx) {
  const illustration = (value) => {
    if (!def.illustrations?.[value]) return null;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 80 64');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', def.illustrations[value]);
    path.setAttribute('fill', 'currentColor');
    svg.append(path);
    return svg;
  };
  const buttons = def.options.map(([value, label]) =>
    h('button', { type: 'button', class: 'seg-btn', 'data-value': value, onclick: () => ctx.onChange(value) }, illustration(value), tr(label)),
  );
  const el = h('div', { class: 'segmented' + (def.illustrations ? ' segmented-illustrated' : ''), role: 'group', 'aria-label': tr(def.label) ?? '' }, buttons);
  return {
    el,
    update(value) {
      buttons.forEach((b) => {
        const on = b.dataset.value === String(value);
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    },
  };
}

export function createNumber(def, ctx) {
  const input = h('input', { type: 'text', inputmode: 'decimal', class: 'num-input', id: ctx.id, autocomplete: 'off' });
  const unit = def.unit ? h('span', { class: 'unit' }, def.unit) : null;
  let current = null;
  const range = `${fmt(def.min)} – ${fmt(def.max)}${def.unit ? ' ' + def.unit : ''}`;
  const parse = () => toNumber(input.value, NaN);
  input.addEventListener('input', () => {
    const n = parse();
    const ok = Number.isFinite(n) && n >= def.min && n <= def.max;
    input.classList.toggle('invalid', !ok);
    input.title = ok ? '' : `${range}`;
    if (ok) {
      current = n;
      ctx.onChange(n);
    }
  });
  input.addEventListener('blur', () => {
    input.classList.remove('invalid');
    input.title = '';
    if (current != null) input.value = fmt(current);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const step = (def.step ?? 1) * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
    const base = Number.isFinite(parse()) ? parse() : (current ?? def.min);
    const next = Math.min(def.max, Math.max(def.min, Math.round((base + step) * 1000) / 1000));
    input.value = fmt(next);
    current = next;
    input.classList.remove('invalid');
    ctx.onChange(next);
  });
  const el = h('div', { class: 'num-wrap' }, input, unit);
  return {
    el,
    input,
    update(value) {
      current = value;
      if (document.activeElement !== input) input.value = value == null ? '' : fmt(value);
    },
  };
}

export function createSlider(def, ctx) {
  const input = h('input', { type: 'range', min: def.min, max: def.max, step: def.step ?? 1, id: ctx.id, class: 'slider' });
  const out = h('span', { class: 'slider-out' });
  input.addEventListener('input', () => {
    const n = Number(input.value);
    out.textContent = fmt(n);
    ctx.onChange(n);
  });
  return {
    el: h('div', { class: 'slider-wrap' }, input, out, def.unit ? h('span', { class: 'unit' }, def.unit) : null),
    update(value) {
      input.value = value;
      out.textContent = fmt(Number(value));
    },
  };
}

export function createSelect(def, ctx) {
  const select = h(
    'select',
    { class: 'select', id: ctx.id, onchange: (e) => ctx.onChange(e.target.value) },
    def.options.map(([v, label]) => h('option', { value: v }, tr(label))),
  );
  return {
    el: h('div', { class: 'select-wrap' }, select),
    update(value) {
      select.value = value ?? '';
    },
  };
}

/** Campo de texto de una línea (nombre de red, teléfono, etc.). */
export function createText(def, ctx) {
  const input = h('input', {
    type: 'text',
    class: 'text-input',
    id: ctx.id,
    autocomplete: 'off',
    spellcheck: 'false',
    inputmode: def.inputmode,
    maxlength: def.maxLength ?? 80,
    placeholder: def.placeholder ? tr(def.placeholder) : null,
  });
  input.addEventListener('input', () => ctx.onChange(input.value));
  return {
    el: input,
    update(value) {
      if (document.activeElement !== input && input.value !== value) input.value = value ?? '';
    },
  };
}

export function createTextarea(def, ctx) {
  const ta = h('textarea', { class: 'textarea', rows: def.rows ?? 2, id: ctx.id, spellcheck: 'false', maxlength: def.maxLength ?? 400 });
  ta.addEventListener('input', () => ctx.onChange(ta.value));
  return {
    el: ta,
    update(value) {
      if (document.activeElement !== ta && ta.value !== value) ta.value = value ?? '';
    },
  };
}

export function createCheckbox(def, ctx) {
  const cb = h('input', { type: 'checkbox', id: ctx.id, onchange: (e) => ctx.onChange(e.target.checked) });
  return {
    el: h('label', { class: 'check', for: ctx.id }, cb, h('span', {}, tr(def.label))),
    inlineLabel: true,
    update(value) {
      cb.checked = !!value;
    },
  };
}

const SWATCHES = ['#3a3a3a', '#ffffff', '#f2e08a', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#ec407a', '#8d6e63', '#9e9e9e'];

export function createColor(def, ctx) {
  const input = h('input', { type: 'color', class: 'color-input', id: ctx.id, 'aria-label': tr(def.label) });
  input.addEventListener('input', () => ctx.onChange(input.value));
  const swatches = SWATCHES.map((c) =>
    h('button', {
      type: 'button',
      class: 'swatch',
      style: { background: c },
      title: c,
      'aria-label': c,
      onclick: () => ctx.onChange(c),
    }),
  );
  const same = def.nullable
    ? h('button', { type: 'button', class: 'link-btn', onclick: () => ctx.onChange(null) }, tr(def.nullLabel ?? { es: 'Igual que las letras', en: 'Same as letters' }))
    : null;
  return {
    el: h('div', { class: 'color-wrap' }, input, h('div', { class: 'swatches' }, swatches), same),
    update(value, params) {
      input.value = value || (def.fallbackKey ? getFallback(def, params) : '#000000');
      input.classList.toggle('inherited', !value && !!def.nullable);
    },
  };
}

function getFallback(def, params) {
  return def.fallbackKey.split('.').reduce((o, k) => o?.[k], params) ?? '#000000';
}

/** Selector de fuentes con vista previa del texto del usuario, búsqueda y categorías. */
export function createFontSelect(def, ctx) {
  const FAV_KEY = 'b3d.fontFavs';
  let catalog = [];
  let value = null;
  let favs = new Set(loadJson(FAV_KEY, []));
  let query = '';
  let category = 'all';

  const btn = h('button', { type: 'button', class: 'font-btn', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', id: ctx.id });
  const search = h('input', { type: 'search', class: 'font-search', placeholder: tr({ es: 'Buscar fuente…', en: 'Search font…' }) });
  const chips = h('div', { class: 'font-chips' });
  const list = h('div', { class: 'font-list', role: 'listbox' });
  const upload = h('input', { type: 'file', accept: '.ttf,.otf,.woff', hidden: true });
  const uploadBtn = h('button', { type: 'button', class: 'link-btn', onclick: () => upload.click() }, tr({ es: 'Subir fuente…', en: 'Upload font…' }));
  const pop = h('div', { class: 'font-pop', hidden: true }, search, chips, list, h('div', { class: 'font-foot' }, uploadBtn, upload));
  const el = h('div', { class: 'font-select' }, btn, pop);
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        observer.unobserve(e.target);
        const entry = catalog.find((f) => f.id === e.target.dataset.id);
        if (entry) ensureFontFace(entry).then((fam) => (e.target.querySelector('.font-sample').style.fontFamily = `"${fam}", sans-serif`));
      }
    },
    { root: list },
  );

  const cats = {
    all: { es: 'Todas', en: 'All' },
    fav: { es: '★ Favoritas', en: '★ Favorites' },
    'script-connected': { es: 'Cursivas', en: 'Script' },
    'script-thin': { es: 'Elegantes', en: 'Elegant' },
    handwritten: { es: 'A mano', en: 'Handwritten' },
    display: { es: 'Gruesas', en: 'Display' },
    serif: { es: 'Serif', en: 'Serif' },
    sans: { es: 'Sans', en: 'Sans' },
    themed: { es: 'Temáticas', en: 'Themed' },
    upload: { es: 'Subidas', en: 'Uploaded' },
  };

  function renderChips() {
    const present = new Set(catalog.map((f) => f.category));
    chips.replaceChildren(
      ...Object.entries(cats)
        .filter(([k]) => k === 'all' || k === 'fav' || present.has(k))
        .map(([k, label]) =>
          h('button', { type: 'button', class: 'chip' + (category === k ? ' active' : ''), onclick: () => { category = k; renderChips(); renderList(); } }, tr(label)),
        ),
    );
  }

  function renderList() {
    const q = query.trim().toLowerCase();
    const text = (ctx.params?.text || 'Valentina').split('\n')[0].slice(0, 18) || 'Valentina';
    const items = catalog.filter(
      (f) => !f.hidden && (category === 'all' || (category === 'fav' ? favs.has(f.id) : f.category === category)) && (!q || f.name.toLowerCase().includes(q)),
    );
    list.replaceChildren(
      ...items.map((f) => {
        const star = h(
          'button',
          {
            type: 'button',
            class: 'star' + (favs.has(f.id) ? ' on' : ''),
            'aria-label': 'favorita',
            onclick: (e) => {
              e.stopPropagation();
              favs.has(f.id) ? favs.delete(f.id) : favs.add(f.id);
              saveJson(FAV_KEY, [...favs]);
              renderList();
            },
          },
          favs.has(f.id) ? '★' : '☆',
        );
        const row = h(
          'div',
          { class: 'font-item' + (f.id === value ? ' active' : ''), role: 'option', 'data-id': f.id, tabindex: 0, onclick: () => { ctx.onChange(f.id); close(); } },
          h('div', { class: 'font-meta' }, h('span', { class: 'font-name' }, f.name), f.thin ? h('span', { class: 'tag' }, tr({ es: 'fina', en: 'thin' })) : null, star),
          h('div', { class: 'font-sample' }, text),
        );
        row.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && row.click());
        observer.observe(row);
        return row;
      }),
    );
  }

  function open() {
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    renderChips();
    renderList();
    search.focus();
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
  }
  function close() {
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', outside);
  }
  const outside = (e) => !el.contains(e.target) && close();
  btn.addEventListener('click', () => (pop.hidden ? open() : close()));
  search.addEventListener('input', () => {
    query = search.value;
    renderList();
  });
  el.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  upload.addEventListener('change', async () => {
    const file = upload.files?.[0];
    upload.value = '';
    if (!file) return;
    const id = await ctx.onUpload?.(file);
    if (id) {
      catalog = await loadCatalog();
      ctx.onChange(id);
      close();
    }
  });

  function showCurrent() {
    const entry = catalog.find((f) => f.id === value);
    btn.replaceChildren(h('span', { class: 'font-btn-name' }, entry?.name ?? value ?? '…'), h('span', { class: 'caret' }, '▾'));
    btn.setAttribute('aria-label', `${tr(def.label)}: ${entry?.name ?? value ?? ''}`);
    if (entry) ensureFontFace(entry).then((fam) => (btn.firstChild.style.fontFamily = `"${fam}", sans-serif`));
  }

  loadCatalog().then((c) => {
    catalog = c;
    showCurrent();
  });
  return {
    el,
    update(v, params) {
      value = v;
      ctx.params = params;
      showCurrent();
      if (!pop.hidden) renderList();
    },
    refreshCatalog: async () => {
      catalog = await loadCatalog();
      showCurrent();
    },
    fontFamilyOf,
  };
}

/**
 * Selector de ícono: cuadrícula con búsqueda. El ícono se muestra con una máscara CSS (hereda el color del texto).
 * Con `catalog: 'logos'` elige un logo de marca (public/logos/) en vez de un ícono.
 */
export function createIconSelect(def, ctx) {
  const logos = def.catalog === 'logos';
  const loadCatalog = logos ? loadLogoCatalog : loadIconCatalog;
  const urlOf = logos ? logoUrl : iconUrl;
  const NONE = logos ? { es: 'Sin logo', en: 'No logo' } : { es: 'Sin ícono', en: 'No icon' };
  let catalog = [];
  let value = null;
  let query = '';
  const mask = (entry) => `url("${urlOf(entry)}")`;
  const btn = h('button', { type: 'button', class: 'font-btn', id: ctx.id, 'aria-haspopup': 'listbox', 'aria-expanded': 'false' });
  const search = h('input', { type: 'search', class: 'font-search', placeholder: tr(logos ? { es: 'Buscar marca…', en: 'Search brand…' } : { es: 'Buscar ícono…', en: 'Search icon…' }) });
  const grid = h('div', { class: logos ? 'icon-grid logos' : 'icon-grid', role: 'listbox' });
  const pop = h('div', { class: 'font-pop', hidden: true }, search, grid);
  const el = h('div', { class: 'font-select' }, btn, pop);
  const outside = (e) => !el.contains(e.target) && close();

  function show() {
    const entry = catalog.find((i) => i.id === value);
    btn.replaceChildren(
      ...(entry ? [h('span', { class: logos ? 'icon-mask wide' : 'icon-mask', style: { '-webkit-mask-image': mask(entry), 'mask-image': mask(entry) } })] : []),
      h('span', { class: 'font-btn-name' }, entry ? tr(entry.name) : tr(NONE)),
      h('span', { class: 'caret' }, '▾'),
    );
    btn.setAttribute('aria-label', `${tr(def.label)}: ${entry ? tr(entry.name) : tr(NONE)}`);
  }
  function renderGrid() {
    const q = query.trim().toLowerCase();
    // `def.ids` limita el selector a los íconos que sirven para esa herramienta (p. ej. como silueta)
    const items = catalog.filter((i) => (!def.ids || def.ids.includes(i.id)) && (!q || i.tags.includes(q) || tr(i.name).toLowerCase().includes(q)));
    grid.replaceChildren(
      h('button', { type: 'button', role: 'option', 'aria-selected': String(value == null), class: 'icon-cell none' + (value == null ? ' active' : ''), title: tr(NONE), 'aria-label': tr(NONE), onclick: () => { ctx.onChange(null); close(); } }, '∅'),
      ...items.map((i) =>
        h('button', { type: 'button', role: 'option', 'aria-selected': String(i.id === value), class: 'icon-cell' + (i.id === value ? ' active' : ''), title: tr(i.name), 'aria-label': tr(i.name), onclick: () => { ctx.onChange(i.id); close(); } },
          h('span', { class: logos ? 'icon-mask big wide' : 'icon-mask big', style: { '-webkit-mask-image': mask(i), 'mask-image': mask(i) } })),
      ),
    );
  }
  function open() {
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    renderGrid();
    search.focus();
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
  }
  function close() {
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', outside);
  }
  btn.addEventListener('click', () => (pop.hidden ? open() : close()));
  search.addEventListener('input', () => {
    query = search.value;
    renderGrid();
  });
  el.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  loadCatalog().then((c) => {
    catalog = c;
    show();
  });
  return {
    el,
    update(v) {
      value = v;
      show();
      if (!pop.hidden) renderGrid();
    },
  };
}

export const CONTROLS = {
  segmented: createSegmented,
  number: createNumber,
  slider: createSlider,
  select: createSelect,
  textarea: createTextarea,
  text: createText,
  checkbox: createCheckbox,
  color: createColor,
  fontSelect: createFontSelect,
  iconSelect: createIconSelect,
};

export { t };
