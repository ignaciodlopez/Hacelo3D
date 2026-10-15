import { test, expect } from '@playwright/test';
import { tools } from '../../src/tools/registry.js';

// Protege la fluidez del visor compartido (src/core/viewer/Viewer.js): al arrastrar se dibuja a 1x
// y al soltar vuelve a la resolución completa. Toda herramienta activa del registro entra en este test.
test.use({ deviceScaleFactor: 2 });

for (const tool of tools.filter((t) => t.status === 'active')) {
  test(`visor fluido al orbitar: ${tool.id}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto(`/#/tool/${tool.id}`);
    await expect(page.locator('.info-line')).toContainText('triángulos', { timeout: 30000 });

    const canvas = page.locator('.viewer-canvas');
    const width = () => canvas.evaluate((c) => c.width);
    const idle = await width();
    const box = await canvas.boundingBox();

    await page.mouse.move(box.x + 300, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(box.x + 500, box.y + 320, { steps: 8 });
    expect(await width()).toBeLessThan(idle);

    await page.mouse.up();
    await expect.poll(width, { timeout: 10000 }).toBe(idle);
  });
}
