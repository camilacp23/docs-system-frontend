// SessionContext: React context holding the SessionManager. Use useSession() instead of reading it directly.
import { createContext } from 'react';

import type { SessionManager } from './SessionManager';

export const SessionContext = createContext<SessionManager | null>(null);
