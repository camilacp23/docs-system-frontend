// DependencyMapPage: /dependency-map (FR-15, FR-16, NFR-11). Loaded lazily (React.lazy), so React Flow is not part of the
// main bundle. It reads the graph of the selected application (GET /dependencies/graph) or the neighborhood of the
// focused node (GET /dependencies/{type}/{id}), keeps the filters and the focus in the URL and hands the answer to MapView,
// which draws it. Changing the application in the sidebar reloads the map and drops the focus (the focused element belongs
// to the other application, D-78). An application or an element that does not exist shows S-41a (SDD Table 58).
import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { useApplication } from '../../application/useApplication';
import { ErrorState } from '../../components/ui';

import { MapView, type MapSource } from './MapView';
import { useDependencyGraph } from './useDependencyGraph';
import { useGraphParams } from './useGraphParams';

function MapContainer() {
  const navigate = useNavigate();
  const { currentApplicationId } = useApplication();
  const { params, setParams, clearAll, clearFilters, clearFocus, hasFilters } = useGraphParams();
  const { resource, data } = useDependencyGraph({ applicationId: currentApplicationId, params });

  // The selected application changed from the sidebar: the focus belongs to the other application, so it goes (the
  // selection already ignores it: it is tied to the application it was made in).
  const previousApplication = useRef(currentApplicationId);
  useEffect(() => {
    if (previousApplication.current !== currentApplicationId) {
      if (previousApplication.current !== null) clearFocus();
      previousApplication.current = currentApplicationId;
    }
  }, [currentApplicationId, clearFocus]);

  if (resource.error?.code === 'NOT_FOUND') {
    return params.focus !== null ? (
      <ErrorState
        variant="not-found"
        element="element"
        listLabel="Dependency map"
        className="flex-1"
        onAction={clearFocus}
      />
    ) : (
      <ErrorState
        variant="not-found"
        element="application"
        listLabel="Dashboard"
        className="flex-1"
        onAction={() => {
          void navigate('/dashboard');
        }}
      />
    );
  }

  const source: MapSource = {
    status: resource.status,
    data,
    error: resource.error,
    reload: resource.reload,
  };
  return (
    <MapView
      source={source}
      params={params}
      hasFilters={hasFilters}
      setParams={setParams}
      clearAll={clearAll}
      clearFilters={clearFilters}
      clearFocus={clearFocus}
      applicationId={currentApplicationId}
    />
  );
}

export function DependencyMapPage() {
  return (
    <ReactFlowProvider>
      <MapContainer />
    </ReactFlowProvider>
  );
}
