// LazyPreview: development page /dev/lazy. It draws a lazily loaded page (lazyPage) inside the static shell of the frames
// with a loader that never answers or always fails, so the fallback of a route that is loading and the page of a failed
// load can be looked at and photographed.
// Query: state=loading (default: the skeleton appears 300 ms after the page opens) | error (the server-error page with
// "Try again"; the retry fails again, so the page stays as it is).
// Like /dev/ui it only exists in development (see devRoutes.ts).
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router';

import { lazyPage } from '../app/router/lazyPage';

import { MockShell } from './MockShell';

type Loaded = Record<'Page', ComponentType>;

const LoadingPage = lazyPage((): Promise<Loaded> => new Promise(() => undefined), 'Page');
const FailingPage = lazyPage(
  (): Promise<Loaded> =>
    Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
  'Page',
);

export function LazyPreview() {
  const [search] = useSearchParams();
  const Page = search.get('state') === 'error' ? FailingPage : LoadingPage;
  return (
    <MockShell activeLabel="Audit log" pageName="Audit log">
      <Page />
    </MockShell>
  );
}
