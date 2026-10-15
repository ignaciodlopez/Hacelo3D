// Renderiza el panel de parámetros a partir del schema declarativo de la herramienta.

import { h } from './dom.js';
import { CONTROLS } from './controls/index.js';
import { t, tr, onLangChange } from '../../app/i18n.js';
import { getPath } from '../state/toolState.js';

/**
 * @param {any[]} schema
 * @param {ReturnType<import('../state/toolState.js').createToolState>} state
 * @param {{ onFontUpload?: (file: File) => Promise<string|null> }} [env]
 */
export function panelFromSchema(schema, state, env = {}) {
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
        const row = h(
          'div',
          { class: `row row-${def.type}` + (def.inline ? ' inline' : '') },
          label,
          ctl.el,
          def.hint ? h('p', { class: 'hint' }, tr(def.hint)) : null,
        );
        if (def.tooltip) row.title = tr(def.tooltip);
        rows.push({ def, row, ctl });
        if (def.advanced) {
          advBody.append(row);
          hasAdv = true;
        } else body.append(row);
      }
      const card = h('section', { class: 'card' }, h('h2', {}, tr(section.title)), body, hasAdv ? details : null);
      cards.push({ section, card, adv: hasAdv ? details : null });
      root.append(card);
    }
    refresh();
  }

  function refresh() {
    const params = state.params;
    for (const { def, row, ctl } of rows) {
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
