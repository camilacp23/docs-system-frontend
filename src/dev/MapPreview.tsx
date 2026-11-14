// MapPreview: development page /dev/map. It renders the dependency map (MapView) over the graphs of the tests, with no
// session and no API, so the design of the map can be looked at and photographed with any amount of elements.
// Query: data=sample (13 elements, the sample of frame S-27, default) | data=large (500 elements, like `npm run
// sandbox:graph`); zoom=<node key> centers and zooms on a node on load; every other parameter is the one of the real page
// (view, types, environment, untraced, focus, depth). The server is imitated by the same pure functions the fake API of the
// tests uses (filterGraph, neighborhoodOf), so the data answers exactly as the API would.
// Like /dev/ui it only exists in development (see devRoutes.ts): in the production build the route is folded away.
import { ReactFlowProvider } from '@xyflow/react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { MapView, type MapSource } from '../modules/dependency-map/MapView';
import { useGraphParams } from '../modules/dependency-map/useGraphParams';
import { filterGraph, neighborhoodOf } from '../test/helpers/graphQueries';
import { makeLargeGraph, sampleGraph } from '../test/helpers/graphFixtures';

export function MapPreview() {
  const [search] = useSearchParams();
  const { params, setParams, clearAll, clearFocus, hasFilters } = useGraphParams();
  const dataset = search.get('data') === 'large' ? 'large' : 'sample';
  const graph = useMemo(
    () => (dataset === 'large' ? makeLargeGraph(500) : sampleGraph()),
    [dataset],
  );

  const data = useMemo(() => {
    if (params.focus !== null) return neighborhoodOf(graph, params.focus.key, params.depth);
    return filterGraph(graph, {
      types: params.types.length < 4 ? params.types : null,
      environment: params.environment === '' ? null : params.environment,
    });
  }, [graph, params]);

  const source: MapSource = { status: 'ready', data, error: null, reload: () => undefined };
  return (
    <div className="flex h-dvh flex-col gap-4 overflow-hidden bg-canvas px-6 py-5">
      <ReactFlowProvider>
        <MapView
          source={source}
          params={params}
          hasFilters={hasFilters}
          setParams={setParams}
          clearAll={clearAll}
          clearFocus={clearFocus}
          applicationId={1}
          zoomToKey={search.get('zoom')}
        />
      </ReactFlowProvider>
    </div>
  );
}
