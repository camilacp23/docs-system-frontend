// Application root: mounts the router. Providers and the shell arrive in F-03.
import { RouterProvider } from 'react-router';

import { router } from './router/router';

export function App() {
  return <RouterProvider router={router} />;
}
