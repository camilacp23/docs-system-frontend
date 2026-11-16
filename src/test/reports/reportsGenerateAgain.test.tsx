// "Generate again" on a FAILED report (D-55): it reads GET /reports/{id}, sends a NEW POST with its parameters and the same
// title, the FAILED report stays, the new PENDING report appears first (All, page 1, D-141) and is followed by the polling.
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeFailed, makeReport } from '../helpers/fakeReportsApi';
import { renderReports, useFakeReportClock } from '../helpers/renderReports';
import { setupUser } from '../helpers/setupUser';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const card = (title: string) => {
  const item = screen.getByRole('heading', { name: title, level: 3 }).closest('li');
  if (item === null) throw new Error(`No card for ${title}`);
  return within(item);
};

describe('generate again', () => {
  it('posts a new report with the stored parameters and the same title, and keeps the failed one', async () => {
    const user = setupUser();
    const { api } = await renderReports({
      reports: [makeFailed(2, { title: 'Full export', format: 'XLSX' })],
      parameters: {
        2: {
          format: 'XLSX',
          scope: {
            elementTypes: ['SCREEN', 'COMPONENT'],
            screenIds: [7, 9],
            documentationStatus: ['APPROVED'],
            includeStatusSummary: true,
            includeDependencies: false,
          },
          publish: true,
        },
      },
    });

    await user.click(await card('Full export').findByRole('button', { name: 'Generate again' }));

    expect(api.callsTo('GET /reports/{id}')[0]?.options.path).toEqual({ id: 2 });
    const posts = api.callsTo('POST /reports/excel');
    expect(posts).toHaveLength(1);
    expect(api.callsTo('POST /reports/pdf')).toHaveLength(0);
    expect(posts[0]?.options.body).toEqual({
      applicationId: 1,
      title: 'Full export',
      scope: {
        elementTypes: ['SCREEN', 'COMPONENT'],
        screenIds: [7, 9],
        documentationStatus: ['APPROVED'],
        includeStatusSummary: true,
        includeDependencies: false,
      },
      publish: true,
    });
    // Two cards with the same title: the new one (Generating) first, the failed one still there.
    const titles = await screen.findAllByRole('heading', { name: 'Full export', level: 3 });
    expect(titles).toHaveLength(2);
    expect(screen.getByText('Generating')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('is being generated again.', { exact: false })).toBeInTheDocument();
  });

  it('uses the PDF operation for a PDF report', async () => {
    const user = setupUser();
    const { api } = await renderReports({
      reports: [makeFailed(2, { title: 'Doc', format: 'PDF' })],
    });

    await user.click(await card('Doc').findByRole('button', { name: 'Generate again' }));

    expect(api.callsTo('POST /reports/pdf')).toHaveLength(1);
  });

  it('goes back to All and page 1 so the new report is on screen', async () => {
    const user = setupUser();
    const many = [
      makeFailed(1, { title: 'Oldest failed' }),
      ...Array.from({ length: 13 }, (_, index) =>
        makeReport(index + 2, { title: `R ${index + 2}` }),
      ),
    ];
    const { router } = await renderReports({ reports: many, path: '/reports?page=2' });

    await user.click(await card('Oldest failed').findByRole('button', { name: 'Generate again' }));

    await screen.findByText('Generating');
    expect(router.state.location.search).toBe('');
  });

  it('follows the new report with the polling until it is ready', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({ reports: [makeFailed(2, { title: 'Doc' })] });

    fireEvent.click(card('Doc').getByRole('button', { name: 'Generate again' }));
    await clock.advance(0);
    const created = api.state.nextId - 1;
    expect(screen.getByText('Generating')).toBeInTheDocument();
    api.settle(created, 'READY');
    await clock.advance(3000);

    const polled = api.callsTo('GET /reports/{id}').map((call) => call.options.path?.id);
    expect(polled).toContain(created);
    expect(screen.getAllByText('Ready')).toHaveLength(1);
  });

  it('shows the catalog text when the new request fails and keeps the report as it was', async () => {
    const user = setupUser();
    await renderReports({
      reports: [makeFailed(2, { title: 'Doc' })],
      prepare: (fake) => {
        fake.failNext(
          'POST /reports/pdf',
          new ApiError({
            status: 404,
            code: 'NOT_FOUND',
            details: { element: 'screen', id: 9, field: 'scope.screenIds[0]' },
          }),
        );
      },
    });

    await user.click(await card('Doc').findByRole('button', { name: 'Generate again' }));

    expect(
      await screen.findByText("This screen doesn't exist. It may have been deleted."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    expect(card('Doc').getByRole('button', { name: 'Generate again' })).toBeEnabled();
  });
});
