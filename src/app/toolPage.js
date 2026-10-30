// Página de una herramienta: panel de parámetros + visor 3D + información + descargas.

import { h } from '../core/ui/dom.js';
import { icon, brandIcon } from './icons.js';
import { t, tr } from './i18n.js';
import { onThemeChange, isDark } from './theme.js';
import { panelFromSchema } from '../core/ui/panelFromSchema.js';
import { createToolState } from '../core/state/toolState.js';
import { encodeShare } from '../core/state/persistence.js';
import { Viewer } from '../core/viewer/Viewer.js';
import { createWorkerClient } from '../core/worker/workerClient.js';
import { getPrinter, onPrinterChange } from '../core/printer/store.js';
import { createFilesMenu } from './filesMenu.js';
import { downloadBlob } from '../core/export/download.js';
import { safeName } from '../core/export/filename.js';
import { registerUploadedFont } from '../core/fonts/catalog.js';
import { loadIconCatalog, loadIconPolygons, loadLogoCatalog, loadLogoPolygons } from '../core/ui/iconPolygons.js';
import { openOrderDialog } from './orderDialog.js';
import { loadShopConfig } from './shopConfig.js';
import { isWorkshop, onWorkshopChange } from './workshop.js';

const DEBOUNCE_MS = 150;
const MAX_RENDERED = 60;

