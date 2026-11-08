// useJiraTickets: reads the Jira to-dos of a screen (GET /screens/{id}/jira-tickets) as a tree and keeps it.
// useJiraTickets(screenId) -> { status, tree, error, reload, refresh, refreshing, refreshError, clearRefreshError, apply }
//   The read is the local copy (no `refresh`): fast, and the webhook keeps it up to date. It revalidates with the ETag
//   like the screen does (D-72): a raw 304 keeps the copy this hook already has.
//   refresh() asks for `refresh=true`: the server brings the copy up to date from Jira. An answer with `sync.stale` is a
//   normal answer (the degraded state), not an error; a failed call (no connection ...) goes to `refreshError`.
//   apply(tree) puts a tree the page built from a creation in place of the copy.
// Every tree that arrives tells the shell whether Jira is available (`sync.jiraAvailable`, D-100).
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, isApiError } from '../../api/ApiError';
import { getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource, type ApiResource } from '../../api/useApiResource';
import { useJiraStatus } from '../../layout/jiraStatusContext';

import type { JiraTree } from './jiraTypes';

export interface JiraTickets {
  status: ApiResource<JiraTree>['status'];
  tree: JiraTree | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  refresh: () => Promise<JiraTree | null>;
  refreshing: boolean;
  refreshError: string | null;
  clearRefreshError: () => void;
  apply: (tree: JiraTree) => void;
}

export function useJiraTickets(screenId: number): JiraTickets {
  const client = useApi();
  const { report } = useJiraStatus();
  const last = useRef<JiraTree | null>(null);
  const resource = useApiResource<JiraTree>(`jira:${screenId}`, async (signal) => {
    const result = await client.get('/screens/{id}/jira-tickets', {
      path: { id: screenId },
      signal,
    });
    if (result.notModified) {
      if (last.current !== null) return { body: last.current, etag: result.etag };
      throw new ApiError({ status: 502, code: 'UNEXPECTED_RESPONSE' });
    }
    last.current = result.body.data;
    return { body: result.body.data, etag: result.etag };
  });
  const { apply: applyResource, data } = resource;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const jiraAvailable = data?.sync.jiraAvailable;
  useEffect(() => {
    if (jiraAvailable !== undefined) report(jiraAvailable);
  }, [data, jiraAvailable, report]);

  const apply = useCallback(
    (tree: JiraTree) => {
      last.current = tree;
      applyResource(tree, null);
    },
    [applyResource],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const result = await client.get('/screens/{id}/jira-tickets', {
        path: { id: screenId },
        query: { refresh: true },
      });
      if (result.notModified) return last.current;
      apply(result.body.data);
      return result.body.data;
    } catch (thrown) {
      setRefreshError(
        isApiError(thrown)
          ? getThrownMessage(thrown, { element: 'screen' })
          : getThrownMessage(thrown),
      );
      return null;
    } finally {
      setRefreshing(false);
    }
  }, [client, screenId, apply]);

  const clearRefreshError = useCallback(() => {
    setRefreshError(null);
  }, []);

  return {
    status: resource.status,
    tree: data,
    error: resource.error,
    loading: resource.loading,
    reload: resource.reload,
    refresh,
    refreshing,
    refreshError,
    clearRefreshError,
    apply,
  };
}
