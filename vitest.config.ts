import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    css: false,
    // Every test file starts its own jsdom with the whole app. With one worker per core (8) the project machine,
    // which had about 2 GB of its 8 GB free, slowed the tests down 2-3 times and the 1 s waits of findBy / waitFor
    // failed at random (5 of 5 runs had one failure). With three workers 5 of 5 runs pass, in about 40 s.
    maxWorkers: 3,
    // The longest page tests type into dozens of controls; the default 5 s is too tight on a loaded machine. A test
    // that passes ends at once, so this only matters to one that is slow.
    testTimeout: 20_000,
  },
});
