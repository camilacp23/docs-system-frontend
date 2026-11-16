// devRoutes: the /dev pages (design showcase, map, dashboard, quick search, lazy loading) exist only in development.
// `import.meta.env.DEV` is a build-time constant: in the production build the list folds to empty and the dynamic imports
// of the pages are dropped, so neither the routes nor their code ship in dist/ (checked on the real build with
// `grep` in dist/assets; this test checks the guard itself in both modes).
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadDevRoutes() {
  vi.resetModules();
  const { devRoutes } = await import('../../app/router/devRoutes');
  return devRoutes;
}

describe('devRoutes', () => {
  it('has every /dev page in development', async () => {
    vi.stubEnv('DEV', true);
    const paths = (await loadDevRoutes()).map((route) => route.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/dev/ui',
        '/dev/dashboard',
        '/dev/quick-search',
        '/dev/lazy',
        '/dev/map',
      ]),
    );
  });

  it('has no route at all outside development', async () => {
    vi.stubEnv('DEV', false);
    expect(await loadDevRoutes()).toEqual([]);
  });
});
