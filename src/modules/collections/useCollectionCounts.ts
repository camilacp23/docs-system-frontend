// useCollectionCounts: the numbers of the counters above the list (S-14): all the collections and those not linked to any
// screen. Two light reads of GET /collections (pageSize 1: only `total` is used), loaded once per application and reloaded
// with `reload()` after a collection is created or deleted, not with every change of the filters.
import { useApi } from '../../api/useApi';
import { useApiResource, type ApiResource } from '../../api/useApiResource';

export interface CollectionCounts {
  total: number;
  /** Collections not linked to any screen (FR-19). */
  undocumented: number;
}

export function useCollectionCounts(applicationId: number | null): ApiResource<CollectionCounts> {
  const client = useApi();
  return useApiResource<CollectionCounts>(
    `collection-counts:${applicationId ?? 'none'}`,
    async (signal) => {
      const count = async (extra: { undocumented?: boolean }) => {
        const { body } = await client.get('/collections', {
          query: { applicationId: applicationId ?? 0, page: 1, pageSize: 1, ...extra },
          signal,
        });
        return body.total;
      };
      const [total, undocumented] = await Promise.all([count({}), count({ undocumented: true })]);
      return { body: { total, undocumented }, etag: null };
    },
    applicationId !== null,
  );
}
