// Renderiza el panel de parámetros a partir del schema declarativo de la herramienta.

import { h } from './dom.js';
import { CONTROLS } from './controls/index.js';
import { t, tr, onLangChange } from '../../app/i18n.js';
import { getPath } from '../state/toolState.js';
import { loadJson, saveJson } from '../state/persistence.js';

const OPEN_KEY = (toolId, section) => `b3d.sec.${toolId}.${section}`;

/**
 * @param {any[]} schema
 * @param {ReturnType<import('../state/toolState.js').createToolState>} state
 * @param {{ onFontUpload?: (file: File) => Promise<string|null> }} [env]
 */
export function panelFromSchema(schema, state, env = {}) {
  const toolId = env.toolId ?? 'tool';
  const root = h('div', { class: 'panel' });
  /** @type {{ def:any, row:HTMLElement, ctl:any }[]} */
  let rows = [];
  /** @type {{ section:any, card:HTMLElement, adv:HTMLElement|null }[]} */
  let cards = [];

  function build() {
    rows = [];
    cards = [];
    root.replaceChildren();
    let uid = 0;
    for (const section of schema) {
      const body = h('div', { class: 'card-body' });
      const advBody = h('div', { class: 'card-body adv-body' });
      const details = h('details', { class: 'adv' }, h('summary', {}, t('app.advanced')), advBody);
      let hasAdv = false;
      for (const def of section.controls) {
        const id = `ctl-${section.section}-${def.key.replace(/\./g, '-')}-${uid++}`;
        const ctl = CONTROLS[def.type]({ ...def }, {
          id,
          params: state.params,
          onChange: (v) => state.set(def.key, v),
          onUpload: env.onFontUpload,
        });
        const label = ctl.inlineLabel || !def.label ? null : h('label', { class: 'ctl-label', for: id }, tr(def.label));
        // `hint` puede ser un texto fijo o una función de los parámetros (cambia con la opción elegida)
        const hintEl = def.hint ? h('p', { class: 'hint' }, typeof def.hint === 'function' ? '' : tr(def.hint)) : null;
        const row = h(
          'div',
          { class: `row row-${def.type}` + (def.inline ? ' inline' : '') },
          label,
          ctl.el,
          hintEl,
        );
        if (def.tooltip) row.title = tr(def.tooltip);
        rows.push({ def, row, ctl, hintEl });
        if (def.advanced) {
          advBody.append(row);
          hasAdv = true;
        } else body.append(row);
      }
      // sección plegable: abierta por defecto salvo las marcadas `collapsed`; se recuerda lo que eligió quien la usa
      const saved = loadJson(OPEN_KEY(toolId, section.section), null);
      const open = typeof saved === 'boolean' ? saved : !section.collapsed;
      // los colores dependen del filamento que haya en stock: aviso en toda sección de colores
      const note = section.section === 'colors' ? h('p', { class: 'hint colors-note' }, t('colors.disclaimer')) : null;
      const card = h('details', { class: 'card', open }, h('summary', {}, h('h2', {}, tr(section.title))), h('div', { class: 'card-inner' }, body, hasAdv ? details : null, note));
      card.addEventListener('toggle', () => saveJson(OPEN_KEY(toolId, section.section), card.open));
      cards.push({ section, card, adv: hasAdv ? details : null });
      root.append(card);
    }
    refresh();
  }

  function refresh() {
    const params = state.params;
    for (const { def, row, ctl, hintEl } of rows) {
      if (hintEl && typeof def.hint === 'function') hintEl.textContent = tr(def.hint(params));
      row.hidden = def.showIf ? !def.showIf(params) : false;
      ctl.update(getPath(params, def.key), params);
    }
    for (const { section, card } of cards) {
      card.hidden = section.showIf ? !section.showIf(params) : false;
    }
  }

  build();
  const unsubState = state.subscribe(refresh);
  const unsubLang = onLangChange(build);
  return {
    el: root,
    refresh,
    dispose() {
      unsubState();
      unsubLang();
    },
  };
}
