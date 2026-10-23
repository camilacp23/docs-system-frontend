// Minimal router: the placeholder home page plus the development routes. Replaced by the D-57 route table in F-03.
import { createBrowserRouter } from 'react-router';

import { devRoutes } from './devRoutes';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <main>
        <h1>Documentación técnica</h1>
      </main>
    ),
  },
  ...devRoutes,
]);
