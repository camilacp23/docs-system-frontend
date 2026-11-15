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
    // The GitHub runner (ubuntu-24.04, private repositories) has only 2 processors, so three workers plus the
    // main process starve each other. CI (defined by GitHub Actions) gets 2 workers; local runs keep 3.
    // Even so, a full render of the app measured under load took 1.1-1.5 s up to its first element, over the
    // 1 s of findBy / waitFor, so src/test/setup.ts gives those waits 3 s only when CI is defined.
    // Review both if the runner changes. testTimeout is untouched.
    maxWorkers: process.env.CI ? 2 : 3,
  },
});
