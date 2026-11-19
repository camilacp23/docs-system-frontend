// The states of /onboarding (SDD Table 58): the skeleton after 300 ms, a failed read with "Try again", the 404 of an
// application that does not exist, an application with only App (OnStart), the three roles and an archived application.
import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { preloadPage } from '../../app/router/preloadPage';
import { makeEmptySummary, makeSummary } from '../helpers/fakeOnboardingApi';
import { renderOnboarding } from '../helpers/renderOnboarding';
import { makeApplication } from '../helpers/renderApp';
import { settle, setupUser } from '../helpers/setupUser';

const SERVER_ERROR = () =>
  new ApiError({ status: 500, code: 'INTERNAL_ERROR', requestId: 'req-onboarding-1' });
const NOT_FOUND = () =>
  new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'application', id: 1 } });

afterEach(() => {
  vi.useRealTimers();
});

describe('loading', () => {
  it('shows nothing for 300 ms, then a skeleton under the title and the stepper, and the slow notice after 10 s', async () => {
    await preloadPage('/onboarding');
    let slow!: { release: () => void };
    const { router } = await renderOnboarding({
      path: '/screens',
      prepare: (api) => {
        slow = api.hold((call) => call.path === '/onboarding/summary');
      },
    });
    // Only the two timers of the loading states are faked and the clock never moves by itself.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => {
      await router.navigate('/onboarding?step=3');
    });

    // The page is there from the start: the title, the stepper and the title of the step; only the data waits.
    expect(screen.getByRole('heading', { name: 'Onboarding · SAR', level: 1 })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Onboarding steps' })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Read these screens first', level: 2 }),
    ).toBeVisible();
    expect(screen.queryByRole('status', { name: 'Loading the onboarding' })).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(screen.queryByRole('status', { name: 'Loading the onboarding' })).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(screen.getByRole('status', { name: 'Loading the onboarding' })).toBeVisible();
    expect(screen.queryByText('This is taking longer than usual.')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(9700);
      await Promise.resolve();
    });
    expect(screen.getByText('This is taking longer than usual.')).toBeVisible();

    await act(async () => {
      slow.release();
      await Promise.resolve();
    });
    await settle();
    expect(screen.queryByRole('status', { name: 'Loading the onboarding' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Key screens in reading order' })).toBeVisible();
  });

  it('draws no skeleton when the answer is quick', async () => {
    await renderOnboarding({ path: '/onboarding?step=1' });

    await screen.findByRole('region', { name: 'Explore while you read' });
    expect(screen.queryByRole('status', { name: 'Loading the onboarding' })).toBeNull();
  });
});

describe('a failed read', () => {
  it('shows the server-error state with its reference and "Try again" reads again', async () => {
    const user = setupUser();
    const { api } = await renderOnboarding({
      path: '/onboarding?step=2',
      prepare: (fake) => {
        fake.failNext('GET /onboarding/summary', SERVER_ERROR());
      },
    });

    expect(await screen.findByText('Something went wrong on our side')).toBeVisible();
    expect(screen.getByText('req-onboarding-1')).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Onboarding steps' })).not.toBeInTheDocument();
    expect(api.callsTo('GET /onboarding/summary')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('region', { name: 'How SAR starts' })).toBeVisible();
    expect(await screen.findByText('Loads the user, then the catalog.')).toBeVisible();
    expect(api.callsTo('GET /onboarding/summary')).toHaveLength(2);
    // Still step 2: the retry does not move the user.
    expect(screen.getByText('Step 2 of 5')).toBeVisible();
  });

  it('keeps the step in the URL after the failure, so a retry comes back to the same step', async () => {
    const { router } = await renderOnboarding({
      path: '/onboarding?step=4',
      prepare: (fake) => {
        fake.failNext('GET /onboarding/summary', SERVER_ERROR());
      },
    });
    await screen.findByText('Something went wrong on our side');

    expect(router.state.location.search).toBe('?step=4');
  });

  it('shows the page and not the error state when the read of another application failed before', async () => {
    const user = setupUser();
    await renderOnboarding({
      path: '/onboarding?step=1',
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
      summaries: { 1: makeSummary(), 2: makeSummary({ application: { id: 2, name: 'Billing' } }) },
      prepare: (fake) => {
        fake.failNext('GET /onboarding/summary', SERVER_ERROR());
      },
    });
    await screen.findByText('Something went wrong on our side');

    // Another application is another key: its own read, its own result.
    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    expect(
      await screen.findByRole('region', { name: 'What Billing is and how it is documented' }),
    ).toBeVisible();
  });
});

