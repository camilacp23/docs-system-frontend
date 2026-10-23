// ApplicationProvider: loading every page, choosing and remembering the application, reset on sign-out,
// and the online-status hook.
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationProvider } from '../../application/ApplicationProvider';
import { SELECTED_APPLICATION_KEY } from '../../application/selectionStorage';
import { useApplication } from '../../application/useApplication';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import type { ApiClient } from '../../api/client';
import { ApiError } from '../../api/ApiError';
import { SessionManager } from '../../session/SessionManager';
import { SessionProvider } from '../../session/SessionProvider';
import { FakeBackend, FakeLocks } from '../helpers/fakeBackend';

type Application = ReturnType<typeof useApplication>['applications'][number];

function app(id: number, status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE'): Application {
  return {
    id,
    name: `App ${id}`,
    platform: 'Power Apps',
    description: null,
    jiraProjectKey: null,
    status,
    appContextScreen: { id: id * 10, name: 'App' },
    createdBy: { id: 1, name: 'Admin' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function clientFor(pages: Application[][], total = pages.flat().length) {
  const get = vi.fn((_path: string, options?: { query?: { page?: number } }) => {
    const page = options?.query?.page ?? 1;
    return Promise.resolve({
      body: { data: pages[page - 1] ?? [], page, pageSize: 100, total },
      status: 200,
      etag: null,
      location: null,
    });
  });
  return { client: { get } as unknown as ApiClient, get };
}

function Probe() {
  const value = useApplication();
  return (
    <div>
      <span data-testid="status">{value.status}</span>
      <span data-testid="current">{String(value.currentApplicationId)}</span>
      <span data-testid="archived">{String(value.currentApplication?.status === 'ARCHIVED')}</span>
      <span data-testid="count">{value.applications.length}</span>
      <button onClick={() => value.selectApplication(2)}>select 2</button>
      <button onClick={() => value.reload()}>reload</button>
    </div>
  );
}

async function renderSignedIn(client: ApiClient) {
  new FakeBackend().install();
  const manager = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
  await manager.login('ana.mora@dept.local', 'right-password');
  render(
    <SessionProvider manager={manager}>
      <ApplicationProvider client={client}>
        <Probe />
      </ApplicationProvider>
    </SessionProvider>,
  );
  return manager;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApplicationProvider', () => {
  it('chooses the first ACTIVE application without a stored selection and does not store it', async () => {
    const { client } = clientFor([[app(1, 'ARCHIVED'), app(2), app(3)]]);
    await renderSignedIn(client);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('current')).toHaveTextContent('2');
    expect(localStorage.getItem(SELECTED_APPLICATION_KEY)).toBeNull();
  });

  it('chooses the first application when all are archived', async () => {
    const { client } = clientFor([[app(1, 'ARCHIVED'), app(2, 'ARCHIVED')]]);
    await renderSignedIn(client);
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('1'));
    expect(screen.getByTestId('archived')).toHaveTextContent('true');
  });

  it('keeps a stored selection, even an archived one', async () => {
    localStorage.setItem(SELECTED_APPLICATION_KEY, '1');
    const { client } = clientFor([[app(1, 'ARCHIVED'), app(2)]]);
    await renderSignedIn(client);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('current')).toHaveTextContent('1');
    expect(screen.getByTestId('archived')).toHaveTextContent('true');
  });

  it('ignores a stored id that is not in the list or is not valid', async () => {
    localStorage.setItem(SELECTED_APPLICATION_KEY, '99');
    const { client } = clientFor([[app(1), app(2)]]);
    await renderSignedIn(client);
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('1'));
  });

  it('remembers only the id of an explicit selection', async () => {
    const { client } = clientFor([[app(1), app(2)]]);
    await renderSignedIn(client);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    act(() => {
      screen.getByText('select 2').click();
    });
    expect(screen.getByTestId('current')).toHaveTextContent('2');
    expect(localStorage.getItem(SELECTED_APPLICATION_KEY)).toBe('2');
    expect(localStorage).toHaveLength(1);
  });

  it('loads every page', async () => {
    const first = Array.from({ length: 100 }, (_, i) => app(i + 1));
    const second = Array.from({ length: 50 }, (_, i) => app(i + 101));
    const { client, get } = clientFor([first, second], 150);
    await renderSignedIn(client);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('150'));
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1]?.[1]).toEqual({ query: { page: 2, pageSize: 100 } });
  });

  it('works when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { client } = clientFor([[app(1), app(2)]]);
    await renderSignedIn(client);
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('1'));
    act(() => {
      screen.getByText('select 2').click();
    });
    expect(screen.getByTestId('current')).toHaveTextContent('2');
  });

  it('exposes the error and reloads', async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce(new ApiError({ status: 500, code: 'INTERNAL_ERROR' }))
      .mockResolvedValue({
        body: { data: [app(1)], page: 1, pageSize: 100, total: 1 },
        status: 200,
        etag: null,
        location: null,
      });
    await renderSignedIn({ get } as unknown as ApiClient);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
    act(() => {
      screen.getByText('reload').click();
    });
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
  });

  it('drops the data when the session ends', async () => {
    const { client } = clientFor([[app(1)]]);
    const manager = await renderSignedIn(client);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    await act(async () => {
      await manager.logout();
    });
    expect(screen.getByTestId('status')).toHaveTextContent('idle');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('current')).toHaveTextContent('null');
  });

  it('does not load while signed out', () => {
    new FakeBackend().install();
    const { client, get } = clientFor([[app(1)]]);
    const manager = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
    render(
      <SessionProvider manager={manager}>
        <ApplicationProvider client={client}>
          <Probe />
        </ApplicationProvider>
      </SessionProvider>,
    );
    expect(get).not.toHaveBeenCalled();
    expect(screen.getByTestId('status')).toHaveTextContent('idle');
  });
});

describe('useOnlineStatus', () => {
  function Online() {
    return <span data-testid="online">{String(useOnlineStatus())}</span>;
  }

  it('follows the online and offline events', () => {
    const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    render(<Online />);
    expect(screen.getByTestId('online')).toHaveTextContent('true');
    act(() => {
      onLine.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('online')).toHaveTextContent('false');
    act(() => {
      onLine.mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByTestId('online')).toHaveTextContent('true');
  });
});
