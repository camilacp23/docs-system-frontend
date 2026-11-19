// The path of /onboarding in the URL (D-147, D-148): `?step=` and the history (the browser's Back and Forward), an invalid step,
// the stepper (aria-current, the done marks and the progress taken from the saved steps, keyboard), the focus
// on the title of the step, one read per application and the restart of the path when the application changes.
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeSummary } from '../helpers/fakeOnboardingApi';
import { renderOnboarding } from '../helpers/renderOnboarding';
import { makeApplication } from '../helpers/renderApp';
import { setupUser } from '../helpers/setupUser';

const TITLES: Record<number, string> = {
  1: 'What SAR is and how it is documented',
  2: 'How SAR starts',
  3: 'Read these screens first',
  4: 'Variables to know first',
  5: 'Components that use the most data',
};

const title = (step: number) => screen.getByRole('heading', { name: TITLES[step], level: 2 });
const stepper = () => screen.getByRole('navigation', { name: 'Onboarding steps' });
const progress = () => screen.getByRole('progressbar', { name: 'Progress' });

async function open(path: string, saved?: number[]) {
  const view = await renderOnboarding({
    path,
    ...(saved !== undefined && { progress: { 1: saved } }),
  });
  await screen.findByRole('region', { name: 'Explore while you read' });
  return view;
}

describe('the step in the URL', () => {
  it('shows step 1 without a parameter and leaves the URL alone', async () => {
    const { router } = await open('/onboarding');

    expect(title(1)).toBeVisible();
    expect(screen.getByText('Step 1 of 5')).toBeVisible();
    expect(router.state.location.search).toBe('');
    expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Next:/ })).not.toBeInTheDocument();
  });

  it.each([1, 2, 3, 4, 5])('shows step %i when the URL says so', async (step) => {
    await open(`/onboarding?step=${step}`);

    expect(title(step)).toBeVisible();
    expect(screen.getByText(`Step ${step} of 5`)).toBeVisible();
  });

  it.each(['0', '6', 'abc', '2.5', '', '-1', '01', '1e1', '3 '])(
    'replaces the invalid step "%s" by ?step=1 without adding a history entry',
    async (raw) => {
      const { router } = await renderOnboarding({
        path: `/onboarding?step=${encodeURIComponent(raw)}`,
      });
      await screen.findByRole('region', { name: 'Explore while you read' });

      expect(router.state.location.search).toBe('?step=1');
      expect(router.state.historyAction).toBe('REPLACE');
      expect(title(1)).toBeVisible();
      expect(screen.getByText('Step 1 of 5')).toBeVisible();
    },
  );
});

describe('the stepper and the history', () => {
  it('a step of the stepper opens it as one history entry; there are no Back / Next buttons', async () => {
    const user = setupUser();
    const { router } = await open('/onboarding?step=3');

    expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Next:/ })).not.toBeInTheDocument();
    await user.click(within(stepper()).getByRole('link', { name: /Critical variables/ }));
    expect(router.state.location.search).toBe('?step=4');
    expect(router.state.historyAction).toBe('PUSH');
    expect(title(4)).toBeVisible();

    await user.click(within(stepper()).getByRole('link', { name: /Key screens/ }));
    expect(router.state.location.search).toBe('?step=3');
    expect(title(3)).toBeVisible();
  });

  it('the browser Back and Forward walk the steps', async () => {
    const user = setupUser();
    const { router } = await open('/onboarding');
    await user.click(within(stepper()).getByRole('link', { name: /How the app starts/ }));
    await user.click(within(stepper()).getByRole('link', { name: /Key screens/ }));
    expect(title(3)).toBeVisible();

    await act(async () => {
      await router.navigate(-1);
    });
    expect(router.state.location.search).toBe('?step=2');
    expect(title(2)).toBeVisible();

    await act(async () => {
      await router.navigate(-1);
    });
    expect(title(1)).toBeVisible();

    await act(async () => {
      await router.navigate(1);
    });
    expect(router.state.location.search).toBe('?step=2');
    expect(title(2)).toBeVisible();
  });

  it('never reads the summary again while the steps change', async () => {
    const user = setupUser();
    const { api } = await open('/onboarding');

    await user.click(within(stepper()).getByRole('link', { name: /Most used components/ }));
    await user.click(within(stepper()).getByRole('link', { name: /Critical variables/ }));
    await user.click(within(stepper()).getByRole('link', { name: /^Overview/ }));

    expect(api.callsTo('GET /onboarding/summary')).toHaveLength(1);
  });
});