export function mountToolPage(container, tool, route) {
  const state = createToolState(tool, route.params.get('p'));
  const client = createWorkerClient();
  let viewer = null;
  let lastResult = null;
  let timer = null;
  let disposed = false;

  // ---------- panel
  const onFontUpload = async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      const id = `upload-${safeName(file.name.replace(/\.[^.]+$/, ''), 'fuente')}`;
      registerUploadedFont({ id, name: file.name.replace(/\.[^.]+$/, ''), category: 'upload', thin: false, recommendedBold: 0, buffer: buffer.slice(0) });
      await client.addFont(id, buffer);
      return id;
    } catch (err) {
      showError(String(err?.message ?? err));
      return null;
    }
  };
  const panel = panelFromSchema(tool.schema, state, { onFontUpload, toolId: tool.id });

  // ---------- barra de presets / acciones
  const presetSel = h(
    'select',
    { class: 'select', id: 'preset-select', onchange: (e) => applyPreset(e.target.value) },
    h('option', { value: '' }, t('app.preset.none')),
    tool.presets.map((p) => h('option', { value: p.id }, tr(p.name))),
  );
  /** Params que quedan al aplicar `preset` sobre los actuales `cur`. */
  function presetParams(preset, cur) {
    // lo que la herramienta marca en `presetKeep` (medidas de tu hardware, colores…) se conserva, salvo que el preset lo pise
    const keep = Object.fromEntries((tool.presetKeep ?? []).filter((k) => !(k in preset.params)).map((k) => [k, cur[k]]));
    return { ...tool.defaults, ...preset.params, ...keep, text: cur.text, batchText: cur.batchText, mode: cur.mode };
  }
  function applyPreset(id) {
    const preset = tool.presets.find((p) => p.id === id);
    if (!preset) return;
    state.replace(presetParams(preset, state.params));
  }
  // El selector muestra el preset activo mientras los params coincidan con él; al tocar cualquier cosa vuelve a "Personalizado".
  function syncPreset() {
    const cur = state.params;
    const norm = tool.normalize ?? ((p) => p);
    const now = JSON.stringify(cur);
    const active = tool.presets.find((p) => JSON.stringify(norm({ ...tool.defaults, ...presetParams(p, cur) })) === now);
    presetSel.value = active ? active.id : '';
  }
  const undoBtn = h('button', { class: 'icon-btn', type: 'button', title: t('app.undo'), 'aria-label': t('app.undo'), onclick: () => state.undo() }, icon('undo', 18));
  const redoBtn = h('button', { class: 'icon-btn', type: 'button', title: t('app.redo'), 'aria-label': t('app.redo'), onclick: () => state.redo() }, icon('redo', 18));
  /** Enlace que reproduce el diseño actual (sin las claves sensibles). */
  const shareUrl = () => `${location.origin}${location.pathname}#/tool/${tool.id}?p=${encodeShare(state.shareParams, tool.paramsVersion, tool.defaults)}`;
  const shareBtn = h(
    'button',
    {
      class: 'icon-btn',
      type: 'button',
      title: t('app.share'),
      'aria-label': t('app.share'),
      onclick: async () => {
        const url = shareUrl();
        try {
          await navigator.clipboard.writeText(url);
          toast(t('app.shared'));
        } catch {
          prompt(t('app.share'), url);
        }
      },
    },
    icon('link', 18),
  );
  const resetBtn = h('button', { class: 'link-btn', type: 'button', onclick: () => state.reset() }, t('app.reset'));
  const presetLabel = h('label', { class: 'preset-label', for: 'preset-select' }, t('app.preset'));
  const bar = h('div', { class: 'panel-bar' }, presetLabel, presetSel, undoBtn, redoBtn, shareBtn, resetBtn);
  syncPreset();

  // ---------- visor
  const viewerBox = h('div', { class: 'viewer-box' });
  const overlay = h('div', { class: 'viewer-overlay', hidden: true });
  const chips = h('div', { class: 'color-chips' });
  const toolbar = h(
    'div',
    { class: 'viewer-toolbar' },
    h('button', { class: 'icon-btn', type: 'button', title: t('viewer.center'), 'aria-label': t('viewer.center'), onclick: () => viewer?.fitView() }, icon('center', 18)),
    h('button', { class: 'icon-btn', type: 'button', title: t('viewer.top'), 'aria-label': t('viewer.top'), onclick: () => viewer?.fitView('top') }, icon('top', 18)),
    h('button', { class: 'icon-btn', type: 'button', title: t('viewer.bottom'), 'aria-label': t('viewer.bottom'), onclick: () => viewer?.fitView('bottom') }, icon('bottom', 18)),
    h('button', { class: 'icon-btn', type: 'button', title: t('viewer.png'), 'aria-label': t('viewer.png'), onclick: capture }, icon('camera', 18)),
  );
  const plateLabel = h('span', { class: 'plate-label' });
  const plateBar = h(
    'div',
    { class: 'plate-bar', hidden: true },
    h('button', { class: 'icon-btn', type: 'button', title: t('viewer.platePrev'), 'aria-label': t('viewer.platePrev'), onclick: () => gotoPlate(-1) }, '◀'),
    plateLabel,
    h('button', { class: 'icon-btn', type: 'button', title: t('viewer.plateNext'), 'aria-label': t('viewer.plateNext'), onclick: () => gotoPlate(1) }, '▶'),
  );
  viewerBox.append(overlay, toolbar, chips, plateBar);

  // ---------- pie: info + mensajes + botones
  const infoLine = h('div', { class: 'info-line', 'aria-live': 'polite' });
  const colorInfo = h('div', { class: 'color-info' });
  const msgList = h('ul', { class: 'messages', 'aria-live': 'polite' });
  // Dos públicos: el cliente ve un solo botón grande (pedir por WhatsApp); quien fabrica activa el "modo taller" y suma
  // el menú de archivos, los gramos, los cambios de color y el perfil de la impresora. Si la tienda oculta el botón de
  // pedido (config.json), la herramienta queda en modo taller.
  let shopCfg = { shopName: '', whatsapp: '', showOrderButton: true };
  const showTech = () => __WORKSHOP__ && (isWorkshop() || !shopCfg.showOrderButton);
  /** Avisos que explican cómo imprimir: a un cliente no le sirven. */
  const WORKSHOP_ONLY = new Set(['size.bedOverflow', 'color.needsMMU', 'lamp.wallHow', 'lamp.vaseHow', 'lamp.screw', 'mate.measure', 'mate.use', 'mate.selfSupport', 'organizer.caseAssembly', 'organizer.logoSeparate']);

  // Pedido por WhatsApp: abre un diálogo con el resumen del diseño y el enlace; el número sale de public/config.json
  const btnOrder = h(
    'button',
    {
      class: 'btn whatsapp',
      type: 'button',
      onclick: async () =>
        openOrderDialog({
          tool,
          params: state.params,
          result: lastResult,
          link: shareUrl(),
          config: await loadShopConfig(),
          icons: state.params.icon ? await loadIconCatalog() : [],
          logos: state.params.logo ? await loadLogoCatalog() : [],
          onSent: () => toast(t('order.sent')),
        }),
    },
    brandIcon('whatsapp', 22),
    t('order.button'),
  );
  const orderNote = h('p', { class: 'actions-note' }, t('order.note'));

  // Menú "Archivos" (solo en la compilación completa: en la pública no existe ni su código)
  const files = __WORKSHOP__ ? createFilesMenu({ run: (exporter, needsMerged) => doExport(exporter, needsMerged) }) : null;

  const actions = h('div', { class: 'actions', role: 'group', 'aria-label': t('order.button') }, h('div', { class: 'actions-main' }, btnOrder, files?.el), orderNote);
  /** Muestra u oculta lo que corresponde al público actual. */
  function applyAudience() {
    btnOrder.hidden = orderNote.hidden = !shopCfg.showOrderButton;
    if (files) files.el.hidden = !showTech();
    if (!showTech()) files?.close();
    if (lastResult) render(lastResult);
  }
  loadShopConfig().then((cfg) => {
    shopCfg = cfg;
    if (!disposed) applyAudience();
  });
  const foot = h('div', { class: 'stage-foot' }, h('div', { class: 'foot-info' }, infoLine, colorInfo, msgList), actions);
  const toastEl = h('div', { class: 'toast', role: 'status', hidden: true });

  const page = h(
    'div',
    { class: 'tool-page' },
    h('header', { class: 'tool-head' }, h('a', { class: 'back', href: '#/' }, icon('back', 16), t('app.back')), h('h1', {}, tr(tool.name)), h('p', { class: 'sub' }, tr(tool.description))),
    h(
      'div',
      { class: 'tool-grid' },
      h('aside', { class: 'panel-col' }, bar, panel.el),
      h('section', { class: 'stage' }, viewerBox, foot),
    ),
    toastEl,
  );
  container.replaceChildren(page);

  try {
    viewer = new Viewer(viewerBox);
    viewer.setTheme(isDark());
    viewer.onSlow = ({ fps, gpu }) => {
      if (disposed) return;
      const close = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('app.close'), onclick: () => notice.remove() }, icon('close', 16));
      const notice = h('div', { class: 'viewer-notice', role: 'status' }, h('p', {}, t('viewer.slow', { fps, gpu: gpu || '—' })), close);
      viewerBox.append(notice);
    };
  } catch (err) {
    viewerBox.append(h('p', { class: 'viewer-fallback' }, `WebGL: ${err?.message ?? err}`));
  }

  // ---------- generación
  let lastMs = 0;
  let lastChange = 0;
  let finalTimer = null;
  let currentPlate = 0;

  // Mientras se arrastra/teclea rápido y la generación es lenta, se previsualiza en calidad
  // borrador y al soltar se regenera en la calidad elegida.
  function schedule() {
    const now = performance.now();
    const rapid = now - lastChange < 350;
    lastChange = now;
    clearTimeout(timer);
    clearTimeout(finalTimer);
    const useDraft = rapid && lastMs > 150 && state.params.curveQuality !== 'draft';
    timer = setTimeout(() => generate(useDraft), DEBOUNCE_MS);
    if (useDraft) finalTimer = setTimeout(() => generate(false), 500);
    undoBtn.disabled = !state.canUndo;
    redoBtn.disabled = !state.canRedo;
    syncPreset();
  }

  /** Lo que el worker no puede armar solo (los polígonos del ícono y del logo salen del SVG, que se lee en este hilo). */
  async function buildExtra(params) {
    const extra = {};
    if (params.icon) {
      const polys = await loadIconPolygons(params.icon);
      if (polys) extra.iconPolys = { [params.icon]: polys };
    }
    if (params.logo) {
      const polys = await loadLogoPolygons(params.logo);
      if (polys) extra.logoPolys = { [params.logo]: polys };
    }
    return extra;
  }

  async function generate(draft = false) {
    if (disposed) return;
    showOverlay(t('app.loading'));
    try {
      const params = draft ? { ...state.params, curveQuality: 'draft' } : state.params;
      const res = await client.build(tool.id, params, getPrinter(), await buildExtra(params));
      if (res.stale || disposed) return;
      lastResult = res.result;
      lastMs = res.result.ms ?? 0;
      render(res.result);
      hideOverlay();
    } catch (err) {
      if (disposed) return;
      hideOverlay();
      showError(String(err?.message ?? err));
    }
  }

  function render(result) {
    const hasGeom = result.items.length > 0;
    const plates = result.plates ?? null;
    if (plates) currentPlate = Math.min(currentPlate, plates.length - 1);
    plateBar.hidden = !(plates && plates.length > 1);
    if (plates) plateLabel.textContent = t('viewer.plate', { n: currentPlate + 1, total: plates.length });
    viewer?.setBed(result.bed ?? null);
    if (hasGeom) {
      const shown = plates ? plates[currentPlate].items.slice(0, MAX_RENDERED).map((i) => result.items[i]) : result.items;
      viewer?.setItems(shown);
    } else viewer?.clear();
    if (!hasGeom) showOverlay(t('app.empty'), true);
    [files?.button, btnOrder].forEach((b) => b && (b.disabled = !hasGeom));

    // medidas
    infoLine.replaceChildren();
    if (hasGeom) {
      const first = result.items[0];
      const dims = (s) => s.map((n) => n.toFixed(1)).join(' × ');
      const density = getPrinter().densityGcm3;
      const grams = result.items.reduce((sum, it) => sum + it.parts.reduce((v, p) => v + p.volumeMm3, 0), 0) / 1000 * density;
      const rest = [`${result.info.triangles} ${t('info.triangles')}`, `~${grams.toFixed(1)} g`];
      // con piezas distintas (p. ej. pantalla y base) se muestra la medida de cada una, no solo la de la primera
      const pieceSizes = result.info.pieceSizes;
      // `info.sizeMm`: la medida de lo armado cuando no es la de la primera pieza (p. ej. el estuche cerrado)
      const lead = `${t('info.size')}: ${pieceSizes ? pieceSizes.map((s) => `${t(`color.${s.key}`)} ${dims(s.sizeMm)}`).join(' · ') : dims(result.info.sizeMm ?? first.sizeMm)} mm`;
      // triángulos y gramos son datos de taller; el cliente ve solo la medida
      infoLine.append(h('strong', { class: 'info-main' }, result.items.length > 1 ? `${t('info.pieces', { n: result.items.length })} · ${lead}` : lead), showTech() ? ` · ${rest.join(' · ')}` : '');
    }

    // colores (chips para mostrar/ocultar) y cambios de color
    chips.replaceChildren();
    const seen = new Map();
    for (const item of result.items) for (const p of item.parts) seen.set(p.colorKey, p.color);
    if (seen.size > 1) {
      for (const [key, color] of seen) {
        const cb = h('input', { type: 'checkbox', checked: true, 'aria-label': t(`color.${key}`), onchange: (e) => viewer?.setColorVisible(key, e.target.checked) });
        chips.append(h('label', { class: 'chip-color' }, cb, h('span', { class: 'dot', style: { background: color } }), t(`color.${key}`)));
      }
    }
    // ZIP y 3MF solo valen con más de un color (o varias piezas)
    const multi = seen.size > 1 || result.items.length > 1;
    files?.setMulti(multi);
    colorInfo.replaceChildren();
    if (!showTech()) {
      /* instrucciones de impresión: solo en modo taller */
    } else if (hasGeom && result.info.colorChanges && result.info.colorChanges.length) {
      colorInfo.append(
        h('strong', {}, t('info.colorChanges')),
        h(
          'ul',
          {},
          result.info.colorChanges.map((c) => h('li', {}, t('info.changeAt', { layer: c.layer, z: c.zMm, color: t(`color.${c.toColorKey}`) }))),
        ),
      );
    } else if (hasGeom && result.info.needsMMU) {
      colorInfo.append(h('p', {}, t('info.needsMMU')));
    }

    // mensajes
    msgList.replaceChildren(
      ...result.messages
        .filter((m) => m.code !== 'text.empty' && (showTech() || !WORKSHOP_ONLY.has(m.code)))
        .map((m) => h('li', { class: `msg ${m.level}` }, icon(m.level === 'info' ? 'info' : 'warn', 16), t(`msg.${m.code}`, m.params ?? {}))),
    );
  }

  function gotoPlate(delta) {
    const n = lastResult?.plates?.length ?? 0;
    if (n < 2) return;
    currentPlate = (currentPlate + delta + n) % n;
    render(lastResult);
    viewer?.fitView();
  }

  function showOverlay(text, persistent = false) {
    overlay.textContent = text;
    overlay.hidden = false;
    overlay.classList.toggle('persistent', persistent);
  }
  function hideOverlay() {
    overlay.hidden = true;
  }
  function showError(message) {
    msgList.replaceChildren(h('li', { class: 'msg error' }, icon('warn', 16), t('msg.build.error', { message })));
  }
  let toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 2200);
  }

  async function doExport(fn, needsMerged = false) {
    if (!lastResult?.items?.length) return;
    try {
      let result = lastResult;
      if (needsMerged && result.items.some((it) => !it.merged)) {
        // la vista previa no trae la pieza unida: se genera completa (con los parámetros de ahora, en su calidad)
        showOverlay(t('app.loading'));
        const params = state.params;
        result = (await client.buildFull(tool.id, params, getPrinter(), await buildExtra(params))).result;
        hideOverlay();
        if (disposed || !result?.items?.length) return;
      }
      const out = fn(result, tool.filePrefix);
      downloadBlob(out.data, out.filename, out.type);
    } catch (err) {
      hideOverlay();
      showError(`${t('export.error')}: ${err?.message ?? err}`);
    }
  }

  async function capture() {
    const blob = await viewer?.screenshot();
    if (blob) downloadBlob(blob, `${tool.filePrefix}-${safeName(state.params.text ?? lastResult?.items?.[0]?.name, 'modelo')}.png`, 'image/png');
  }

  const onKey = (e) => {
    const target = e.target;
    if (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === 'text')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? state.redo() : state.undo();
    }
  };
  document.addEventListener('keydown', onKey);

  const unsubState = state.subscribe(schedule);
  const unsubPrinter = onPrinterChange(schedule);
  const unsubTheme = onThemeChange((dark) => viewer?.setTheme(dark));
  undoBtn.disabled = true;
  redoBtn.disabled = true;
  [files?.button, btnOrder].forEach((b) => b && (b.disabled = true));
  const unsubWorkshop = onWorkshopChange(applyAudience);
  applyAudience();
  generate();

  return {
    dispose() {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(finalTimer);
      document.removeEventListener('keydown', onKey);
      unsubState();
      unsubPrinter();
      unsubTheme();
      unsubWorkshop();
      files?.close();
      panel.dispose();
      client.dispose();
      viewer?.dispose();
    },
  };
}
