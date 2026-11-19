// The guide bubble of the onboarding: a tile of "Explore while you read" that opens a page of the application starts a trail, and the
// bubble stays on the pages the user opens next (step, what they went to see, "Back to step N", minimize, dismiss). The Miro
// diagram opens in another tab and starts nothing. The trail is in memory: arriving at the onboarding ends it.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnboarding } from '../helpers/renderOnboarding';
import { setupUser } from '../helpers/setupUser';

const bubble = () => screen.queryByRole('complementary', { name: 'Onboarding guide' });

async function openStep(step: number) {
  const view = await renderOnboarding({ path: `/onboarding?step=${step}` });
  const explore = await screen.findByRole('region', { name: 'Explore while you read' });
  return { ...view, explore, user: setupUser() };
}

describe('the onboarding guide bubble', () => {
  it('is not drawn when the user did not come from "Explore"', async () => {
    await renderOnboarding({ path: '/screens/10' });
    await screen.findByRole('heading', { level: 1 });

    expect(bubble()).not.toBeInTheDocument();
  });

  it('follows the user to the page opened from "Explore", with the step and what they went to see', async () => {
    const { router, explore, user } = await openStep(3);
    expect(bubble()).not.toBeInTheDocument();

    await user.click(within(explore).getByRole('link', { name: 'Open App (OnStart)' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/screens/10');
    });
    const guide = await screen.findByRole('complementary', { name: 'Onboarding guide' });
    expect(within(guide).getByText('Step 3 of 5 · Key screens')).toBeVisible();
    expect(within(guide).getByText('Open App (OnStart)')).toBeVisible();
    expect(within(guide).getByRole('link', { name: 'Back to step 3' })).toHaveAttribute(
      'href',
      '/onboarding?step=3',
    );
  });

  it('stays while the user opens more pages', async () => {
    const { router, explore, user } = await openStep(2);

    await user.click(within(explore).getByRole('link', { name: 'See it on the map' }));
    await screen.findByRole('complementary', { name: 'Onboarding guide' });
    await user.click(screen.getByRole('link', { name: 'Advanced search' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/search');
    });
    expect(bubble()).toBeVisible();
  });

  it('takes the user back to the step they left and disappears there', async () => {
    const { router, explore, user } = await openStep(4);
    await user.click(within(explore).getByRole('link', { name: 'Search the documentation' }));
    const guide = await screen.findByRole('complementary', { name: 'Onboarding guide' });

    await user.click(within(guide).getByRole('link', { name: 'Back to step 4' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/onboarding');
    });
    expect(router.state.location.search).toBe('?step=4');
    expect(bubble()).not.toBeInTheDocument();
  });

  it('is dismissed with "Dismiss" and does not come back by itself', async () => {
    const { explore, user } = await openStep(1);
    await user.click(within(explore).getByRole('link', { name: 'See it on the map' }));
    const guide = await screen.findByRole('complementary', { name: 'Onboarding guide' });

    await user.click(within(guide).getByRole('button', { name: 'Dismiss' }));

    expect(bubble()).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Advanced search' }));
    expect(bubble()).not.toBeInTheDocument();
  });

  it('minimizes to a round button that opens it again', async () => {
    const { explore, user } = await openStep(5);
    await user.click(within(explore).getByRole('link', { name: 'See it on the map' }));
    const guide = await screen.findByRole('complementary', { name: 'Onboarding guide' });

    await user.click(within(guide).getByRole('button', { name: 'Minimize the onboarding guide' }));

    expect(bubble()).not.toBeInTheDocument();
    const round = screen.getByRole('button', { name: 'Open the onboarding guide, Step 5 of 5' });
    await user.click(round);
    expect(await screen.findByRole('complementary', { name: 'Onboarding guide' })).toBeVisible();
  });

  it('starts nothing with the Miro diagram, which opens in another tab', async () => {
    const { explore, user } = await openStep(3);
    const miro = within(explore).getByRole('link', { name: /^Miro diagram/ });
    miro.addEventListener('click', (event) => {
      event.preventDefault();
    });

    await user.click(miro);

    expect(bubble()).not.toBeInTheDocument();
  });
});
