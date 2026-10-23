// SessionProvider: starts the session manager (recovers the session with POST /auth/refresh) and exposes it.
// Props: children; manager (optional, tests only; defaults to the app instance).
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { SessionContext } from './SessionContext';
import { sessionManager } from './instance';
import type { SessionManager } from './SessionManager';

interface SessionProviderProps {
  children: ReactNode;
  manager?: SessionManager;
}

export function SessionProvider({ children, manager = sessionManager }: SessionProviderProps) {
  useEffect(() => {
    manager.start();
    return () => {
      manager.stop();
    };
  }, [manager]);

  return <SessionContext value={manager}>{children}</SessionContext>;
}