describe('the stepper', () => {
  it('marks the current step with aria-current and the steps the user completed as done', async () => {
    await open('/onboarding?step=3', [1, 2]);
    const links = within(stepper()).getAllByRole('link');

    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([
      null,
      null,
      'step',
      null,
      null,
    ]);
    expect(within(stepper()).getByRole('link', { name: 'Overview (completed)' })).toBeVisible();
    expect(
      within(stepper()).getByRole('link', { name: 'How the app starts (completed)' }),
    ).toBeVisible();
    expect(within(stepper()).getByRole('link', { name: 'Key screens' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(within(stepper()).getByRole('link', { name: 'Critical variables' })).toBeVisible();
  });

  it('is an ordered list of the five steps with the names of the frames', async () => {
    await open('/onboarding');
    const items = within(within(stepper()).getByRole('list')).getAllByRole('listitem');

    expect(items.map((item) => item.textContent)).toEqual([
      '1Overview',
      '2How the app starts',
      '3Key screens',
      '4Critical variables',
      '5Most used components',
    ]);
  });

  it('takes the user to a step with the mouse and with the keyboard', async () => {
    const user = setupUser();
    const { router } = await open('/onboarding');

    await user.click(within(stepper()).getByRole('link', { name: 'Critical variables' }));
    expect(router.state.location.search).toBe('?step=4');

    const target = within(stepper()).getByRole('link', { name: /^Key screens/ });
    act(() => {
      target.focus();
    });
    expect(target).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(router.state.location.search).toBe('?step=3');
    expect(title(3)).toBeVisible();
  });

  it('is reached with Tab, in the order of the steps', async () => {
    const user = setupUser();
    await open('/onboarding');
    const first = within(stepper()).getByRole('link', { name: 'Overview' });
    act(() => {
      first.focus();
    });

    await user.tab();
    expect(within(stepper()).getByRole('link', { name: 'How the app starts' })).toHaveFocus();
    await user.tab();
    expect(within(stepper()).getByRole('link', { name: 'Key screens' })).toHaveFocus();
  });

  it('marks only the steps that were saved, also when they have gaps', async () => {
    await open('/onboarding?step=2', [1, 3]);

    expect(within(stepper()).getByRole('link', { name: 'Overview (completed)' })).toBeVisible();
    expect(within(stepper()).getByRole('link', { name: 'How the app starts' })).toBeVisible();
    expect(within(stepper()).getByRole('link', { name: 'Key screens (completed)' })).toBeVisible();
    expect(within(stepper()).getByRole('link', { name: 'Critical variables' })).toBeVisible();
  });

  it('marks no step before the saved progress arrives or when there is none', async () => {
    await open('/onboarding?step=4');

    expect(within(stepper()).queryByText('(completed)')).toBeNull();
    expect(progress()).toHaveAttribute('aria-valuenow', '0');
  });

  it.each([
    [[], 0, '0 of 5 steps completed'],
    [[1], 20, '1 of 5 steps completed'],
    [[1, 3], 40, '2 of 5 steps completed'],
    [[1, 2, 3, 4], 80, '4 of 5 steps completed'],
    [[1, 2, 3, 4, 5], 100, '5 of 5 steps completed'],
  ])(
    'shows the progress of the saved steps %j as %i %%',
    async (saved: number[], now: number, text: string) => {
      await open('/onboarding?step=2', saved);

      expect(progress()).toHaveAttribute('aria-valuenow', String(now));
      expect(progress()).toHaveAttribute('aria-valuetext', text);
      expect((progress().firstElementChild as HTMLElement).style.width).toBe(`${now}%`);
    },
  );
});

describe('the focus', () => {
  it('stays where it is on arrival', async () => {
    await open('/onboarding?step=2');

    expect(document.body).toHaveFocus();
  });

  it('goes to the title of the step when the step changes, with the stepper and the history', async () => {
    const user = setupUser();
    const { router } = await open('/onboarding');

    await user.click(within(stepper()).getByRole('link', { name: /How the app starts/ }));
    expect(title(2)).toHaveFocus();

    await user.click(within(stepper()).getByRole('link', { name: 'Most used components' }));
    expect(title(5)).toHaveFocus();

    await act(async () => {
      await router.navigate(-1);
    });
    expect(title(2)).toHaveFocus();
  });

  it('has one h1 for the page and one h2 for the step', async () => {
    await open('/onboarding?step=3');

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Onboarding · SAR');
    expect(screen.getByRole('heading', { name: TITLES[3], level: 2 })).toHaveAttribute(
      'id',
      'onboarding-step-title',
    );
  });
});

describe('the change of application', () => {
  function twoApplications() {
    return {
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
      summaries: {
        1: makeSummary(),
        2: makeSummary({
          application: { id: 2, name: 'Billing' },
          counts: { screens: 5, variables: 6, collections: 7, components: 8 },
          approvedPercent: 20,
          globalVariables: [
            {
              variable: { id: 40, name: 'gFactura' },
              dataType: 'TEXT',
              originScreen: null,
              usedByScreens: 3,
            },
          ],
        }),
      },
    };
  }

  it('reads the summary again and goes back to step 1', async () => {
    const user = setupUser();
    const { router, api } = await renderOnboarding({
      path: '/onboarding?step=4',
      ...twoApplications(),
    });
    await screen.findByRole('list', { name: 'Critical variables by use' });
    expect(router.state.location.search).toBe('?step=4');

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    expect(
      await screen.findByRole('heading', { name: 'Onboarding · Billing', level: 1 }),
    ).toBeVisible();
    // The path starts over: no step in the URL, so it opens where this user left off in Billing (step 1 here).
    expect(router.state.location.search).toBe('');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(
      await screen.findByRole('region', { name: 'What Billing is and how it is documented' }),
    ).toBeVisible();
    expect(screen.getByText('20.0% approved')).toBeVisible();
    expect(
      api.callsTo('GET /onboarding/summary').map((call) => call.options.query?.applicationId),
    ).toEqual([1, 2]);
  });

  it('shows nothing of the previous application while the new one is read', async () => {
    const user = setupUser();
    let gate!: { release: () => void };
    await renderOnboarding({
      path: '/onboarding?step=4',
      ...twoApplications(),
      prepare: (api) => {
        gate = api.hold((call) => call.options.query?.applicationId === 2);
      },
    });
    await screen.findByRole('list', { name: 'Critical variables by use' });

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    expect(screen.getByRole('heading', { name: 'Onboarding · Billing', level: 1 })).toBeVisible();
    expect(screen.queryByText('gUsuarioActual')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'SAR at a glance' })).not.toBeInTheDocument();

    await act(async () => {
      gate.release();
      await Promise.resolve();
    });
    expect(await screen.findByRole('region', { name: 'Billing at a glance' })).toBeVisible();
    expect(
      within(screen.getByRole('region', { name: 'Billing at a glance' }))
        .getAllByRole('definition')
        .map((item) => item.textContent),
    ).toEqual(['5', '6', '7', '20.0%']);
  });

  it('does not take the shared link of the first load for a change of application', async () => {
    const { router } = await renderOnboarding({ path: '/onboarding?step=5', ...twoApplications() });
    await screen.findByRole('list', { name: 'Components by use' });

    expect(router.state.location.search).toBe('?step=5');
    expect(title(5)).toBeVisible();
  });
});
