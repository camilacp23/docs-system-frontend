// Publish and unpublish (FR-22, D-121, D-137, D-138): PUT /reports/{id}/publication with the If-Match of the report, the
// toasts, the counts read again, the 412 as the S-44 pattern (a banner with "Reload"; the switch takes the value the
// server holds), 409 and 404 with their catalog texts, and the reasons a switch is off (PENDING, FAILED, offline).
import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeFailed, makePending, makePublished, makeReport } from '../helpers/fakeReportsApi';
import { renderReports } from '../helpers/renderReports';
import { setupUser } from '../helpers/setupUser';

afterEach(() => {
  vi.restoreAllMocks();
});

const card = (title: string) => {
  const item = screen.getByRole('heading', { name: title, level: 3 }).closest('li');
  if (item === null) throw new Error(`No card for ${title}`);
  return within(item);
};

describe('publication', () => {
  it('publishes with the ETag built from updatedAt (D-118), toasts and counts it', async () => {
    const user = setupUser();
    const report = makeReport(7, { title: 'Status' });
    const { api } = await renderReports({
      reports: [report, makePublished(1, { title: 'Other' })],
    });
    expect(await screen.findByRole('radio', { name: 'Published · 1' })).toBeInTheDocument();

    await user.click(card('Status').getByRole('switch', { name: 'Not published' }));

    const [call] = api.callsTo('PUT /reports/{id}/publication');
    expect(call?.options).toMatchObject({
      path: { id: 7 },
      ifMatch: `W/"${Date.parse(report.updatedAt)}"`,
      body: { isPublished: true },
    });
    expect(
      await screen.findByText('Published. Readers can now see this report.'),
    ).toBeInTheDocument();
    expect(card('Status').getByRole('switch', { name: 'Published' })).toBeChecked();
    expect(await screen.findByRole('radio', { name: 'Published · 2' })).toBeInTheDocument();
  });

  it('unpublishes with its own toast', async () => {
    const user = setupUser();
    const { api } = await renderReports({ reports: [makePublished(7, { title: 'Status' })] });

    await user.click(await card('Status').findByRole('switch', { name: 'Published' }));

    expect(api.callsTo('PUT /reports/{id}/publication')[0]?.options.body).toEqual({
      isPublished: false,
    });
    expect(
      await screen.findByText('Unpublished. Readers can no longer see this report.'),
    ).toBeInTheDocument();
    expect(card('Status').getByRole('switch', { name: 'Not published' })).not.toBeChecked();
  });

  it('uses the ETag of the last answer for the next change', async () => {
    const user = setupUser();
    const { api } = await renderReports({ reports: [makeReport(7, { title: 'Status' })] });

    await user.click(await card('Status').findByRole('switch'));
    await screen.findByText('Published. Readers can now see this report.');
    await user.click(card('Status').getByRole('switch'));

    const calls = api.callsTo('PUT /reports/{id}/publication');
    expect(calls).toHaveLength(2);
    expect(
      api.calls
        .filter((c) => c.path === '/reports/{id}/publication')
        .every((c) => c.options.ifMatch),
    ).toBe(true);
    expect(
      await screen.findByText('Unpublished. Readers can no longer see this report.'),
    ).toBeInTheDocument();
  });

  it('shows the S-44 banner on a 412, reads the list again and offers Reload; the switch takes the server value', async () => {
    const user = setupUser();
    const { api } = await renderReports({ reports: [makeReport(7, { title: 'Status' })] });
    await card('Status').findByRole('switch');
    // Someone else published it meanwhile: the server holds another updatedAt and the value "published".
    api.state.reports = [
      { ...makePublished(7, { title: 'Status' }), updatedAt: '2026-10-05T17:30:00.000Z' },
    ];

    await user.click(card('Status').getByRole('switch', { name: 'Not published' }));

    expect(
      await screen.findByText(
        'Someone else saved changes to this report after you opened it. Reload to see their version.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Published. Readers can now see this report.'),
    ).not.toBeInTheDocument();
    // The list was read again: the switch shows what the server holds, not what the user asked for.
    expect(await card('Status').findByRole('switch', { name: 'Published' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(screen.queryByText(/Someone else saved changes to this report/)).not.toBeInTheDocument();
  });

  it('says that only a ready report can be published (409) and reads the list again', async () => {
    const user = setupUser();
    const { api } = await renderReports({
      reports: [makeReport(7, { title: 'Status' })],
      prepare: (fake) => {
        fake.failNext(
          'PUT /reports/{id}/publication',
          new ApiError({ status: 409, code: 'REPORT_NOT_READY', details: { status: 'PENDING' } }),
        );
      },
    });
    const reads = api.callsTo('GET /reports').length;

    await user.click(await card('Status').findByRole('switch'));

    expect(
      await screen.findByText('Only ready reports can be published or downloaded.'),
    ).toBeInTheDocument();
    expect(api.callsTo('GET /reports').length).toBeGreaterThan(reads);
    expect(card('Status').getByRole('switch', { name: 'Not published' })).not.toBeChecked();
  });

  it('says that the report no longer exists (404)', async () => {
    const user = setupUser();
    await renderReports({
      reports: [makeReport(7, { title: 'Status' })],
      prepare: (fake) => {
        fake.failNext(
          'PUT /reports/{id}/publication',
          new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'report', id: 7 } }),
        );
      },
    });

    await user.click(await card('Status').findByRole('switch'));

    expect(
      await screen.findByText("This report doesn't exist. It may have been deleted."),
    ).toBeInTheDocument();
  });

  it('does nothing when a switch that is off is pressed', async () => {
    const user = setupUser();
    const { api } = await renderReports({
      reports: [makePending(5, { title: 'Wait' }), makeFailed(2, { title: 'Broken' })],
    });

    await user.click(await card('Wait').findByRole('switch'));
    await user.click(card('Broken').getByRole('switch'));

    expect(api.callsTo('PUT /reports/{id}/publication')).toHaveLength(0);
  });

  it('keeps the switches reachable by keyboard and operates them with Space', async () => {
    const user = setupUser();
    const { api } = await renderReports({ reports: [makeReport(7, { title: 'Status' })] });
    const published = await card('Status').findByRole('switch');

    published.focus();
    await user.keyboard(' ');

    expect(api.callsTo('PUT /reports/{id}/publication')).toHaveLength(1);
  });

  it('turns the writes off with the reason while offline, but not Download', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    await renderReports({
      reports: [makeReport(7, { title: 'Status' }), makeFailed(2, { title: 'Broken' })],
    });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const offline = "You're offline. Changes can't be saved until the connection is back.";
    expect(card('Status').getByRole('switch')).toHaveAccessibleDescription(offline);
    expect(card('Broken').getByRole('button', { name: 'Generate again' })).toBeDisabled();
    expect(card('Status').getByRole('button', { name: 'Download Status' })).toBeEnabled();
  });
});
