// useScreenCounts: the two numbers of the list subtitle "N screens · M approved" (S-18).
// Two light reads of GET /screens (pageSize 1: only `total` is used), loaded once per application and reloaded
// with `reload()` after a screen is created or deleted, not with every change of the filters. The total includes
// App (OnStart): it counts in the indicators (FR-19, D-98).
import { useApi } from '../../api/useApi';
import { useApiResource, type ApiResource } from '../../api/useApiResource';

export interface ScreenCounts {
  total: number;
  approved: number;
}

export function useScreenCounts(applicationId: number | null): ApiResource<ScreenCounts> {
  const client = useApi();
  return useApiResource<ScreenCounts>(
    `screen-counts:${applicationId ?? 'none'}`,
    async (signal) => {
      const count = async (extra: { documentationStatus?: 'APPROVED' }) => {
        const { body } = await client.get('/screens', {
          query: { applicationId: applicationId ?? 0, page: 1, pageSize: 1, ...extra },
          signal,
        });
        return body.total;
      };
      const [total, approved] = await Promise.all([
        count({}),
        count({ documentationStatus: 'APPROVED' }),
      ]);
      return { body: { total, approved }, etag: null };
    },
    applicationId !== null,
  );
}
