// useReviewCount: the number on the Review item of the sidebar (S-36 draws it): how many screens of the selected
// application are In review, for the Administrator and the Developer (the Reader has no Review item).
// useReviewCount(applicationId, enabled) -> number | null (null while it is unknown, when it could not be read, or when
// it belongs to another application than the one asked for: the item then simply leaves the number out and the rest of
// the menu keeps working).
// It is the `total` of GET /screens with documentationStatus=IN_REVIEW and pageSize 1 (the same count the queue lists, App
// (OnStart) included). It is read again, with no polling, when:
//  - the application changes (a new key),
//  - a screen enters or leaves review: the pages call notifyReviewChanged() after submitting, withdrawing, approving or
//    returning (from the detail or from the queue),
//  - the browser tab becomes visible again (visibilitychange), because someone else may have decided meanwhile.
// While it is read again the last number stays on screen (no flicker); a failed read hides it.
import { useEffect } from 'react';

import { useApi } from '../api/useApi';
import { useApiResource } from '../api/useApiResource';

const REVIEW_CHANGED_EVENT = 'docs:review-changed';

/** Tells the menu that a screen entered or left review, so the counter is read again. */
export function notifyReviewChanged(): void {
  window.dispatchEvent(new Event(REVIEW_CHANGED_EVENT));
}

interface Counted {
  applicationId: number;
  total: number;
}

export function useReviewCount(applicationId: number | null, enabled: boolean): number | null {
  const client = useApi();
  const active = enabled && applicationId !== null;
  const resource = useApiResource<Counted | null>(
    `review-count:${applicationId ?? 'none'}`,
    async (signal) => {
      const { body } = await client.get('/screens', {
        query: {
          applicationId: applicationId ?? 0,
          documentationStatus: 'IN_REVIEW',
          page: 1,
          pageSize: 1,
        },
        signal,
      });
      return {
        body:
          typeof body.total === 'number'
            ? { applicationId: applicationId ?? 0, total: body.total }
            : null,
        etag: null,
      };
    },
    active,
  );
  const { reload } = resource;

  useEffect(() => {
    if (!active) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    window.addEventListener(REVIEW_CHANGED_EVENT, reload);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(REVIEW_CHANGED_EVENT, reload);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, reload]);

  if (!active || resource.status === 'error') return null;
  const counted = resource.data;
  return counted !== null && counted.applicationId === applicationId ? counted.total : null;
}
