// lazyPage: the pattern of the pages that are loaded when their route is opened (NFR-11, SDD Table 58).
// Covers the fallback (nothing for 300 ms, then the skeleton, "taking longer" after 10 s), a failed load (the existing
// server-error page with "Try again", never a blank screen), the retry (a NEW import(), because React.lazy keeps a
// rejected promise, and no reload of the document), an error of the page itself (not caught here) and preload().
// The loader is a promise the test settles: nothing here waits for the clock.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChunkLoadError, lazyPage } from '../../app/router/lazyPage';
import { SKELETON_DELAY_MS, SLOW_LOADING_DELAY_MS } from '../../components/ui/useDelayedLoading';
import { expectConsoleError } from '../helpers/expectConsoleError';

function Hello() {
  return <p>Hello page</p>;
}

function Broken(): never {
  throw new Error('page bug');
}

interface Deferred {
  promise: Promise<Record<'Page', React.ComponentType>>;
  resolve: (page?: React.ComponentType) => void;
  reject: (reason: unknown) => void;
}

function deferred(): Deferred {
  let resolve!: Deferred['resolve'];
  let reject!: Deferred['reject'];
  const promise = new Promise<Record<'Page', React.ComponentType>>((res, rej) => {
    resolve = (page = Hello) => {
      res({ Page: page });
    };
    reject = rej;
  });
  return { promise, resolve, reject };
}

const skeletons = () => document.querySelectorAll('.rounded-skeleton');
const networkError = () => new TypeError('Failed to fetch dynamically imported module');

/** What React logs for the error boundary of a failed load: the error and the component it happened in, nothing else. */
const LOAD_FAILED_LOGS = [
  /ChunkLoadError: The code of the page could not be loaded\./,
  /The above error occurred in the <\w+> component/,
];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

describe('while the code arrives', () => {
  it('shows the page, with no skeleton, when the code is already there', async () => {
    const Page = lazyPage(() => Promise.resolve({ Page: Hello }), 'Page');
    render(<Page />);
    expect(await screen.findByText('Hello page')).toBeInTheDocument();
    expect(skeletons()).toHaveLength(0);
  });

  it('draws nothing for 300 ms and then the skeleton, and the page replaces it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    const load = deferred();
    const Page = lazyPage(() => load.promise, 'Page');
    render(<Page />);
    expect(skeletons()).toHaveLength(0);
    await advance(SKELETON_DELAY_MS - 1);
    expect(skeletons()).toHaveLength(0);
    await advance(1);
    expect(skeletons().length).toBeGreaterThan(0);
    expect(screen.queryByText('Hello page')).not.toBeInTheDocument();

    await act(async () => {
      load.resolve();
      await Promise.resolve();
    });
    expect(await screen.findByText('Hello page')).toBeInTheDocument();
    expect(skeletons()).toHaveLength(0);
  });

  it('says it is taking longer than usual after 10 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    const Page = lazyPage(() => deferred().promise, 'Page');
    render(<Page />);
    expect(screen.queryByText('This is taking longer than usual.')).not.toBeInTheDocument();
    await advance(SLOW_LOADING_DELAY_MS);
    expect(screen.getByText('This is taking longer than usual.')).toBeInTheDocument();
  });

  it('does not suspend again when the route is opened a second time', async () => {
    const Page = lazyPage(() => Promise.resolve({ Page: Hello }), 'Page');
    const first = render(<Page />);
    await screen.findByText('Hello page');
    first.unmount();
    render(<Page />);
    expect(screen.getByText('Hello page')).toBeInTheDocument();
  });
});

describe('a load that fails', () => {
  it('shows the server-error page with a way to try again, not a blank screen', async () => {
    const logged = expectConsoleError(...LOAD_FAILED_LOGS);
    const Page = lazyPage(() => Promise.reject(networkError()), 'Page');
    render(<Page />);
    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(skeletons()).toHaveLength(0);
    // No request id, so no reference is mentioned or shown (the text of INTERNAL_ERROR without it).
    expect(screen.getByText('Try again in a moment.')).toBeInTheDocument();
    expect(screen.queryByText(/reference/i)).not.toBeInTheDocument();
    expect(logged.matched.length).toBeGreaterThan(0);
  });

  it('retries with a NEW import and shows the page, without reloading the document', async () => {
    expectConsoleError(...LOAD_FAILED_LOGS);
    const load = vi
      .fn<() => Promise<Record<'Page', React.ComponentType>>>()
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue({ Page: Hello });
    const Page = lazyPage(load, 'Page');
    // Anything outside the page survives a reload only if the document was not reloaded.
    const outside = document.createElement('div');
    outside.dataset.marker = 'kept';
    document.body.append(outside);
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Hello page')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Something went wrong on our side')).not.toBeInTheDocument();
    expect(document.querySelector('[data-marker="kept"]')).toBe(outside);
    outside.remove();
  });

  it('shows the error again when the retry fails too, and the next retry can still load it', async () => {
    expectConsoleError(...LOAD_FAILED_LOGS);
    const load = vi
      .fn<() => Promise<Record<'Page', React.ComponentType>>>()
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue({ Page: Hello });
    const Page = lazyPage(load, 'Page');
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Hello page')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('keeps the new component for the next time the route is opened', async () => {
    expectConsoleError(...LOAD_FAILED_LOGS);
    const load = vi
      .fn<() => Promise<Record<'Page', React.ComponentType>>>()
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue({ Page: Hello });
    const Page = lazyPage(load, 'Page');
    const first = render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await screen.findByText('Hello page');
    first.unmount();
    render(<Page />);
    expect(screen.getByText('Hello page')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('wraps what the browser reported as a ChunkLoadError', () => {
    const cause = networkError();
    const error = new ChunkLoadError(cause);
    expect(error.name).toBe('ChunkLoadError');
    expect(error.cause).toBe(cause);
  });
});

describe('an error of the page itself', () => {
  it('is not caught by the loader: it goes on to the error element of the route', async () => {
    const logged = expectConsoleError(
      /page bug/,
      /The above error occurred in the <Broken> component/,
    );
    const Page = lazyPage(() => Promise.resolve({ Page: Broken }), 'Page');
    const router = createMemoryRouter(
      [{ path: '/', element: <Page />, errorElement: <p>Route error element</p> }],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);
    expect(await screen.findByText('Route error element')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(logged.matched.length).toBeGreaterThan(0);
  });
});

describe('preload', () => {
  it('starts the load and resolves when it is done', async () => {
    const load = vi.fn(() => Promise.resolve({ Page: Hello }));
    const Page = lazyPage(load, 'Page');
    await Page.preload();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not reject when the load fails (the page shows the error when it is opened)', async () => {
    const Page = lazyPage(() => Promise.reject(networkError()), 'Page');
    await expect(Page.preload()).resolves.toBeUndefined();
  });
});
