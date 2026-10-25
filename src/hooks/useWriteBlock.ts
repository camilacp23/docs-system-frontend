// useWriteBlock: why a write action (create, edit, delete, save) is disabled right now, if it is.
// useWriteBlock() -> { blocked, reason }. `reason` is the text to show next to the disabled control (the page
// subtitle of S-09b for an archived application, the S-46 copy when offline), or null when writing is allowed.
// This is usability only: the API enforces both rules (APPLICATION_ARCHIVED, NFR-03).
import { useApplication } from '../application/useApplication';

import { useOnlineStatus } from './useOnlineStatus';

export const ARCHIVED_WRITE_REASON = 'Read-only: the application is archived.';
export const OFFLINE_WRITE_REASON =
  "You're offline. Changes can't be saved until the connection is back.";

export interface WriteBlock {
  blocked: boolean;
  reason: string | null;
}

export function useWriteBlock(): WriteBlock {
  const { currentApplication } = useApplication();
  const online = useOnlineStatus();
  const reason =
    currentApplication?.status === 'ARCHIVED'
      ? ARCHIVED_WRITE_REASON
      : online
        ? null
        : OFFLINE_WRITE_REASON;
  return { blocked: reason !== null, reason };
}
