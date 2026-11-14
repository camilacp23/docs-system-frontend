// useApplicationStatusChange: archive or unarchive an application. PUT /applications/{id} replaces the whole editable
// representation (an omitted description or jiraProjectKey is stored as null), so the call is always the same two
// steps: 1. GET /applications/{id} for the current copy and its ETag, 2. PUT with EVERY field of the contract
// (name, platform, description, jiraProjectKey) as they are, only `status` changed, and If-Match = that ETag.
// useApplicationStatusChange() -> changeStatus(id, status): Promise<Application>; it rejects with the ApiError of the
// step that failed (412 PRECONDITION_FAILED, 404, 403 ...). The caller refreshes the applications of the shell.
import { useCallback } from 'react';

import { useApi } from '../../api/useApi';

import type { Application, ApplicationStatus } from './applicationLabels';

export function useApplicationStatusChange() {
  const client = useApi();
  return useCallback(
    async (id: number, status: ApplicationStatus): Promise<Application> => {
      const current = await client.get('/applications/{id}', { path: { id } });
      const { name, platform, description, jiraProjectKey } = current.body.data;
      const { body } = await client.put('/applications/{id}', {
        path: { id },
        ifMatch: current.etag ?? undefined,
        body: { name, platform, description, jiraProjectKey, status },
      });
      return body.data;
    },
    [client],
  );
}
