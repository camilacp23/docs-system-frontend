// useCollectionScreens: reads the screens that use a collection (GET /dependencies/collections/{id}?depth=1, D-103)
// and groups them by screen. useCollectionScreens(collectionId, scope) -> the resource of useApiResource whose `data` is
// ScreenUsage[]. `scope` keeps two readers apart (the card of the detail and the delete confirmation each read it
// when they open, so the confirmation never shows a count older than the moment it was opened).
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';

import { groupScreenUsage, type ScreenUsage } from './screenUsage';

export function useCollectionScreens(collectionId: number, scope: 'card' | 'delete') {
  const client = useApi();
  return useApiResource<ScreenUsage[]>(
    `collection-screens:${scope}:${collectionId}`,
    async (signal) => {
      const { body, etag } = await client.get('/dependencies/{type}/{id}', {
        path: { type: 'collections', id: collectionId },
        query: { depth: 1 },
        signal,
      });
      return { body: groupScreenUsage(body.data, collectionId), etag };
    },
  );
}
