// useScreenCounts: the numbers of the counters above the screen list (S-18): all the screens and those Approved, In review
// and Undocumented. Four light reads of GET /screens (pageSize 1: only `total` is used), loaded once per application and
// reloaded with `reload()` after a screen is created or deleted, not with every change of the filters. The total
// includes App (OnStart): it counts in the indicators (FR-19, D-98).
import { useApi } from '../../api/useApi';
import { useApiResource, type ApiResource } from '../../api/useApiResource';

import type { ApiDocumentationStatus } from './screenTypes';

export interface ScreenCounts {
  total: number;
  approved: number;
  inReview: number;
  undocumented: number;
}

export function useScreenCounts(applicationId: number | null): ApiResource<ScreenCounts> {
  const client = useApi();
  return useApiResource<ScreenCounts>(
    `screen-counts:${applicationId ?? 'none'}`,
    async (signal) => {
      const count = async (extra: { documentationStatus?: ApiDocumentationStatus }) => {
        const { body } = await client.get('/screens', {
          query: { applicationId: applicationId ?? 0, page: 1, pageSize: 1, ...extra },
          signal,
        });
        return body.total;
      };
      const [total, approved, inReview, undocumented] = await Promise.all([
        count({}),
        count({ documentationStatus: 'APPROVED' }),
        count({ documentationStatus: 'IN_REVIEW' }),
        count({ documentationStatus: 'UNDOCUMENTED' }),
      ]);
      return { body: { total, approved, inReview, undocumented }, etag: null };
    },
    applicationId !== null,
  );
}
