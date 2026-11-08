// useScreen: reads one screen (GET /screens/{id}) and keeps its copy fresh with the ETag (D-72).
// useScreen(id) -> the resource of useApiResource; `data` is the Screen, `etag` its ETag.
// The read always revalidates: the HTTP layer sends cache: 'no-cache', so the browser asks the server with the
// ETag it holds and a 304 reaches the page as the copy it already has. If a 304 ever arrives raw (the call
// carried its own If-None-Match), the copy of this hook for the same screen is kept instead of failing; a 304
// with no copy to keep is an unexpected answer. A reload (Try again) goes through the same path.
// apply(screen, etag) takes the screen a write answered (status, review) as the current copy, with its new ETag,
// and keeps it as the copy a later 304 falls back to.
import { useCallback, useRef } from 'react';

import { ApiError } from '../../api/ApiError';
import { useApi } from '../../api/useApi';
import { useApiResource, type ApiResource } from '../../api/useApiResource';

import type { Screen } from './screenTypes';

export function useScreen(id: number | null): ApiResource<Screen> {
  const client = useApi();
  const last = useRef<{ id: number; body: Screen; etag: string | null } | null>(null);
  const resource = useApiResource<Screen>(
    `screen:${id}`,
    async (signal) => {
      const result = await client.get('/screens/{id}', { path: { id: id ?? 0 }, signal });
      if (result.notModified) {
        const copy = last.current;
        if (copy?.id === id) return { body: copy.body, etag: result.etag ?? copy.etag };
        throw new ApiError({ status: 502, code: 'UNEXPECTED_RESPONSE' });
      }
      const body = result.body.data;
      last.current = { id: body.id, body, etag: result.etag };
      return { body, etag: result.etag };
    },
    id !== null,
  );
  const { apply: applyResource } = resource;
  const apply = useCallback(
    (body: Screen, etag: string | null) => {
      last.current = { id: body.id, body, etag };
      applyResource(body, etag);
    },
    [applyResource],
  );
  return { ...resource, apply };
}
