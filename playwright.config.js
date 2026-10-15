import { defineConfig, devices } from '@playwright/test';

// E2E_PREVIEW=1 prueba el build de producción en vez del servidor de desarrollo
const PREVIEW = !!process.env.E2E_PREVIEW;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: PREVIEW ? 'http://localhost:4173' : 'http://localhost:5173',
    acceptDownloads: true,
    locale: 'es-AR',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], launchOptions: {} } },
  ],
  webServer: PREVIEW
    ? { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 120000 }
    : { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60000 },
});
