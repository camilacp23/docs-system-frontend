// Development-only routes. `import.meta.env.DEV` is a build-time constant: in production the whole expression
// folds to an empty list and the dynamic import below is dropped, so /dev/* code never ships in dist/.
import type { RouteObject } from 'react-router';

export const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/ui',
        lazy: async () => {
          const { UiShowcase } = await import('../../dev/UiShowcase');
          return { Component: UiShowcase };
        },
      },
    ]
  : [];
