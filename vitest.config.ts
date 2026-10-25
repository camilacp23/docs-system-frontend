import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    css: false,
    // The page tests render the whole shell and type into forms: give them room on a busy machine.
    testTimeout: 15000,
  },
});
