// useVariableKpis: the four counters above the variable list (all, global, context, without origin screen).
// They are four light reads of GET /variables (pageSize 1: only `total` is used), loaded once per application
// and reloaded with `reload()` after a variable is created or deleted, not with every change of the filters.
import { useApi } from '../../api/useApi';
import { useApiResource, type ApiResource } from '../../api/useApiResource';

export interface VariableKpis {
  total: number;
  global: number;
  context: number;
  untraced: number;
}

export function useVariableKpis(applicationId: number | null): ApiResource<VariableKpis> {
  const client = useApi();
  return useApiResource<VariableKpis>(
    `variable-kpis:${applicationId ?? 'none'}`,
    async (signal) => {
      const count = async (extra: { scope?: 'GLOBAL' | 'CONTEXT'; untraced?: boolean }) => {
        const { body } = await client.get('/variables', {
          query: { applicationId: applicationId ?? 0, page: 1, pageSize: 1, ...extra },
          signal,
        });
        return body.total;
      };
      const [total, global, context, untraced] = await Promise.all([
        count({}),
        count({ scope: 'GLOBAL' }),
        count({ scope: 'CONTEXT' }),
        count({ untraced: true }),
      ]);
      return { body: { total, global, context, untraced }, etag: null };
    },
    applicationId !== null,
  );
}
