// useOnboardingSummary: the one read of the onboarding page, GET /onboarding/summary of the selected application (FR-25).
// useOnboardingSummary(applicationId) -> { status ('loading' | 'ready' | 'error'), summary, error, reload }
//   summary  the answer, or null while it belongs to another application (an answer of the previous application never
//            shows; changing the application reads again because the key carries it, D-147). While a retry of the same
//            application is in flight the last answer stays on screen.
// The five steps are drawn from this single answer: moving between steps never reads again. The read revalidates with the
// ETag through the shared client (cache: 'no-cache', D-72). An archived application is read like any other.
import { ApiError } from '../../api/ApiError';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';

import type { OnboardingSummary } from './onboardingModel';

interface Read {
  applicationId: number;
  summary: OnboardingSummary;
}

export function useOnboardingSummary(applicationId: number | null) {
  const client = useApi();
  const id = applicationId ?? 0;
  const resource = useApiResource<Read>(
    `onboarding:${id}`,
    async (signal) => {
      const { body, etag } = await client.get('/onboarding/summary', {
        query: { applicationId: id },
        signal,
      });
      // An answer without the summary is not an onboarding: an error, never a broken page.
      if (!(body.data as OnboardingSummary | undefined)) {
        throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
      }
      return { body: { applicationId: id, summary: body.data }, etag };
    },
    applicationId !== null,
  );
  const own = resource.data?.applicationId === id ? resource.data : null;
  return {
    status: resource.status,
    summary: own?.summary ?? null,
    error: resource.error,
    reload: resource.reload,
  };
}
