// /onboarding when its code cannot be loaded (the network, or a deploy that removed the old file): the shell stays, the page
// area shows the existing server-error page with "Try again", and the retry makes a new import() and shows the path without
// reloading the document. The failure is simulated by a module factory that throws until the test lets it through (the
// factory runs once per file, so this case has its own file; see lazyOnboarding.test.tsx).
import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectConsoleError } from '../helpers/expectConsoleError';
import { renderOnboarding } from '../helpers/renderOnboarding';
import { setupUser } from '../helpers/setupUser';

const chunk = vi.hoisted(() => ({ fail: true, imports: 0 }));

vi.mock('../../modules/onboarding/OnboardingPage', async (importOriginal) => {
  chunk.imports += 1;
  if (chunk.fail) throw new TypeError('Failed to fetch dynamically imported module');
  return importOriginal();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('an /onboarding whose code cannot be loaded', () => {
  it('keeps the shell and offers "Try again", then loads the path', async () => {
    const logged = expectConsoleError(
      /ChunkLoadError: The code of the page could not be loaded\./,
      /The above error occurred in the <\w+> component/,
    );
    const user = setupUser();
    const view = await renderOnboarding({ path: '/screens' });
    await screen.findByRole('heading', { name: 'Screens', level: 1 });
    // Inside act, so the failed load and the error page are rendered before the test looks at them.
    await act(async () => {
      await view.router.navigate('/onboarding?step=2');
    });

    expect(await screen.findByText('Something went wrong on our side')).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Onboarding · SAR', level: 1 }),
    ).not.toBeInTheDocument();
    const importsBefore = chunk.imports;

    chunk.fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { name: 'Onboarding · SAR', level: 1 }),
    ).toBeVisible();
    // The step of the URL survives the failed load.
    expect(await screen.findByText('Loads the user, then the catalog.')).toBeVisible();
    expect(screen.getByRole('region', { name: 'How SAR starts' })).toBeVisible();
    expect(screen.queryByText('Something went wrong on our side')).not.toBeInTheDocument();
    expect(chunk.imports).toBeGreaterThan(importsBefore);
    expect(logged.matched.length).toBeGreaterThan(0);
  });
});
