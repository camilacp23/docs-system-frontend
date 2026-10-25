// useVariableOptions: every variable of an application (GET /variables, all pages), for the variable selector of the
// assignments in the collection edit page. Returns the resource of useApiResource; `data` is the list of variables.
import { useApi } from '../../api/useApi';
import { useApiResource, type ApiResource } from '../../api/useApiResource';
import type { VariableSummary } from '../variables/variableTypes';

const PAGE_SIZE = 100; // maximum allowed by the contract

export function useVariableOptions(applicationId: number | null): ApiResource<VariableSummary[]> {
  const client = useApi();
  return useApiResource<VariableSummary[]>(
    `variable-options:${applicationId ?? 'none'}`,
    async (signal) => {
      const all: VariableSummary[] = [];
      for (let page = 1; ; page++) {
        const { body } = await client.get('/variables', {
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
