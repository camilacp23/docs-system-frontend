// The Review counter of the menu: how many screens of the selected application are In review, for the Administrator and the
// Developer (not the Reader), from one light read (pageSize 1). It is read again when the application changes, after
// submitting, withdrawing, approving or returning (from the detail or from the queue) and when the browser tab becomes
// visible again; never by polling. A failed read hides it without breaking the menu. It has an accessible name that does not
// depend on colour, also when the sidebar is collapsed, and it is not drawn for 0.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeApplication } from '../helpers/renderApp';
import { fixReviewClock, reviewQueueScreens, reviewScreen } from '../helpers/openReview';
import { renderScreens, sampleScreens, type RenderScreensOptions } from '../helpers/renderScreens';
import type { Screen } from '../../modules/screens/screenTypes';
import { setupUser } from '../helpers/setupUser';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type View = Awaited<ReturnType<typeof renderScreens>>;

const countReads = (view: View) =>
  view.api
    .callsTo('GET /screens')
    .filter(
      (call) =>
        call.options.query?.documentationStatus === 'IN_REVIEW' &&
        call.options.query.pageSize === 1,
    );
const nav = () => within(screen.getByRole('navigation', { name: 'Main' }));
const reviewLink = () => nav().getByRole('link', { name: /^Review/ });

async function open(
  options: Pick<RenderScreensOptions, 'applications' | 'prepare'> & {
    role?: 'ADMINISTRATOR' | 'DEVELOPER' | 'READER';
    path?: string;
    screens?: Screen[];
  } = {},
) {
  fixReviewClock();
  const view = await renderScreens({
    role: options.role ?? 'ADMINISTRATOR',
    path: options.path ?? '/screens',
    screens: options.screens ?? reviewQueueScreens(),
    applications: options.applications,
    prepare: options.prepare,
  });
  return view;
}

describe('the counter on the Review item', () => {
  it.each(['ADMINISTRATOR', 'DEVELOPER'] as const)(
    'shows %s the number of screens In review',
    async (role) => {
      const view = await open({ role });

      await waitFor(() => {
        expect(reviewLink()).toHaveAccessibleName('Review, 3 screens in review');
      });
      expect(reviewLink()).toHaveTextContent('Review3, 3 screens in review');
      expect(countReads(view)[0]?.options.query).toEqual({
        applicationId: 1,
        documentationStatus: 'IN_REVIEW',
        page: 1,
        pageSize: 1,
      });
    },
  );

  it('says "1 screen" in the singular', async () => {
    await open({ screens: sampleScreens() });

    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 1 screen in review');
    });
  });

  it('draws nothing for 0: no badge and the plain name', async () => {
    const view = await open({
      screens: sampleScreens().map((s) => ({ ...s, documentationStatus: 'DRAFT' as const })),
    });

    await waitFor(() => {
      expect(countReads(view)).toHaveLength(1);
    });
    expect(reviewLink()).toHaveAccessibleName('Review');
    expect(reviewLink().textContent).toBe('Review');
  });

  it('shows "99+" for a hundred or more, and says the whole number to a screen reader', async () => {
    const many = Array.from({ length: 100 }, (_, index) =>
      reviewScreen(200 + index, `Screen ${index}`),
    );
    await open({ screens: [...sampleScreens().filter((s) => s.id > 14), ...many] });

    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 100 screens in review');
    });
    expect(reviewLink()).toHaveTextContent('Review99+');
  });

  it('is not for the Reader: no Review item and no read of the count', async () => {
    const view = await open({ role: 'READER' });

    await nav().findByRole('link', { name: 'Screens' });
    expect(nav().queryByRole('link', { name: /^Review/ })).not.toBeInTheDocument();
    expect(countReads(view)).toHaveLength(0);
  });

  it('keeps an accessible name and a visible number when the sidebar is collapsed', async () => {
    const user = setupUser();
    await open();
    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 3 screens in review');
    });

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    const link = nav().getByRole('link', { name: 'Review, 3 screens in review' });
    expect(link).toHaveAttribute('aria-label', 'Review, 3 screens in review');
    // The small badge carries the number, so the signal is not only a colour or a dot.
    expect(link.querySelector('[aria-hidden="true"]:not(svg)')).not.toBeNull();
    expect(link).toHaveTextContent('3');
  });
});

