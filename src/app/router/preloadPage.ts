// preloadPage(pathname): starts the load of the page of a lazy route and resolves when its code is here. Tests call it
// before rendering, so the first import in a cold worker (which can take longer than the 1 s of findBy) is waited for as
// work and not against the clock; it is a no-op for a route that is not lazy. LAZY_ROUTES lists the lazy routes.
import { AuditLogPage, DependencyMapPage, ReportsPage, ReviewPage, SearchPage } from './lazyPages';

const LAZY_ROUTES: Record<string, { preload: () => Promise<unknown> }> = {
  '/audit': AuditLogPage,
  '/search': SearchPage,
  '/dependency-map': DependencyMapPage,
  '/reports': ReportsPage,
  '/review': ReviewPage,
};

export function preloadPage(pathname: string): Promise<unknown> {
  return LAZY_ROUTES[pathname]?.preload() ?? Promise.resolve();
}
