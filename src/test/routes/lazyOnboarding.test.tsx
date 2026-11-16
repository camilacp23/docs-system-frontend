// /onboarding is loaded when the route is opened (NFR-11, lazyPage): the code of the path is not part of the main bundle.
// A module factory counts the imports of OnboardingPage: it is not imported by any other route and it is imported once when
// /onboarding opens from the menu (the factory runs once per file, so the failed load has its own file:
// lazyOnboardingFailure.test.tsx, and only one test here opens the page).
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderOnboarding } from '../helpers/renderOnboarding';
import { setupUser } from '../helpers/setupUser';

const chunk = vi.hoisted(() => ({ imports: 0 }));

vi.mock('../../modules/onboarding/OnboardingPage', async (importOriginal) => {
  chunk.imports += 1;
  return importOriginal();
});

afterEach(() => {
  chunk.imports = 0;
  vi.restoreAllMocks();
});

describe('the code of /onboarding', () => {
  it('is not loaded by any other route', async () => {
    await renderOnboarding({ path: '/screens' });
    await screen.findByRole('heading', { name: 'Screens', level: 1 });

    expect(chunk.imports).toBe(0);
  });

  it('is loaded once, from the Onboarding item of the menu of a Reader, when /onboarding opens', async () => {
    const user = setupUser();
    await renderOnboarding({ role: 'READER', path: '/screens' });
    await screen.findByRole('heading', { name: 'Screens', level: 1 });
    expect(chunk.imports).toBe(0);

    await user.click(screen.getByRole('link', { name: /^Onboarding/ }));

    expect(
      await screen.findByRole('heading', { name: 'Onboarding · SAR', level: 1 }),
    ).toBeVisible();
    expect(chunk.imports).toBe(1);
  });
});
