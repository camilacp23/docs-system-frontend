// useOnboardingProgress: the steps of the onboarding that the user completed in the selected application (FR-25, contract 0.4.0).
// useOnboardingProgress(applicationId) -> { status ('loading' | 'ready' | 'error'), completed, error, reload, saving, complete(step), reset() }
//   completed  the steps (1 to 5) of the answer, ascending and without repeats, or null while they are not known (loading, a failed
//              read, or an answer that belongs to another application: the progress is personal AND per application, so it is read
//              again when the application changes and an answer of the previous one never shows). It can have gaps ([1, 3]).
//   complete   PUT /onboarding/progress/steps/{step}: idempotent, answers the whole progress, which replaces the local state (no new GET).
//   reset      DELETE /onboarding/progress: forgets every step of the user in this application; the state becomes [].
//   saving     'step' | 'reset' while a write is in flight (the buttons are disabled), null otherwise.
// The writes throw the ApiError of the API; the page says it with the catalog text. Nothing is stored in the browser.
import { useState } from 'react';

import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';

interface Read {
  applicationId: number;
  completed: number[];
}

export function useOnboardingProgress(applicationId: number | null) {
  const client = useApi();
  const id = applicationId ?? 0;
  const [saving, setSaving] = useState<'step' | 'reset' | null>(null);
  const resource = useApiResource<Read>(
    `onboarding-progress:${id}`,
    async (signal) => {
      const { body, etag } = await client.get('/onboarding/progress', {
        query: { applicationId: id },
        signal,
      });
      return { body: { applicationId: id, completed: [...body.data.completedSteps] }, etag };
    },
    applicationId !== null,
  );
  const own = resource.data?.applicationId === id ? resource.data : null;
  const { apply } = resource;

  const complete = async (step: number) => {
    setSaving('step');
    try {
      const { body, etag } = await client.put('/onboarding/progress/steps/{step}', {
        path: { step },
        query: { applicationId: id },
      });
      apply({ applicationId: id, completed: [...body.data.completedSteps] }, etag);
    } finally {
      setSaving(null);
    }
  };

  const reset = async () => {
    setSaving('reset');
    try {
      await client.delete('/onboarding/progress', { query: { applicationId: id } });
      apply({ applicationId: id, completed: [] }, null);
    } finally {
      setSaving(null);
    }
  };

  return {
    status: resource.status,
    completed: own?.completed ?? null,
    error: resource.error,
    reload: resource.reload,
    saving,
    complete,
    reset,
  };
}
