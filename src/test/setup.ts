// Vitest setup: jest-dom matchers and DOM cleanup after each test.
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy and waitFor give up after this long (default 1 s). They return as soon as the condition holds, so a longer limit
// costs nothing when the machine is fast and stops a slow, loaded one (three workers, whole app per file) from failing.
configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
  cleanup();
});
