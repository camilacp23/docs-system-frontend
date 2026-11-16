// useReportCounts: the two numbers of the filter "All · N / Published · M" (S-33, D-136).
// useReportCounts(applicationId, enabled) -> ApiResource<{ all: number | null; published: number | null }>
//   Two light reads of GET /reports with pageSize=1 (with and without published=true), only for the roles that filter
//   (Administrator and Developer). If one fails its number is null and the filter shows no number; the other stays.
//   `reload()` reads both again (after generating or publishing).
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';

export interface ReportCounts {
  all: number | null;
  published: number | null;
}

export function useReportCounts(applicationId: number | null, enabled: boolean) {
  const client = useApi();
  return useApiResource<ReportCounts>(
    `report-counts:${applicationId ?? 'none'}`,
    async (signal) => {
      const read = (published?: boolean) =>
        client
          .get('/reports', {
            query: {
              applicationId: applicationId ?? 0,
              page: 1,
              pageSize: 1,
              ...(published !== undefined && { published }),
            },
            signal,
          })
          .then((answer) => answer.body.total);
      const [all, published] = await Promise.allSettled([read(), read(true)]);
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return {
        body: {
          all: all.status === 'fulfilled' ? all.value : null,
          published: published.status === 'fulfilled' ? published.value : null,
        },
        etag: null,
      };
    },
    enabled && applicationId !== null,
  );
}
