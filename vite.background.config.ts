import { defineConfig } from 'vite';

// MV3 service worker: bundled as a classic (IIFE) script for maximal
// compatibility across Chrome and Firefox.
export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: {
      entry: import.meta.dirname + '/src/background/background.ts',
      formats: ['iife'],
      name: 'FillFasterBackground',
      fileName: () => 'background.js',
    },
  },
});
