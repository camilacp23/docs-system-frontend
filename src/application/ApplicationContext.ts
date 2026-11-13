// ApplicationContext: React context of the selected application. Use useApplication().
import { createContext } from 'react';

import type { ApiError } from '../api/ApiError';
import type { components } from '../api/schema';

export type Application = components['schemas']['Application'];

export interface ApplicationValue {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: ApiError | null;
  applications: Application[];
  /** The selected application, also when it is ARCHIVED; null while loading or when none exists. */
  currentApplication: Application | null;
  /** Id to send as `applicationId` in element listings and creations. */
  currentApplicationId: number | null;
  selectApplication: (id: number) => void;
  /** Reads the list again, showing nothing until it arrives (after an error, for example). */
  reload: () => void;
  /** Reads the list again keeping the current one on screen: after creating, editing or archiving an application. */
  refresh: () => void;
}

export const ApplicationContext = createContext<ApplicationValue | null>(null);
