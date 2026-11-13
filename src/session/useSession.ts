// useSession: current session snapshot plus the actions.
// Returns SessionSnapshot & { login(email, password), logout(notice?), replaceUser(user), retryBootstrap() }.
import { useContext, useMemo, useSyncExternalStore } from 'react';

import { SessionContext } from './SessionContext';
import type { EndNotice, SessionSnapshot } from './SessionManager';
import type { components } from '../api/schema';

export interface SessionValue extends SessionSnapshot {
  login: (email: string, password: string) => Promise<components['schemas']['User']>;
  logout: (notice?: EndNotice) => Promise<void>;
  replaceUser: (user: components['schemas']['User']) => void;
  retryBootstrap: () => Promise<void>;
}

export function useSession(): SessionValue {
  const manager = useContext(SessionContext);
  if (manager === null) throw new Error('useSession must be used inside <SessionProvider>');
  const snapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  return useMemo(
    () => ({
      ...snapshot,
      login: (email, password) => manager.login(email, password),
      logout: (notice) => manager.logout(notice ?? null),
      replaceUser: (user) => {
        manager.replaceUser(user);
      },
      retryBootstrap: () => manager.retryBootstrap(),
    }),
    [manager, snapshot],
  );
}
