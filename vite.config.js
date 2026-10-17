import { defineConfig } from 'vite';

export default defineConfig({
  // En subcarpetas (GitHub Pages): VITE_BASE=/repo/ npm run build
  base: process.env.VITE_BASE ?? '/',
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    rollupOptions: { output: { manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined) } },
  },
  test: { environment: 'node', include: ['tests/unit/**/*.test.js'], testTimeout: 90000 },
});
