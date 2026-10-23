// instance: the session manager and the API client of the running app (one of each per tab).
// The manager does nothing until SessionProvider calls start(). Tests build their own instances instead.
import { createApiClient } from '../api/client';

import { SessionManager } from './SessionManager';

export const sessionManager = new SessionManager();
export const api = createApiClient(sessionManager);
