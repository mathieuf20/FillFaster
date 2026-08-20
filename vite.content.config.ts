import { defineConfig } from 'vite';

// Content scripts cannot be ES modules in the manifest, so the content
// entry is bundled separately as an IIFE. Run after the main build
// (emptyOutDir disabled so the popup output is kept).
export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: {
      entry: import.meta.dirname + '/src/content/content.ts',
      formats: ['iife'],
      name: 'FillFasterContent',
      fileName: () => 'content-script.js',
    },
  },
});
