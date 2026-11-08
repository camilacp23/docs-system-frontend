// Vitest setup: jest-dom matchers and DOM cleanup after each test.
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Only on the CI runner (2 processors): a full app render under load can take over the default 1 s of findBy /
// waitFor (see vitest.config.ts). Locally the default stays.
// (The app's tsconfig has no Node types, so the variable is read through a typed view of globalThis.)
const runtime = globalThis as { process?: { env: Record<string, string | undefined> } };
if (runtime.process?.env.CI) configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
});
