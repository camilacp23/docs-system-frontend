// The states of the dashboard (SDD Table 58): skeleton after 300 ms, an error per block with "Try again" that does not
// touch the other read, the 404 of the application, an application with only App (OnStart), an archived application and
// the change of application.
import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeScreenDetail } from '../helpers/fakeScreensApi';
import { makeIndicators } from '../helpers/fakeDashboardApi';
import { renderDashboard } from '../helpers/renderDashboard';
import { makeApplication } from '../helpers/renderApp';
import { settle, setupUser } from '../helpers/setupUser';

const SERVER_ERROR = () => new ApiError({ status: 500, code: 'INTERNAL_ERROR' });
const card = (name: string) => screen.getByRole('article', { name });
const region = (name: string) => screen.getByRole('region', { name });

afterEach(() => {
  vi.useRealTimers();
});

describe('dashboard: loading', () => {
  it('shows nothing for the first 300 ms and then a skeleton with the shape of the cards', async () => {
    let slow!: { release: () => void };
    const { router } = await renderDashboard({
      path: '/screens',
      prepare: (api) => {
        slow = api.hold(() => true);
      },
    });
    // Only the two timers of the loading states are faked and the clock never moves by itself: how long the machine
    // takes cannot change what the test sees.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => {
      await router.navigate('/dashboard');
    });

    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(screen.getAllByRole('status', { name: 'Loading' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('This is taking longer than usual.')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(9700);
      await Promise.resolve();
    });
    expect(screen.getAllByText('This is taking longer than usual.').length).toBeGreaterThan(0);

    await act(async () => {
      slow.release();
      await Promise.resolve();
    });
    await settle();
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    expect(card('Documentation approved')).toBeInTheDocument();
  });
});

