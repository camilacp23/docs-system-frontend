// Review queue (S-36), reading: the screens In review of the selected application, the one waiting longest first, what each
// row says ("Author: … · In review since …" with the exact date as title, never "Submitted by"), the panel "What to check"
// computed from the detail, the last comment in one tiny read, the empty queue, "Load more", and the failed reads. The
// clock is fixed (only Date): 2026-10-06 16:02 local time.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeApplication } from '../helpers/renderApp';
import {
  failQueueReads,
  fixReviewClock,
  openReview,
  reviewQueueScreens,
  reviewScreen,
} from '../helpers/openReview';
import { renderScreens, sampleScreens } from '../helpers/renderScreens';
import { setupUser } from '../helpers/setupUser';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const list = () => screen.getByRole('list', { name: 'Screens waiting for review' });
const rowButtons = () => within(list()).getAllByRole('button');
const rowNames = () => rowButtons().map((button) => button.querySelector('span')?.textContent);
const queueReads = (view: Awaited<ReturnType<typeof openReview>>) =>
  view.api.callsTo('GET /screens').filter((call) => call.options.query?.sort === 'updatedAt');

describe('the queue', () => {
  it('lists the screens In review of the application, the one waiting longest first', async () => {
    const view = await openReview();

    await screen.findByRole('list', { name: 'Screens waiting for review' });
    expect(rowNames()).toEqual(['Reportes', 'Busqueda', 'Detalle']);
    expect(queueReads(view)[0]?.options.query).toEqual({
      applicationId: 1,
      documentationStatus: 'IN_REVIEW',
      sort: 'updatedAt',
      page: 1,
      pageSize: 20,
    });
    // Screens in other statuses are not in the queue.
    expect(screen.queryByText('Inicio')).not.toBeInTheDocument();
    expect(screen.queryByText('App (OnStart)', { selector: 'span' })).not.toBeInTheDocument();
  });

  it('says how many are waiting in the subtitle and in the "Waiting" header', async () => {
    await openReview();

    expect(
      await screen.findByText('3 screens waiting for a decision · oldest first'),
    ).toBeVisible();
    const waiting = screen.getByRole('heading', { name: 'Waiting', level: 2 });
    expect(waiting.parentElement).toHaveTextContent('Waiting3');
  });

  it('says "1 screen" in the singular', async () => {
    await openReview({
      screens: [...sampleScreens().filter((s) => s.id !== 12), reviewScreen(12, 'Detalle')],
    });

    expect(await screen.findByText('1 screen waiting for a decision · oldest first')).toBeVisible();
  });

  it('writes the row as the author and how long it has been in review, never "Submitted by"', async () => {
    await openReview();

    const [reportes, busqueda, detalle] = rowButtons() as [HTMLElement, HTMLElement, HTMLElement];
    expect(reportes).toHaveTextContent(
      'ReportesAuthor: Sample Developer A · In review since 4 days ago0 comments',
    );
    expect(busqueda).toHaveTextContent(
      'BusquedaAuthor: Sample Developer B · In review since 3 days ago2 comments',
    );
    expect(detalle).toHaveTextContent(
      'DetalleAuthor: Sample Developer A · In review since 2 days ago4 comments',
    );
    expect(screen.queryByText(/Submitted by/)).not.toBeInTheDocument();
  });

  it('keeps the exact date and time of updatedAt as the title of the relative time', async () => {
    await openReview();

    const time = within(rowButtons()[0] as HTMLElement).getByText('4 days ago');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('title', '2026-10-02 09:00');
    expect(time).toHaveAttribute('datetime', '2026-10-02T09:00:00');
  });

  it('marks the selected row, the first one at the start, and follows the choice', async () => {
    const user = setupUser();
    await openReview();

    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    expect(rowButtons()[0]).toHaveAttribute('aria-current', 'true');
    expect(rowButtons()[1]).not.toHaveAttribute('aria-current');

    await user.click(rowButtons()[2] as HTMLElement);
    expect(await screen.findByRole('heading', { name: 'Detalle', level: 2 })).toBeVisible();
    expect(rowButtons()[2]).toHaveAttribute('aria-current', 'true');
    expect(rowButtons()[0]).not.toHaveAttribute('aria-current');
  });

  it('shows the queue of the selected application only', async () => {
    const view = await openReview({
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
      screens: [...reviewQueueScreens(), reviewScreen(70, 'Facturas', { applicationId: 2 })],
    });

    await screen.findByRole('list', { name: 'Screens waiting for review' });
    expect(rowNames()).toEqual(['Reportes', 'Busqueda', 'Detalle']);

    const user = setupUser();
    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));
    await waitFor(() => {
      expect(queueReads(view).at(-1)?.options.query?.applicationId).toBe(2);
    });
    await screen.findByRole('heading', { name: 'Facturas', level: 2 });
    expect(rowNames()).toEqual(['Facturas']);
  });
});

