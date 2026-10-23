// useApi: the authenticated API client for components (ApiContext only replaces it in tests).
// Returns the client bound to the session of this tab.
import { createContext, useContext } from 'react';

import { api } from '../session/instance';

import type { ApiClient } from './client';

export const ApiContext = createContext<ApiClient | null>(null);

export function useApi(): ApiClient {
  return useContext(ApiContext) ?? api;
}
