// /review is loaded when the route is opened (NFR-11, lazyPage): the code of the queue is not part of the main bundle.
// A module factory counts the imports of ReviewPage: it is not imported by any other route and it is imported once when
// /review opens (the factory runs once per file, so the failed load has its own file: lazyReviewFailure.test.tsx).
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { reviewQueueScreens } from '../helpers/openReview';
import { renderScreens } from '../helpers/renderScreens';
import { setupUser } from '../helpers/setupUser';

const chunk = vi.hoisted(() => ({ imports: 0 }));

vi.mock('../../modules/review/ReviewPage', async (importOriginal) => {
  chunk.imports += 1;
  return importOriginal();
});

afterEach(() => {
  chunk.imports = 0;
  vi.restoreAllMocks();
});

describe('the code of /review', () => {
  it('is not loaded by any other route', async () => {
    await renderScreens({ role: 'ADMINISTRATOR', path: '/screens', screens: reviewQueueScreens() });
    await screen.findByRole('heading', { name: 'Screens', level: 1 });

    expect(chunk.imports).toBe(0);
  });

  it('is loaded once, from the Review item of the menu, when /review is opened', async () => {
    const user = setupUser();
    await renderScreens({ role: 'DEVELOPER', path: '/screens', screens: reviewQueueScreens() });
    await screen.findByRole('heading', { name: 'Screens', level: 1 });
    expect(chunk.imports).toBe(0);

    await user.click(screen.getByRole('link', { name: /^Review/ }));

    expect(await screen.findByRole('heading', { name: 'Review', level: 1 })).toBeVisible();
    expect(chunk.imports).toBe(1);
  });
});
