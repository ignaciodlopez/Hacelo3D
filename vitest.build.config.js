import { defineConfig } from 'vitest/config';

// Pruebas que compilan el sitio (más lentas): npm run test:build
export default defineConfig({
  define: { __WORKSHOP__: 'true' },
  test: { environment: 'node', include: ['tests/build/**/*.test.js'], testTimeout: 300000, hookTimeout: 300000 },
});
