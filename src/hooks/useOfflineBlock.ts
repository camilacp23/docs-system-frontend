// useOfflineBlock: why a write on an account-wide resource (users, applications) is disabled right now.
// useOfflineBlock() -> { blocked, reason }. Unlike useWriteBlock it ignores the selected application: users do not
// belong to one, and PUT /applications is the one write the API accepts on an archived application. Usability only:
// the API decides.
import { useOnlineStatus } from './useOnlineStatus';
import { OFFLINE_WRITE_REASON, type WriteBlock } from './useWriteBlock';

export function useOfflineBlock(): WriteBlock {
  const online = useOnlineStatus();
  return online
    ? { blocked: false, reason: null }
    : { blocked: true, reason: OFFLINE_WRITE_REASON };
}
