import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    // three.js alone is about 550 kB minified; that is expected, not a regression.
    chunkSizeWarningLimit: 800,
  },
});
