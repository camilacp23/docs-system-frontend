// LazyDependencyMapPage: the route element of /dependency-map. The map is the only page that needs React Flow and
// dagre, so it is loaded when the route is opened and neither library is part of the main bundle (NFR-11).
// Nothing is drawn while the chunk arrives: it is small and local, and a skeleton here would flash before the page's
// own loading state (SDD Table 58). No props.
import { lazy, Suspense } from 'react';

const DependencyMapPage = lazy(() =>
  import('./DependencyMapPage').then((module) => ({ default: module.DependencyMapPage })),
);

export function LazyDependencyMapPage() {
  return (
    <Suspense fallback={null}>
      <DependencyMapPage />
    </Suspense>
  );
}
