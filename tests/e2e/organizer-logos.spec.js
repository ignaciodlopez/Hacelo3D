import { test, expect } from './fixtures.js';
import { initKernel } from '../../src/core/kernel/manifold.js';
import { build } from '../../src/tools/organizer/build.js';
import { defaults } from '../../src/tools/organizer/params.js';
import { BRANDS } from '../../src/tools/organizer/brands.js';

test('los diez logos reales se convierten en sólidos válidos en la tapa y el frente', async ({ page }) => {
  test.skip(!!process.env.E2E_PREVIEW, 'Esta integración importa el conversor fuente; organizer.spec.js cubre el build de producción.');
  test.setTimeout(120000);
  await page.goto('/');
  // Usa el mismo SVGLoader y los mismos archivos que el selector de marcas.
  const logoPolys = await page.evaluate(async () => {
    const { loadLogoCatalog, loadLogoPolygons } = await import('/src/core/ui/iconPolygons.js');
    return Object.fromEntries(await Promise.all((await loadLogoCatalog()).map(async ({ id }) => [id, await loadLogoPolygons(id)])));
  });
  const K = await initKernel();
  for (const { id } of BRANDS) {
    expect(logoPolys[id]?.length, id).toBeGreaterThan(0);
    const section = new K.CrossSection(logoPolys[id], 'NonZero');
    expect(section.area(), id).toBeGreaterThan(0);
    section.delete();
    for (const [kind, logoStyle] of [['case', 'flush'], ['box', 'relief']]) {
      const result = await build(K, { ...defaults, kind, logoStyle, logo: id, curveQuality: 'draft' }, { logoPolys, printer: {} });
      expect(result.messages.filter((m) => m.level === 'error' || m.code === 'organizer.logoMissing'), `${id} ${kind}`).toEqual([]);
      const item = result.items.find((item) => item.parts.some((p) => p.colorKey === 'logo'));
      expect(item, `${id} ${kind}: logo presente`).toBeTruthy();
      expect(item.merged.status, `${id} ${kind}`).toBe('NoError');
      for (const part of item.parts) {
        expect(part.status, `${id} ${kind} ${part.colorKey}`).toBe('NoError');
        expect(part.volumeMm3, `${id} ${kind} ${part.colorKey}`).toBeGreaterThan(0);
      }
      const sum = item.parts.reduce((s, part) => s + part.volumeMm3, 0);
      expect(Math.abs(sum - item.merged.volumeMm3) / item.merged.volumeMm3, `${id} ${kind}: sin solapamientos`).toBeLessThan(0.002);
    }
  }
});
