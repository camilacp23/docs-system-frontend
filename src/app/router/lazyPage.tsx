// lazyPage: the pattern of a page that is loaded when its route is opened, so its code is not part of the main bundle.
// lazyPage(load, name) -> a component (no props) to use as the page of a route:
//   const ReportsPage = lazyPage(() => import('../../modules/reports/ReportsPage'), 'ReportsPage');
//   ... PAGES['/reports'] = <ReportsPage />;       (lazyPages.tsx holds the list)
// It carries `.preload()`, which starts the load (tests use it so the first import of a cold worker is waited for as
// work, not against the clock; a page may also be preloaded on hover).
// While the code arrives: RouteFallback (a skeleton after 300 ms, Table 58). If the load FAILS (the network, a deploy
// that removed the old file): the existing server-error page with "Try again" inside the shell, never a blank screen.
// React.lazy keeps a rejected promise forever, so a retry builds a NEW lazy component (a new import()); the document is
// not reloaded and what the user had in the shell stays. An error of the page itself (not of the load) is not caught here:
// it goes on to the route's error element (S-41c, with the reference of the API error).
import { Component, lazy, Suspense, useState } from 'react';
import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';

import { ErrorState } from '../../components/ui';

import { RouteFallback } from './RouteFallback';

/** The code of a page could not be loaded; `cause` is what the browser reported. */
export class ChunkLoadError extends Error {
  constructor(cause: unknown) {
    super('The code of the page could not be loaded.', { cause });
    this.name = 'ChunkLoadError';
  }
}

interface LoadBoundaryProps {
  onRetry: () => void;
  children: ReactNode;
}

class LoadBoundary extends Component<LoadBoundaryProps, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    // Only a failed load is handled here; anything else goes on to the route's error element.
    if (!(error instanceof ChunkLoadError))
      throw error instanceof Error
        ? error
        : new Error('The page failed to render.', { cause: error });
    return <ErrorState variant="server-error" className="flex-1" onAction={this.props.onRetry} />;
  }
}

export type LazyPage = (() => ReactNode) & { preload: () => Promise<unknown> };

export function lazyPage<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
): LazyPage {
  const create = (): LazyExoticComponent<ComponentType> =>
    lazy(() =>
      load().then(
        (module) => ({ default: module[name] }),
        (cause: unknown) => {
          throw new ChunkLoadError(cause);
        },
      ),
    );
  // Shared by every mount of the page: once it is loaded, going back to the route does not suspend again.
  let shared = create();

  function Page() {
    const [attempt, setAttempt] = useState(0);
    const [Current, setCurrent] = useState(() => shared);
    const retry = () => {
      shared = create();
      setCurrent(() => shared);
      setAttempt((count) => count + 1);
    };
    return (
      <LoadBoundary key={attempt} onRetry={retry}>
        <Suspense fallback={<RouteFallback />}>
          <Current />
        </Suspense>
      </LoadBoundary>
    );
  }

  const preload = () => load().catch(() => undefined);
  return Object.assign(Page, { preload });
}