describe('the panel "What to check"', () => {
  async function selectDetalle() {
    const user = setupUser();
    const view = await openReview();
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    await user.click(rowButtons()[2] as HTMLElement);
    await screen.findByRole('heading', { name: 'Detalle', level: 2 });
    return view;
  }

  it('computes the four checks from the detail of the screen', async () => {
    await selectDetalle();

    const section = screen.getByRole('heading', { name: 'What to check', level: 3 })
      .parentElement as HTMLElement;
    await within(section).findByText('Template complete');
    expect(within(section).getByText('7 of 7 fields')).toBeVisible();
    expect(within(section).getByText('Links')).toBeVisible();
    expect(within(section).getByText('2 variables · 1 collection · 2 components')).toBeVisible();
    expect(within(section).getByText('3 Subtasks pending in Jira')).toBeVisible();
    expect(within(section).getByText('Miro diagram')).toBeVisible();
    expect(within(section).getByText('Linked')).toBeVisible();
  });

  it('draws the seven template fields, each with its state in words', async () => {
    await selectDetalle();

    const fields = (await screen.findByRole('heading', { name: 'Template fields', level: 3 }))
      .parentElement as HTMLElement;
    const items = within(fields).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'OnStart: has content',
      'Working process: has content',
      'Architecture: has content',
      'Data model: has content',
      'Requirements: has content',
      'Known issues: has content',
      'Risks: has content',
    ]);
  });

  it('says "Template incomplete" and which fields are empty when the template is not complete', async () => {
    await openReview({
      screens: [
        ...sampleScreens().filter((s) => s.id !== 12),
        reviewScreen(12, 'Detalle', {
          template: {
            onStart: 'x',
            workingProcess: null,
            architecture: null,
            dataModel: null,
            requirements: null,
            knownIssues: null,
            risks: '   ',
          },
        }),
      ],
    });

    expect(await screen.findByText('Template incomplete')).toBeVisible();
    expect(screen.getByText('1 of 7 fields')).toBeVisible();
    const fields = screen.getByRole('heading', { name: 'Template fields', level: 3 })
      .parentElement as HTMLElement;
    expect(
      within(fields)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'OnStart: has content',
      'Working process: empty',
      'Architecture: empty',
      'Data model: empty',
      'Requirements: empty',
      'Known issues: empty',
      'Risks: empty',
    ]);
  });

  it('shows the last comment with one tiny read: the page of the comment count, one per page', async () => {
    const view = await selectDetalle();

    expect(
      await screen.findByText('Added the double-save issue to Known issues. Submitting again.'),
    ).toBeVisible();
    expect(screen.getByText(/— Sample Developer A/)).toBeVisible();
    const reads = view.api.callsTo('GET /screens/{id}/comments');
    expect(reads).toHaveLength(1);
    expect(reads[0]?.options.query).toEqual({ page: 4, pageSize: 1 });
    expect(reads[0]?.options.path).toEqual({ id: 12 });
  });

  it('says there are no comments without asking the API when the count is 0', async () => {
    const view = await openReview();

    expect(await screen.findByText('No comments yet.')).toBeVisible();
    expect(view.api.callsTo('GET /screens/{id}/comments')).toHaveLength(0);
  });

  it('reads the new last comment when one arrived after the queue was read', async () => {
    const user = setupUser();
    const view = await openReview({
      screens: reviewQueueScreens().map((s) => (s.id === 13 ? { ...s, commentCount: 1 } : s)),
    });
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });

    // The queue says Busqueda has 1 comment; the API has 2 (45 and 46).
    await user.click(rowButtons()[1] as HTMLElement);

    expect(await screen.findByText('Busqueda last comment.')).toBeVisible();
    expect(
      view.api.callsTo('GET /screens/{id}/comments').map((call) => call.options.query?.page),
    ).toEqual([1, 2]);
  });

  it('opens the screen from "Open screen"', async () => {
    const user = setupUser();
    const view = await openReview();
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });

    await user.click(screen.getByRole('button', { name: 'Open screen' }));

    expect(view.router.state.location.pathname).toBe('/screens/14');
  });

  it('shows its own error and a retry when the screen cannot be read, without losing the queue', async () => {
    const view = await openReview({
      prepare: (api) => {
        api.failNext('GET /screens/{id}', new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
      },
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong on our side');
    expect(rowNames()).toEqual(['Reportes', 'Busqueda', 'Detalle']);

    const user = setupUser();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Template complete')).toBeVisible();
    expect(view.api.callsTo('GET /screens/{id}').length).toBeGreaterThanOrEqual(2);
  });
});

describe('an empty queue', () => {
  it('says so, with no panel', async () => {
    await openReview({
      screens: sampleScreens().map((s) => ({ ...s, documentationStatus: 'DRAFT' as const })),
    });

    expect(await screen.findByText('Nothing is waiting for review')).toBeVisible();
    expect(
      screen.getByText('Screens submitted for review will appear here, oldest first.'),
    ).toBeVisible();
    expect(screen.getByText('0 screens waiting for a decision · oldest first')).toBeVisible();
    expect(
      screen.queryByRole('list', { name: 'Screens waiting for review' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
});

describe('Load more', () => {
  /** `count` screens In review, the oldest first by id, in application 1. */
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      reviewScreen(100 + index, `Screen ${String(index + 1).padStart(2, '0')}`, {
        updatedAt: new Date(2026, 8, 1, 8, index).toISOString().slice(0, 19),
      }),
    );

  it('reads 20 and offers the rest, a page at a time, without repeating a row', async () => {
    const user = setupUser();
    const view = await openReview({ screens: many(45), comments: [] });
    await screen.findByRole('list', { name: 'Screens waiting for review' });

    expect(rowButtons()).toHaveLength(20);
    expect(screen.getByText('Showing 20 of 45')).toBeVisible();
    expect(screen.getByText('45 screens waiting for a decision · oldest first')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => {
      expect(rowButtons()).toHaveLength(40);
    });
    expect(screen.getByText('Showing 40 of 45')).toBeVisible();
    expect(queueReads(view).map((call) => call.options.query?.page)).toEqual([1, 2]);

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => {
      expect(rowButtons()).toHaveLength(45);
    });
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(new Set(rowNames()).size).toBe(45);
    expect(rowNames().at(0)).toBe('Screen 01');
    expect(rowNames().at(-1)).toBe('Screen 45');
  });

  it('says so when the next page cannot be read, keeps the rows and lets the user try again', async () => {
    const user = setupUser();
    const view = await openReview({ screens: many(25), comments: [] });
    await screen.findByRole('list', { name: 'Screens waiting for review' });
    view.api.failNext('GET /screens', new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The next screens couldn't be loaded. Try again.",
    );
    expect(rowButtons()).toHaveLength(20);

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => {
      expect(rowButtons()).toHaveLength(25);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('reading again', () => {
  it('reads the queue again when the browser tab becomes visible, with no polling', async () => {
    const view = await openReview();
    await screen.findByRole('list', { name: 'Screens waiting for review' });
    expect(queueReads(view)).toHaveLength(1);

    // Someone submitted another screen while the tab was hidden.
    view.api.state.screens = [
      ...view.api.state.screens,
      reviewScreen(15, 'Nueva', { updatedAt: '2026-10-05T10:00:00' }),
    ];
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(rowNames()).toEqual(['Reportes', 'Busqueda', 'Detalle', 'Nueva']);
    });
    expect(queueReads(view)).toHaveLength(2);
    // The selected screen stays selected.
    expect(screen.getByRole('heading', { name: 'Reportes', level: 2 })).toBeVisible();
  });

  it('does not read it when the tab becomes hidden', async () => {
    const view = await openReview();
    await screen.findByRole('list', { name: 'Screens waiting for review' });

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(queueReads(view)).toHaveLength(1);
  });

  it('shows the server-error state with a retry when the first read fails, and recovers', async () => {
    fixReviewClock();
    const view = await renderScreens({
      role: 'ADMINISTRATOR',
      path: '/review',
      screens: reviewQueueScreens(),
      prepare: (api) => {
        failQueueReads(api);
      },
    });

    expect(await screen.findByText('Something went wrong on our side')).toBeVisible();
    expect(
      screen.queryByRole('list', { name: 'Screens waiting for review' }),
    ).not.toBeInTheDocument();

    const user = setupUser();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Screens waiting for review' })).toBeVisible();
    expect(rowNames()).toEqual(['Reportes', 'Busqueda', 'Detalle']);
    // The failed read never reached the fake: only the retry is recorded.
    expect(queueReads(view as never)).toHaveLength(1);
  });

  it('keeps the list and says so when a new read fails', async () => {
    const user = setupUser();
    const view = await openReview();
    await screen.findByRole('list', { name: 'Screens waiting for review' });
    failQueueReads(view.api);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(await screen.findByText(/The queue couldn't be refreshed/)).toBeVisible();
    expect(rowNames()).toEqual(['Reportes', 'Busqueda', 'Detalle']);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.queryByText(/The queue couldn't be refreshed/)).not.toBeInTheDocument();
    });
  });
});
