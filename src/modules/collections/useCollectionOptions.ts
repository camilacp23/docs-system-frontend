// useCollectionOptions: every collection of an application (GET /collections, all pages), for the "Derived from"
// selection of the collection edit page. Returns the resource of useApiResource; `data` is the list of collections.
import { useApi } from '../../api/useApi';
import { useApiResource, type ApiResource } from '../../api/useApiResource';

import type { CollectionSummary } from './collectionTypes';

const PAGE_SIZE = 100; // maximum allowed by the contract

export function useCollectionOptions(
  applicationId: number | null,
): ApiResource<CollectionSummary[]> {
  const client = useApi();
  return useApiResource<CollectionSummary[]>(
    `collection-options:${applicationId ?? 'none'}`,
    async (signal) => {
      const all: CollectionSummary[] = [];
      for (let page = 1; ; page++) {
        const { body } = await client.get('/collections', {
          query: { applicationId: applicationId ?? 0, page, pageSize: PAGE_SIZE },
          signal,
        });
        all.push(...body.data);
        if (body.data.length === 0 || all.length >= body.total) return { body: all, etag: null };
      }
    },
    applicationId !== null,
  );
}
