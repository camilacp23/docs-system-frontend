// useDependencyGraph: reads the graph of the selected application, or the neighborhood of the focused node.
// useDependencyGraph({ applicationId, params }) -> { resource, data }
//   Without focus: GET /dependencies/graph?applicationId&types&environment (the `types` list goes through encodeQuery
//   as `style: form, explode: false`; it is left out when every type is shown, and the environment when it is empty).
//   The Screens view needs every type (it counts the components, variables and collections of each screen), so it never
//   sends `types`: that filter belongs to the All elements view.
//   With focus: GET /dependencies/{type}/{id}?depth (no application and no filters: the contract takes none, and the
//   element's application is the one in the response).
//   `data` is the answer of the current request only (null while it loads or after a failure), so the map of another
//   application is never drawn under the selector of this one. It keeps the SAME object while the ETag of the
//   answer does not change: a reload that gets the same graph (the browser revalidates every read and an unchanged
//   graph comes back with the same tag) does not make the page place the map again.
import { useState } from 'react';

import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';

import { NODE_TYPES, PATH_SEGMENT_BY_TYPE, type GraphData } from './graphTypes';
import type { GraphParams } from './useGraphParams';

interface Options {
  applicationId: number | null;
  params: GraphParams;
}

export function graphRequestKey(applicationId: number | null, params: GraphParams): string {
  if (params.focus !== null) return `neighborhood:${params.focus.key}:${params.depth}`;
  // The types are part of the request only in the All elements view and only when they filter something: with every type
  // the graph is the same one the Screens view asks for, so switching between the two does not read it again.
  const types =
    params.view === 'all' && params.types.length < NODE_TYPES.length ? params.types.join(',') : '-';
  return `graph:${applicationId}:${types}:${params.environment}`;
}

export function useDependencyGraph({ applicationId, params }: Options) {
  const client = useApi();
  const { focus, depth, types, environment, view } = params;
  const key = graphRequestKey(applicationId, params);

  const resource = useApiResource<GraphData>(
    key,
    async (signal) => {
      if (focus !== null) {
        const result = await client.get('/dependencies/{type}/{id}', {
          path: { type: PATH_SEGMENT_BY_TYPE[focus.type], id: focus.id },
          query: { depth },
          signal,
        });
        return { body: result.body.data, etag: result.etag };
      }
      const result = await client.get('/dependencies/graph', {
        query: {
          applicationId: applicationId ?? 0,
          ...(view === 'all' && types.length < NODE_TYPES.length ? { types: [...types] } : {}),
          ...(environment !== '' ? { environment } : {}),
        },
        signal,
      });
      return { body: result.body.data, etag: result.etag };
    },
    focus !== null || applicationId !== null,
  );

  // The same answer (same request, same ETag) keeps the same object. Adjusting state while rendering is the pattern
  // React documents for this: the held copy is replaced only when the tag or the request changes.
  const answer = resource.status === 'ready' ? resource.data : null;
  const heldKey = resource.etag === null ? null : `${key}|${resource.etag}`;
  const [held, setHeld] = useState<{ key: string; data: GraphData } | null>(null);
  if (answer !== null && heldKey !== null && held?.key !== heldKey) {
    setHeld({ key: heldKey, data: answer });
  }
  const data = answer !== null && heldKey !== null && held?.key === heldKey ? held.data : answer;

  return { resource, data };
}
