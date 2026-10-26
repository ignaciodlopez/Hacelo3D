import { h } from '../core/ui/dom.js';
import { icon, brandIcon } from './icons.js';
import { t, tr, getLang } from './i18n.js';
import { colorName } from './colorNames.js';
import { buildOrderMessage, whatsappUrl, formatDims } from './orderMessage.js';
import { loadJson, saveJson } from '../core/state/persistence.js';
import { toNumber } from '../core/util/number.js';

const NAME_KEY = 'b3d.order.name';

/** Etiqueta (traducida) de una opción de un control del panel: "heart" → "Corazón". */
function optionLabel(tool, key, value) {
  for (const section of tool.schema) {
    for (const c of section.controls) {
      if (c.key !== key || !c.options) continue;
      const o = c.options.find(([v]) => v === value);
      if (o) return tr(o[1]);
    }
  }
  return String(value ?? '');
}

/**
 * Diálogo "Pedir por WhatsApp": nombre, cantidad y comentarios, con vista previa del mensaje que se envía.
 * @param {{ tool:any, params:any, result:any, link:string, config:{ shopName:string, whatsapp:string }, icons?:{ id:string, name:any }[], onSent?:()=>void }} o
 *   `icons`: catálogo de íconos, para poner su nombre ("Huella") y no su id ("paw-print")
 */
export function openOrderDialog({ tool, params, result, link, config, icons = [], onSent }) {
  const lang = getLang();
  const iconName = (id) => {
    const entry = icons.find((e) => e.id === id);
    return entry ? tr(entry.name) : String(id ?? '');
  };
  const summary = tool.orderSummary?.(params, { lang, color: (hex) => colorName(hex, lang), option: (key, v) => optionLabel(tool, key, v), icon: iconName }) ?? [];
  const sizes = result?.info?.pieceSizes;
  const sizeText = sizes ? sizes.map((s) => `${t(`color.${s.key}`)} ${formatDims(s.sizeMm, lang)}`).join(' · ') : result?.items?.[0] ? formatDims(result.items[0].sizeMm, lang) : '';

  const customer = h('input', { type: 'text', class: 'text-input', autocomplete: 'name', maxlength: 60, value: loadJson(NAME_KEY, '') });
  const qty = h('input', { type: 'text', inputmode: 'numeric', class: 'num-input', autocomplete: 'off', value: '1' });
  const notes = h('textarea', { class: 'textarea', rows: 2, maxlength: 400, placeholder: t('order.notesHint') });
  const preview = h('textarea', { class: 'textarea order-preview', rows: 9, readonly: true, 'aria-label': t('order.preview') });

  const quantity = () => Math.min(999, Math.max(1, Math.round(toNumber(qty.value, 1))));
  const message = () =>
    buildOrderMessage({ t, productName: tr(tool.name), summary, sizeText, link, shopName: config.shopName, customer: customer.value, qty: quantity(), notes: notes.value });
  const refresh = () => {
    preview.value = message();
  };
  for (const el of [customer, qty, notes]) el.addEventListener('input', refresh);

  const dialog = h(
    'dialog',
    { class: 'dialog', 'aria-label': t('order.title') },
    h(
      'form',
      {
        method: 'dialog',
        onsubmit: (e) => {
          e.preventDefault();
          saveJson(NAME_KEY, customer.value.trim());
          const url = whatsappUrl(config.whatsapp, message());
          const w = window.open(url, '_blank');
          if (w) {
            try {
              w.opener = null;
            } catch {
              /* ventana de otro origen */
            }
          } else location.href = url; // bloqueador de ventanas: se abre en esta pestaña
          dialog.close();
          onSent?.();
        },
      },
      h('div', { class: 'dlg-head' }, h('h2', {}, t('order.title')), h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('order.cancel'), onclick: () => dialog.close() }, icon('close'))),
      h(
        'div',
        { class: 'dlg-body' },
        h('p', { class: 'dlg-hint' }, t('order.intro')),
        config.whatsapp ? null : h('p', { class: 'dlg-hint warn' }, t('order.noNumber')),
        h('div', { class: 'dlg-row' }, h('label', { class: 'dlg-field' }, h('span', {}, t('order.name')), customer), h('label', { class: 'dlg-field qty' }, h('span', {}, t('order.qty')), qty)),
        h('label', { class: 'dlg-field' }, h('span', {}, t('order.notes')), notes),
        h('label', { class: 'dlg-field' }, h('span', {}, t('order.preview')), preview),
      ),
      h('div', { class: 'dlg-foot' }, h('button', { class: 'btn', type: 'button', onclick: () => dialog.close() }, t('order.cancel')), h('button', { class: 'btn whatsapp', type: 'submit' }, brandIcon('whatsapp', 20), t('order.send'))),
    ),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  refresh();
  dialog.showModal();
  (customer.value ? qty : customer).focus();
}