describe('an application that does not exist', () => {
  it('shows "This application doesn\'t exist" and its button reads the applications again', async () => {
    const user = setupUser();
    const { apps } = await renderOnboarding({
      path: '/onboarding',
      prepare: (fake) => {
        fake.failNext('GET /onboarding/summary', NOT_FOUND());
      },
    });

    expect(await screen.findByText("This application doesn't exist")).toBeVisible();
    expect(
      screen.getByText('It may have been deleted. Its history stays in the audit log.'),
    ).toBeVisible();
    const before = apps.get.mock.calls.filter(([path]) => path === '/applications').length;

    await user.click(screen.getByRole('button', { name: 'Back to Dashboard' }));

    expect(apps.get.mock.calls.filter(([path]) => path === '/applications').length).toBeGreaterThan(
      before,
    );
  });

  it('is what the API answers for an application without a summary', async () => {
    await renderOnboarding({ summaries: {} });

    expect(await screen.findByText("This application doesn't exist")).toBeVisible();
  });
});

describe('an application with only App (OnStart)', () => {
  it('keeps the overview with its zeros and says each empty list in its own step', async () => {
    await renderOnboarding({ path: '/onboarding', summaries: { 1: makeEmptySummary() } });

    const card = await screen.findByRole('region', {
      name: 'What SAR is and how it is documented',
    });
    expect(
      within(card)
        .getAllByRole('definition')
        .map((item) => item.textContent),
    ).toEqual(['1', '0', '0', '0']);
    expect(within(card).getByText('0.0% approved')).toBeVisible();
    expect(within(card).getByText('screen')).toBeVisible();

    const user = setupUser();
    await user.click(
      within(screen.getByRole('navigation', { name: 'Onboarding steps' })).getByRole('link', {
        name: /Key screens/,
      }),
    );
    expect(screen.getByText('No key screens yet')).toBeVisible();
    await user.click(
      within(screen.getByRole('navigation', { name: 'Onboarding steps' })).getByRole('link', {
        name: /Critical variables/,
      }),
    );
    expect(screen.getByText('No global variables yet')).toBeVisible();
    await user.click(
      within(screen.getByRole('navigation', { name: 'Onboarding steps' })).getByRole('link', {
        name: /Most used components/,
      }),
    );
    expect(screen.getByText('No components use variables or collections yet')).toBeVisible();
  });
});

describe('the three roles and an archived application', () => {
  it.each(['ADMINISTRATOR', 'DEVELOPER', 'READER'] as const)(
    'a %s sees the same five steps with the same data',
    async (role) => {
      const user = setupUser();
      await renderOnboarding({ role, path: '/onboarding' });

      expect(
        await screen.findByRole('region', { name: 'What SAR is and how it is documented' }),
      ).toBeVisible();
      expect(screen.getByText('41.7% approved')).toBeVisible();

      for (const [label, list] of [
        ['Key screens', 'Key screens in reading order'],
        ['Critical variables', 'Critical variables by use'],
        ['Most used components', 'Components by use'],
      ] as const) {
        await user.click(
          within(screen.getByRole('navigation', { name: 'Onboarding steps' })).getByRole('link', {
            name: new RegExp(`^${label}`),
          }),
        );
        expect(screen.getByRole('list', { name: list })).toBeVisible();
      }
      expect(screen.queryByText("You don't have access to this page")).not.toBeInTheDocument();
    },
  );

  it('an archived application looks like any other: same title, steps and data', async () => {
    await renderOnboarding({
      path: '/onboarding?step=3',
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });

    expect(await screen.findByRole('list', { name: 'Key screens in reading order' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Onboarding · SAR', level: 1 })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Inicio' })).toBeVisible();
  });
});

describe('the title of the page', () => {
  it('names the selected application and says who the page is for', async () => {
    await renderOnboarding({
      applications: [makeApplication(1, { name: 'SAR', platform: 'Power Apps' })],
    });

    expect(
      await screen.findByRole('heading', { name: 'Onboarding · SAR', level: 1 }),
    ).toBeVisible();
    expect(
      screen.getByText(
        'For developers new to the team: how SAR is built, read from its own documentation.',
      ),
    ).toBeVisible();
  });

  it('takes the platform of the introduction from the application, never from the frame', async () => {
    await renderOnboarding({
      applications: [makeApplication(1, { name: 'SAR', platform: 'Power Pages' })],
    });

    expect(await screen.findByText(/^SAR is a Power Pages application\./)).toBeVisible();
  });
});