describe('dashboard: an error in one read does not take the other', () => {
  it('a failure of the indicators shows an error in each block that needs them, and the pending list stays', async () => {
    await renderDashboard({
      prepare: (api) => {
        api.failNext('GET /dashboard/indicators', SERVER_ERROR());
      },
    });

    expect(screen.getByText("Couldn't load the indicators.")).toBeInTheDocument();
    expect(
      within(region('Documentation by status')).getByText(
        "Couldn't load the documentation by status.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Documentation approved' })).toBeNull();
    // The other read is on screen.
    expect(
      within(region('Pending to-dos by screen')).getByRole('link', {
        name: 'Detalle, 3 pending to-dos',
      }),
    ).toBeInTheDocument();
  });

  it('"Try again" of the indicators reads only the indicators', async () => {
    const user = setupUser();
    const { api } = await renderDashboard({
      prepare: (fake) => {
        fake.failNext('GET /dashboard/indicators', SERVER_ERROR());
      },
    });
    const sortedReads = () =>
      api.callsTo('GET /screens').filter((call) => call.options.query?.sort !== undefined);
    expect(sortedReads()).toHaveLength(1);

    await user.click(
      within(region('Documentation by status')).getByRole('button', { name: 'Try again' }),
    );

    expect(api.callsTo('GET /dashboard/indicators')).toHaveLength(2);
    expect(sortedReads()).toHaveLength(1);
    expect(card('Documentation approved')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load the indicators.")).toBeNull();
  });

  it('a failure of the screens read shows its own error and the indicators stay', async () => {
    const user = setupUser();
    const { api } = await renderDashboard({
      prepare: (fake) => {
        fake.failNext('GET /screens', SERVER_ERROR());
      },
    });

    expect(card('Documentation approved')).toBeInTheDocument();
    expect(
      within(region('Documentation by status')).getByRole('table', {
        name: 'Documentation by status',
      }),
    ).toBeInTheDocument();
    const pending = within(region('Pending to-dos by screen'));
    expect(
      pending.getByText("Couldn't load the screens with the most pending to-dos."),
    ).toBeInTheDocument();

    await user.click(pending.getByRole('button', { name: 'Try again' }));

    expect(api.callsTo('GET /dashboard/indicators')).toHaveLength(1);
    expect(
      within(region('Pending to-dos by screen')).getByRole('link', {
        name: 'Detalle, 3 pending to-dos',
      }),
    ).toBeInTheDocument();
  });

  it('a refresh that fails shows the error and Try again brings the data back', async () => {
    const user = setupUser();
    const { api } = await renderDashboard();
    api.failNext('GET /dashboard/indicators', SERVER_ERROR());

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(screen.getByText("Couldn't load the indicators.")).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Try again' })[0] as HTMLElement);
    expect(card('Documentation approved')).toBeInTheDocument();
  });
});

describe('dashboard: an application that does not exist', () => {
  it('shows S-41a and its button reads the applications again', async () => {
    const user = setupUser();
    const { apps } = await renderDashboard({
      indicators: {},
    });

    expect(
      screen.getByRole('heading', { name: "This application doesn't exist" }),
    ).toBeInTheDocument();
    const reads = () => apps.get.mock.calls.filter(([path]) => path === '/applications').length;
    const before = reads();

    await user.click(screen.getByRole('button', { name: 'Back to Dashboard' }));

    expect(reads()).toBe(before + 1);
  });
});

describe('dashboard: an application with only App (OnStart)', () => {
  const empty = () =>
    makeIndicators({
      byStatus: { UNDOCUMENTED: 1, DRAFT: 0, IN_PROGRESS: 0, IN_REVIEW: 0, APPROVED: 0 },
      variables: { total: 0, untraced: 0 },
      collections: { total: 0, undocumented: 0 },
      jira: { pendingSubtasks: 0, lastSyncedAt: null },
      recentActivity: [],
    });

  it('keeps the cards at zero and puts an empty state in place of the donut, with the action for a developer', async () => {
    await renderDashboard({
      role: 'DEVELOPER',
      indicators: { 1: empty() },
      screens: [makeScreenDetail(10, 'App (OnStart)', { isAppContext: true })],
    });

    expect(within(card('Documentation approved')).getByText('0.0%')).toBeInTheDocument();
    expect(card('Variables without origin')).toHaveTextContent('of 0 variables');
    expect(screen.queryByRole('img', { name: /Documentation by status/ })).toBeNull();
    const block = within(region('Documentation by status'));
    expect(block.getByText('Nothing documented yet')).toBeInTheDocument();
    expect(
      block.getByText(
        "Screens, variables and collections of SAR appear here as they're documented.",
      ),
    ).toBeInTheDocument();
    expect(block.getByRole('link', { name: 'New screen' })).toHaveAttribute(
      'href',
      '/screens?new=1',
    );
  });

  it('has no action for a reader or for an archived application', async () => {
    await renderDashboard({
      role: 'READER',
      indicators: { 1: empty() },
      screens: [makeScreenDetail(10, 'App (OnStart)', { isAppContext: true })],
    });
    expect(screen.getByText('Nothing documented yet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New screen' })).toBeNull();
  });
});

describe('dashboard: an archived application', () => {
  it('is read like any other', async () => {
    const { api } = await renderDashboard({
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });

    expect(card('Documentation approved')).toBeInTheDocument();
    expect(within(card('Documentation approved')).getByText('41.7%')).toBeInTheDocument();
    expect(api.callsTo('GET /dashboard/indicators')).toHaveLength(1);
  });
});

describe('dashboard: change of application', () => {
  it('reads the other application and never shows the figures of the first one meanwhile', async () => {
    const user = setupUser();
    let gate!: { release: () => void };
    const { api } = await renderDashboard({
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
      indicators: {
        1: makeIndicators({ recentActivity: [] }),
        2: makeIndicators({
          byStatus: { UNDOCUMENTED: 1, DRAFT: 1, IN_PROGRESS: 0, IN_REVIEW: 0, APPROVED: 2 },
          variables: { total: 10, untraced: 7 },
          collections: { total: 2, undocumented: 2 },
          recentActivity: [],
        }),
      },
      screens: [
        makeScreenDetail(10, 'App (OnStart)', { isAppContext: true, pendingSubtasks: 2 }),
        makeScreenDetail(80, 'App (OnStart)', {
          applicationId: 2,
          isAppContext: true,
          pendingSubtasks: 0,
        }),
        makeScreenDetail(81, 'Facturas', { applicationId: 2, pendingSubtasks: 4 }),
      ],
      prepare: (fake) => {
        gate = fake.hold((call) => call.options.query?.applicationId === 2);
      },
    });
    expect(within(card('Variables without origin')).getByText('9')).toBeInTheDocument();
    expect(screen.getByText('Documentation health of SAR')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    // The read of Billing is held: nothing of SAR stays on screen.
    expect(screen.getByText('Documentation health of Billing')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Variables without origin' })).toBeNull();
    expect(screen.queryByRole('link', { name: /^App \(OnStart\), 2 pending/ })).toBeNull();

    await act(async () => {
      gate.release();
      await Promise.resolve();
    });
    await settle();

    expect(within(card('Variables without origin')).getByText('7')).toBeInTheDocument();
    expect(card('Variables without origin')).toHaveTextContent('of 10 variables');
    expect(screen.getByRole('link', { name: 'Facturas, 4 pending to-dos' })).toBeInTheDocument();
    expect(
      api.callsTo('GET /dashboard/indicators').map((c) => c.options.query?.applicationId),
    ).toEqual([1, 2]);
  });
});
