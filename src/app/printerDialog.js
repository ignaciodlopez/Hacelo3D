import { h } from '../core/ui/dom.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { BED_PRESETS } from '../core/printer/profiles.js';
import { getPrinter, setPrinter } from '../core/printer/store.js';
import { toNumber } from '../core/util/number.js';

/** Diálogo modal del perfil de impresora (compartido por todas las herramientas). */
export function openPrinterDialog() {
  const p = getPrinter();
  const field = (label, value, key, opts = {}) => {
    const input = h('input', { type: 'text', inputmode: 'decimal', class: 'num-input', value: String(value), autocomplete: 'off' });
    input.addEventListener('change', () => {
      const n = toNumber(input.value, NaN);
      if (!Number.isFinite(n)) {
        input.value = String(getPrinter()[key] ?? value);
        return;
      }
      setPrinter(opts.set ? opts.set(n) : { [key]: n });
      if (opts.custom) {
        setPrinter({ presetId: 'custom' });
        select.value = 'custom';
      }
    });
    return h('label', { class: 'dlg-field' }, h('span', {}, label), input);
  };

  const select = h(
    'select',
    {
      class: 'select',
      onchange: (e) => {
        const preset = BED_PRESETS.find((b) => b.id === e.target.value);
        if (preset) {
          setPrinter({ presetId: preset.id, bed: preset.bed });
          bedW.querySelector('input').value = String(preset.bed[0]);
          bedH.querySelector('input').value = String(preset.bed[1]);
        }
      },
    },
    BED_PRESETS.map((b) => h('option', { value: b.id }, `${b.name}${b.id !== 'custom' ? ` (${b.bed[0]}×${b.bed[1]})` : ''}`)),
  );
  select.value = p.presetId;
  const bedW = field(t('printer.bedW'), p.bed[0], 'bed', { set: (n) => ({ bed: [n, getPrinter().bed[1]] }), custom: true });
  const bedH = field(t('printer.bedH'), p.bed[1], 'bed', { set: (n) => ({ bed: [getPrinter().bed[0], n] }), custom: true });
  const mmu = h('input', { type: 'checkbox', onchange: (e) => setPrinter({ multiMaterial: e.target.checked }) });
  mmu.checked = p.multiMaterial;

  const dialog = h(
    'dialog',
    { class: 'dialog', 'aria-label': t('printer.title') },
    h('div', { class: 'dlg-head' }, h('h2', {}, t('printer.title')), h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('printer.close'), onclick: () => dialog.close() }, icon('close'))),
    h('div', { class: 'dlg-body' },
      h('label', { class: 'dlg-field' }, h('span', {}, t('printer.preset')), select),
      h('div', { class: 'dlg-row' }, bedW, bedH),
      h('div', { class: 'dlg-row' }, field(t('printer.nozzle'), p.nozzleMm, 'nozzleMm'), field(t('printer.density'), p.densityGcm3, 'densityGcm3')),
      h('div', { class: 'dlg-row' }, field(t('printer.layer'), p.layerHeightMm, 'layerHeightMm'), field(t('printer.firstLayer'), p.firstLayerMm, 'firstLayerMm')),
      h('label', { class: 'check' }, mmu, h('span', {}, t('printer.mmu'))),
    ),
    h('div', { class: 'dlg-foot' }, h('button', { class: 'btn primary', type: 'button', onclick: () => dialog.close() }, t('printer.close'))),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
