import { defineConfig } from 'vite';

// `vite build --mode public` (npm run build:public) genera el sitio para clientes SIN el código del modo taller:
// __WORKSHOP__ vale false y el menú de archivos, los exportadores (STL/3MF/ZIP) y el PIN quedan fuera del paquete.
export default defineConfig(({ mode }) => ({
  define: { __WORKSHOP__: JSON.stringify(mode !== 'public') },
  // En subcarpetas (GitHub Pages): VITE_BASE=/repo/ npm run build
  base: process.env.VITE_BASE ?? '/',
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    rollupOptions: { output: { manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined) } },
  },
  test: { environment: 'node', include: ['tests/unit/**/*.test.js'], testTimeout: 90000 },
}));
