// The saved progress of the onboarding (contract 0.4.0): it is read with the summary, the page opens at the first step that is not
// completed, "Mark step as complete" saves a step (PUT, idempotent) and moves on, "Restart onboarding" forgets them all (DELETE), and
// a failure of the progress never breaks the page. The progress is personal and per application, and the three roles use it.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeSummary } from '../helpers/fakeOnboardingApi';
import { makeApplication } from '../helpers/renderApp';
import { renderOnboarding, type RenderOnboardingOptions } from '../helpers/renderOnboarding';
import { setupUser } from '../helpers/setupUser';

const stepper = () => screen.getByRole('navigation', { name: 'Onboarding steps' });
const search = (view: Awaited<ReturnType<typeof renderOnboarding>>) =>
  view.router.state.location.search;

async function open(options: RenderOnboardingOptions = {}) {
  const view = await renderOnboarding(options);
  await screen.findByRole('region', { name: 'Explore while you read' });
  return view;
}

describe('reading the progress', () => {
  it('asks for it with the summary, for the selected application', async () => {
    const { api } = await open({ progress: { 1: [1, 2] } });

    expect(api.callsTo('GET /onboarding/progress')).toHaveLength(1);
    expect(api.callsTo('GET /onboarding/progress')[0]?.options.query).toEqual({ applicationId: 1 });
    expect(api.callsTo('GET /onboarding/summary')).toHaveLength(1);
  });

  it('opens at the first step that is not completed', async () => {
    const view = await open({ progress: { 1: [1, 2] } });

    expect(search(view)).toBe('?step=3');
    expect(view.router.state.historyAction).toBe('REPLACE');
    expect(
      screen.getByRole('heading', { name: 'Read these screens first', level: 2 }),
    ).toBeVisible();
  });

  it('does not take the saved steps for a straight line: [1, 3] opens at step 2', async () => {
    const view = await open({ progress: { 1: [1, 3] } });

    expect(search(view)).toBe('?step=2');
  });

  it('leaves the URL alone when the first step is the one that is pending', async () => {
    const view = await open({ progress: { 1: [] } });

    expect(search(view)).toBe('');
    expect(screen.getByRole('heading', { name: /^What SAR is/, level: 2 })).toBeVisible();
  });

  it('respects a step that is in the URL, whatever the user completed', async () => {
    const view = await open({ path: '/onboarding?step=2', progress: { 1: [1, 2, 3] } });

    expect(search(view)).toBe('?step=2');
    expect(screen.getByRole('heading', { name: 'How SAR starts', level: 2 })).toBeVisible();
  });

  it('shows the onboarding as completed when the five steps are saved', async () => {
    const view = await open({ progress: { 1: [1, 2, 3, 4, 5] } });

    expect(screen.getByText('Onboarding completed')).toBeVisible();
    expect(search(view)).toBe('');
    expect(screen.getByRole('heading', { name: /^What SAR is/, level: 2 })).toBeVisible();
  });

  it('shows no "completed" chip while a step is pending', async () => {
    await open({ progress: { 1: [1, 2, 3, 4] } });

    expect(screen.queryByText('Onboarding completed')).toBeNull();
  });

  it('reads it again for the other application, and opens there where that user left off', async () => {
    const user = setupUser();
    const { api, router } = await renderOnboarding({
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
      summaries: {
        1: makeSummary(),
        2: makeSummary({ application: { id: 2, name: 'Billing' } }),
      },
      progress: { 1: [1, 2, 3, 4, 5], 2: [1] },
    });
    await screen.findByRole('region', { name: 'Explore while you read' });
    expect(screen.getByText('Onboarding completed')).toBeVisible();

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    expect(
      await screen.findByRole('heading', { name: 'Onboarding · Billing', level: 1 }),
    ).toBeVisible();
    await waitFor(() => {
      expect(router.state.location.search).toBe('?step=2');
    });
    expect(screen.queryByText('Onboarding completed')).toBeNull();
    expect(api.callsTo('GET /onboarding/progress').map((call) => call.options.query)).toEqual([
      { applicationId: 1 },
      { applicationId: 2 },
    ]);
  });
});

