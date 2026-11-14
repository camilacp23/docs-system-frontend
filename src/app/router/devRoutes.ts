// Development-only routes. `import.meta.env.DEV` is a build-time constant: in production the whole expression
// folds to an empty list and the dynamic imports below are dropped, so /dev/* code never ships in dist/.
// /dev/ui: the design-system showcase. /dev/map: the dependency map over test data (see src/dev/MapPreview.tsx).
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
      {
        path: '/dev/map',
        lazy: async () => {
          const { MapPreview } = await import('../../dev/MapPreview');
          return { Component: MapPreview };
        },
      },
    ]
  : [];
