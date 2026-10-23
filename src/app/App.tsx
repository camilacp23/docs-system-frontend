// Application root: providers (session, then selected application) around the router. The shell arrives in F-03.
import { RouterProvider } from 'react-router';

import { ApplicationProvider } from '../application/ApplicationProvider';
import { SessionProvider } from '../session/SessionProvider';

import { router } from './router/router';

export function App() {
  return (
    <SessionProvider>
      <ApplicationProvider>
        <RouterProvider router={router} />
      </ApplicationProvider>
    </SessionProvider>
  );
}
