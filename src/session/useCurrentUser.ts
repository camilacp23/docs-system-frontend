// useCurrentUser: the user the page is shown for.
// It is the signed-in user, or the last one while the "Your session ended" dialog (S-43b) is open, so the page
// behind the dialog keeps its shell. It is null after sign out and before the first sign in.
import type { components } from '../api/schema';

import { useSession } from './useSession';

export function useCurrentUser(): components['schemas']['User'] | null {
  const { user, status, endReason, lastUser } = useSession();
  if (user !== null) return user;
  return status === 'anonymous' && endReason !== null && endReason !== 'logout' ? lastUser : null;
}
