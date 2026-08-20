import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: import.meta.dirname + '/popup.html',
      },
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: [import.meta.dirname + '/tests/setup.ts'],
  },
});