describe('when it is read again', () => {
  it('follows the selected application', async () => {
    const user = setupUser();
    const view = await open({
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
      screens: [...reviewQueueScreens(), reviewScreen(70, 'Facturas', { applicationId: 2 })],
    });
    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 3 screens in review');
    });

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 1 screen in review');
    });
    expect(countReads(view).at(-1)?.options.query?.applicationId).toBe(2);
  });

  it('goes up when a Developer submits a screen for review, and down when they withdraw it', async () => {
    const user = setupUser();
    const view = await open({
      role: 'DEVELOPER',
      path: '/screens/12',
      screens: reviewQueueScreens().map((s) =>
        s.id === 12 ? { ...s, documentationStatus: 'IN_PROGRESS' as const } : s,
      ),
    });
    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 2 screens in review');
    });

    await user.click(await screen.findByRole('button', { name: 'Submit for review' }));
    await screen.findByText('Detalle submitted for review.');
    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 3 screens in review');
    });

    await user.click(await screen.findByRole('button', { name: 'Withdraw from review' }));
    await screen.findByText('Detalle withdrawn from review.');
    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 2 screens in review');
    });
    expect(countReads(view)).toHaveLength(3);
  });

  it.each([
    ['approves', 'Approve', 'Detalle approved.'],
    ['returns', 'Return', 'Detalle returned to In progress.'],
  ] as const)(
    'goes down when the Administrator %s from the detail',
    async (_name, button, toast) => {
      const user = setupUser();
      await open({ path: '/screens/12' });
      await waitFor(() => {
        expect(reviewLink()).toHaveAccessibleName('Review, 3 screens in review');
      });

      await user.click(await screen.findByRole('button', { name: button }));
      const dialog = within(await screen.findByRole('dialog'));
      if (button === 'Return')
        await user.type(dialog.getByLabelText(/Comment for the author/), 'Fix.');
      await user.click(dialog.getByRole('button', { name: button }));

      await screen.findByText(toast);
      await waitFor(() => {
        expect(reviewLink()).toHaveAccessibleName('Review, 2 screens in review');
      });
    },
  );

  it.each([
    ['approves', 'Approve'],
    ['returns', 'Return for changes'],
  ] as const)('goes down when the Administrator %s from the queue', async (_name, button) => {
    const user = setupUser();
    await open({ path: '/review' });
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 3 screens in review');
    });

    await user.click(screen.getByRole('button', { name: button }));
    const dialog = within(await screen.findByRole('dialog'));
    if (button !== 'Approve')
      await user.type(dialog.getByLabelText(/Comment for the author/), 'Fix.');
    await user.click(
      dialog.getByRole('button', { name: button === 'Approve' ? 'Approve' : 'Return' }),
    );

    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 2 screens in review');
    });
  });

  it('is read again when the browser tab becomes visible, and not when it becomes hidden', async () => {
    const view = await open();
    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 3 screens in review');
    });
    expect(countReads(view)).toHaveLength(1);
    // Someone else decided on a screen while the tab was hidden.
    view.api.state.screens = view.api.state.screens.map((s) =>
      s.id === 13 ? { ...s, documentationStatus: 'APPROVED' as const } : s,
    );

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(countReads(view)).toHaveLength(1);

    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 2 screens in review');
    });
    expect(countReads(view)).toHaveLength(2);
  });

  it('keeps the old number on screen while it is read again, with no flicker', async () => {
    const view = await open();
    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 3 screens in review');
    });
    const gate = view.api.hold(
      (call) =>
        call.method === 'GET' &&
        call.path === '/screens' &&
        call.options.query?.documentationStatus === 'IN_REVIEW' &&
        call.options.query.pageSize === 1,
    );

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(reviewLink()).toHaveAccessibleName('Review, 3 screens in review');
    await act(async () => {
      gate.release();
      await Promise.resolve();
    });
  });

  it('does not poll: no read happens without one of those moments', async () => {
    const view = await open();
    await waitFor(() => {
      expect(countReads(view)).toHaveLength(1);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(countReads(view)).toHaveLength(1);
  });
});

describe('when the read fails', () => {
  /** Makes the next `times` reads of the counter fail, and nothing else. */
  function failCount(view: View, times = 1) {
    const get = (view.api.client as unknown as { get: Mock }).get;
    const real = get.getMockImplementation() as (
      path: string,
      options?: unknown,
    ) => Promise<unknown>;
    let left = times;
    get.mockImplementation(
      (path: string, options?: { query?: { documentationStatus?: string; pageSize?: number } }) => {
        if (
          path === '/screens' &&
          options?.query?.documentationStatus === 'IN_REVIEW' &&
          options.query.pageSize === 1 &&
          left > 0
        ) {
          left -= 1;
          return Promise.reject(new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
        }
        return real(path, options);
      },
    );
  }

  it('hides the number without breaking the menu, and shows it again when a later read works', async () => {
    const user = setupUser();
    const view = await open({
      prepare: (api) => {
        const get = (api.client as unknown as { get: Mock }).get;
        const real = get.getMockImplementation() as (p: string, o?: unknown) => Promise<unknown>;
        let failed = false;
        get.mockImplementation(
          (
            path: string,
            options?: { query?: { documentationStatus?: string; pageSize?: number } },
          ) => {
            if (
              !failed &&
              path === '/screens' &&
              options?.query?.documentationStatus === 'IN_REVIEW' &&
              options.query.pageSize === 1
            ) {
              failed = true;
              return Promise.reject(new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
            }
            return real(path, options);
          },
        );
      },
    });

    // The whole menu is there, and Review has no number.
    expect(await nav().findByRole('link', { name: 'Dashboard' })).toBeVisible();
    expect(nav().getAllByRole('link')).toHaveLength(12);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Screens', level: 1 })).toBeVisible();
    });
    expect(reviewLink().textContent).toBe('Review');
    expect(reviewLink()).toHaveAccessibleName('Review');

    // A later moment reads it again.
    await view.router.navigate('/screens/12');
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Approve' }));
    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 2 screens in review');
    });
  });

  it('hides a number that was shown when a new read fails', async () => {
    const view = await open();
    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review, 3 screens in review');
    });
    failCount(view);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(reviewLink()).toHaveAccessibleName('Review');
    });
    expect(nav().getAllByRole('link')).toHaveLength(12);
  });
});
