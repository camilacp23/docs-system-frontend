// /review when its code cannot be loaded (the network, or a deploy that removed the old file): the shell stays, the page area
// shows the existing server-error page with "Try again", and the retry makes a new import() and shows the queue without
// reloading the document. The failure is simulated by a module factory that throws until the test lets it through (the
// factory runs once per file, so this case has its own file; see lazyReview.test.tsx).
import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectConsoleError } from '../helpers/expectConsoleError';
import { reviewQueueScreens } from '../helpers/openReview';
import { renderScreens } from '../helpers/renderScreens';
import { setupUser } from '../helpers/setupUser';

const chunk = vi.hoisted(() => ({ fail: true, imports: 0 }));

vi.mock('../../modules/review/ReviewPage', async (importOriginal) => {
  chunk.imports += 1;
  if (chunk.fail) throw new TypeError('Failed to fetch dynamically imported module');
  return importOriginal();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a /review whose code cannot be loaded', () => {
  it('keeps the shell and offers "Try again", then loads the queue', async () => {
    const logged = expectConsoleError(
      /ChunkLoadError: The code of the page could not be loaded\./,
      /The above error occurred in the <\w+> component/,
    );
    const user = setupUser();
    const view = await renderScreens({
      role: 'ADMINISTRATOR',
      path: '/screens',
      screens: reviewQueueScreens(),
    });
    await screen.findByRole('heading', { name: 'Screens', level: 1 });
    // Inside act, so the failed load and the error page are rendered before the test looks at them.
    await act(async () => {
      await view.router.navigate('/review');
    });

    expect(await screen.findByText('Something went wrong on our side')).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Review', level: 1 })).not.toBeInTheDocument();
    const importsBefore = chunk.imports;

    chunk.fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Review', level: 1 })).toBeVisible();
    expect(screen.queryByText('Something went wrong on our side')).not.toBeInTheDocument();
    // A new import was made (not the cached rejection).
    expect(chunk.imports).toBeGreaterThan(importsBefore);
    expect(logged.matched.length).toBeGreaterThan(0);
  });
});
