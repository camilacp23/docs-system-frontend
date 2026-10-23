// UnarchiveButton: restores an archived application (S-09b). Administrator only (the API enforces it too).
// 1. GET /applications/{id} for the current representation and its ETag.
// 2. PUT /applications/{id} with EVERY field of ApplicationWrite as it is (the PUT replaces the whole
//    representation: an omitted field is erased) changing only `status` to ACTIVE, with If-Match.
// On success it reloads the applications. On 412 it also reloads and shows the catalog message; any other
// error shows its catalog message. No props.
import { useState } from 'react';

import { isApiError } from '../api/ApiError';
import { getErrorMessage } from '../api/messages';
import { useApi } from '../api/useApi';
import { useApplication } from '../application/useApplication';
import { Button, useToast } from '../components/ui';

export function UnarchiveButton() {
  const client = useApi();
  const { currentApplicationId, reload } = useApplication();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (currentApplicationId === null) return null;

  const unarchive = async () => {
    setLoading(true);
    try {
      const current = await client.get('/applications/{id}', {
        path: { id: currentApplicationId },
      });
      const { name, platform, description, jiraProjectKey } = current.body.data;
      await client.put('/applications/{id}', {
        path: { id: currentApplicationId },
        ifMatch: current.etag ?? undefined,
        body: { name, platform, description, jiraProjectKey, status: 'ACTIVE' },
      });
      reload();
    } catch (error) {
      if (isApiError(error) && error.status === 412) reload();
      const message = isApiError(error) ? getErrorMessage(error, { element: 'application' }) : null;
      if (message) toast.show({ tone: 'warning', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" loading={loading} onClick={() => void unarchive()}>
      Unarchive
    </Button>
  );
}
