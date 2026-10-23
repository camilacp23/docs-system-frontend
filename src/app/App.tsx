// Application root: providers (session, selected application, toasts) around the router.
import { RouterProvider } from 'react-router';

import { ToastProvider } from '../components/ui';
import { ApplicationProvider } from '../application/ApplicationProvider';
import { SessionProvider } from '../session/SessionProvider';

import { router } from './router/router';

export function App() {
  return (
    <SessionProvider>
      <ApplicationProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ApplicationProvider>
    </SessionProvider>
  );
}