describe('marking a step', () => {
  it('saves the step, says so, marks it in the path and moves on to the next one', async () => {
    const user = setupUser();
    const view = await open({ path: '/onboarding?step=1' });

    await user.click(screen.getByRole('button', { name: 'Mark step as complete' }));

    const puts = view.api.callsTo('PUT /onboarding/progress/steps/{step}');
    expect(puts).toHaveLength(1);
    expect(puts[0]?.options.path).toEqual({ step: 1 });
    expect(puts[0]?.options.query).toEqual({ applicationId: 1 });
    expect(await screen.findByText('Step 1 completed.')).toBeVisible();
    await waitFor(() => {
      expect(search(view)).toBe('?step=2');
    });
    expect(within(stepper()).getByRole('link', { name: 'Overview (completed)' })).toBeVisible();
    // The answer of the PUT replaces the state: no new read.
    expect(view.api.callsTo('GET /onboarding/progress')).toHaveLength(1);
  });

  it('shows "Step completed" and no button for a step that is saved', async () => {
    await open({ path: '/onboarding?step=2', progress: { 1: [2] } });

    expect(screen.getByText('Step completed')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mark step as complete' })).toBeNull();
  });

  it('saves the last step, stays on it and shows the onboarding as completed', async () => {
    const user = setupUser();
    const view = await open({ path: '/onboarding?step=5', progress: { 1: [1, 2, 3, 4] } });

    await user.click(screen.getByRole('button', { name: 'Mark step as complete' }));

    expect(await screen.findByText('Onboarding completed')).toBeVisible();
    expect(search(view)).toBe('?step=5');
    expect(screen.getByText('Step completed')).toBeVisible();
  });

  it('saves only when the user marks a step, never when they walk the path', async () => {
    const user = setupUser();
    const { api } = await open({ path: '/onboarding?step=1' });

    await user.click(within(stepper()).getByRole('link', { name: 'Key screens' }));
    await user.click(within(stepper()).getByRole('link', { name: 'Overview' }));

    expect(api.callsTo('PUT /onboarding/progress/steps/{step}')).toHaveLength(0);
  });

  it('says what the API refused with its catalog text and keeps the step pending', async () => {
    const user = setupUser();
    const { api } = await open({
      path: '/onboarding?step=1',
      prepare: (fake) => {
        fake.failNext(
          'PUT /onboarding/progress/steps/{step}',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });

    await user.click(screen.getByRole('button', { name: 'Mark step as complete' }));

    expect(
      await screen.findByText('Something went wrong on our side. Try again in a moment.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mark step as complete' })).toBeEnabled();
    expect(within(stepper()).queryByText('(completed)')).toBeNull();
    expect(api.state.progress[1]).toBeUndefined();
  });

  it.each(['ADMINISTRATOR', 'DEVELOPER', 'READER'] as const)(
    'works for the %s, who has a progress of their own',
    async (role) => {
      const user = setupUser();
      const { api } = await open({ role, path: '/onboarding?step=1' });

      await user.click(screen.getByRole('button', { name: 'Mark step as complete' }));

      expect(await screen.findByText('Step 1 completed.')).toBeVisible();
      expect(api.state.progress[1]).toEqual([1]);
    },
  );

  it('works in an archived application, which the progress does not depend on', async () => {
    const user = setupUser();
    const { api } = await open({
      path: '/onboarding?step=1',
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });

    await user.click(screen.getByRole('button', { name: 'Mark step as complete' }));

    expect(await screen.findByText('Step 1 completed.')).toBeVisible();
    expect(api.state.progress[1]).toEqual([1]);
  });
});

describe('restarting the onboarding', () => {
  it('offers it only when there is something saved', async () => {
    await open({ path: '/onboarding?step=1' });

    expect(screen.queryByRole('button', { name: 'Restart onboarding' })).toBeNull();
  });

  it('asks first, and Cancel forgets nothing', async () => {
    const user = setupUser();
    const { api } = await open({ path: '/onboarding?step=2', progress: { 1: [1, 2] } });

    await user.click(screen.getByRole('button', { name: 'Restart onboarding' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Restart the onboarding?' }));
    expect(dialog.getByText(/Your completed steps in SAR are forgotten/)).toBeVisible();
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.callsTo('DELETE /onboarding/progress')).toHaveLength(0);
    expect(api.state.progress[1]).toEqual([1, 2]);
  });

  it('forgets the steps of the user in this application, says so and goes back to step 1', async () => {
    const user = setupUser();
    const view = await open({ path: '/onboarding?step=3', progress: { 1: [1, 2, 3, 4, 5] } });
    expect(screen.getByText('Onboarding completed')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Restart onboarding' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Restart the onboarding?' }));
    await user.click(dialog.getByRole('button', { name: 'Restart onboarding' }));

    expect(await screen.findByText('Onboarding restarted.')).toBeVisible();
    const deletes = view.api.callsTo('DELETE /onboarding/progress');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.options.query).toEqual({ applicationId: 1 });
    expect(view.api.state.progress[1]).toEqual([]);
    await waitFor(() => {
      expect(search(view)).toBe('?step=1');
    });
    expect(screen.queryByText('Onboarding completed')).toBeNull();
    expect(within(stepper()).queryByText('(completed)')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restart onboarding' })).toBeNull();
  });
});

describe('when the progress cannot be read', () => {
  it('keeps the page working, says so in the foot of the step and reads it again with "Try again"', async () => {
    const user = setupUser();
    const { api } = await open({
      path: '/onboarding?step=1',
      progress: { 1: [1] },
      prepare: (fake) => {
        fake.failNext(
          'GET /onboarding/progress',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });

    expect(screen.getByRole('heading', { name: /^What SAR is/, level: 2 })).toBeVisible();
    expect(screen.getByText("Your progress couldn't be loaded.")).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mark step as complete' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Step completed')).toBeVisible();
    expect(api.callsTo('GET /onboarding/progress')).toHaveLength(2);
  });

  it('opens at step 1 when there is no step in the URL and the progress failed', async () => {
    const view = await open({
      progress: { 1: [1, 2] },
      prepare: (fake) => {
        fake.failNext(
          'GET /onboarding/progress',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });

    expect(search(view)).toBe('');
    expect(screen.getByRole('heading', { name: /^What SAR is/, level: 2 })).toBeVisible();
  });
});
