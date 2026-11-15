// useScreenCount: the number of screens of an application for the application card of the sidebar (D-98).
// useScreenCount(applicationId) -> number | null (null while it is unknown, or if it could not be read: the card
// then simply leaves the number out; the rest of the shell keeps working).
// It is the `total` of GET /screens with pageSize 1, so it includes App (OnStart), which counts in the indicators
// (FR-19). The screens pages call notifyScreensChanged() after creating or deleting one, and the card reads the
// number again.
import { useEffect } from 'react';

import { useApi } from '../api/useApi';
import { useApiResource } from '../api/useApiResource';

const SCREENS_CHANGED_EVENT = 'docs:screens-changed';

/** Tells the application card that a screen was created or deleted. */
export function notifyScreensChanged(): void {
  window.dispatchEvent(new Event(SCREENS_CHANGED_EVENT));
}

export function useScreenCount(applicationId: number | null): number | null {
  const client = useApi();
  const resource = useApiResource<number | null>(
    `screen-count:${applicationId ?? 'none'}`,
    async (signal) => {
      const { body } = await client.get('/screens', {
        query: { applicationId: applicationId ?? 0, page: 1, pageSize: 1 },
        signal,
      });
      return { body: typeof body.total === 'number' ? body.total : null, etag: null };
    },
    applicationId !== null,
  );
  const { reload } = resource;

  useEffect(() => {
    window.addEventListener(SCREENS_CHANGED_EVENT, reload);
    return () => {
      window.removeEventListener(SCREENS_CHANGED_EVENT, reload);
    };
  }, [reload]);

  return applicationId !== null && resource.status === 'ready' ? resource.data : null;
}
