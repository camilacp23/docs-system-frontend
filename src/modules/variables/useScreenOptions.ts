// useScreenOptions: every screen of an application (GET /screens, all pages), for the origin screen selectors of
// the variable list filter, the creation modal and the edit page. App (OnStart) comes first (the API lists it
// first). Returns the resource of useApiResource; `data` is the list of screens.
import { useApi } from '../../api/useApi';
import { useApiResource, type ApiResource } from '../../api/useApiResource';

import type { ScreenSummary } from './variableTypes';

const PAGE_SIZE = 100; // maximum allowed by the contract

export function useScreenOptions(applicationId: number | null): ApiResource<ScreenSummary[]> {
  const client = useApi();
  return useApiResource<ScreenSummary[]>(
    `screens:${applicationId ?? 'none'}`,
    async (signal) => {
      const all: ScreenSummary[] = [];
      for (let page = 1; ; page++) {
        const { body } = await client.get('/screens', {
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
