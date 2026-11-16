// The report list (S-33, S-33r, P-05, FR-22): the cards with their three states, the order of the API, the filter and its
// counts, the Reader's view, the empty and error states, the pages in the URL, and the archived application (generate and
// publish stay allowed, D-47).
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeApplication } from '../helpers/renderApp';
import {
  FAILED_TEXTS,
  makeFailed,
  makePending,
  makePublished,
  makeReport,
} from '../helpers/fakeReportsApi';
import { fixClock } from '../helpers/renderAudit';
import { renderReports } from '../helpers/renderReports';
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

function sample() {
  return [
    makePending(5, { title: 'Screens in review — weekly' }),
    makePublished(4, { title: 'SAR documentation status' }),
    makeReport(3, { title: 'Variables and collections', format: 'XLSX' }),
    makeFailed(2, { title: 'Full export with dependencies', format: 'XLSX' }),
    makePublished(1, { title: 'Collections and fields', format: 'XLSX' }),
  ];
}

describe('reports: the list as an Administrator', () => {
  it('shows every report newest first, with the three states and their labels', async () => {
    fixClock();
    await renderReports({ reports: sample() });

    const titles = (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent);
    expect(titles).toEqual([
      'Screens in review — weekly',
      'SAR documentation status',
      'Variables and collections',
      'Full export with dependencies',
      'Collections and fields',
    ]);
    expect(card('Screens in review — weekly').getByText('Generating')).toBeInTheDocument();
    expect(
      card('Screens in review — weekly').getByText('Building in the background'),
    ).toBeInTheDocument();
    expect(card('SAR documentation status').getByText('Ready')).toBeInTheDocument();
    expect(
      card('SAR documentation status').getByText('Completed Oct 5 · 09:01 · 412 KB'),
    ).toBeInTheDocument();
    expect(card('Full export with dependencies').getByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reports', level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText('Saved reports of SAR. Published ones are visible to Readers.'),
    ).toBeInTheDocument();
  });

  it('shows the errorMessage of a failed report exactly as the API sends it, and Generate again instead of Download', async () => {
    await renderReports({
      reports: [makeFailed(2, { title: 'Broken', errorMessage: FAILED_TEXTS.generic })],
    });

    const failed = card('Broken');
    expect(
      await failed.findByText("The report couldn't be generated. Try again in a few minutes."),
    ).toBeInTheDocument();
    expect(failed.getByRole('button', { name: 'Generate again' })).toBeInTheDocument();
    expect(failed.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();
  });

  it('disables Download and the switch of a PENDING report, with the reason', async () => {
    await renderReports({ reports: [makePending(5, { title: 'Wait for me' })] });

    const pending = card('Wait for me');
    expect(await pending.findByRole('button', { name: /Download/ })).toHaveAttribute('disabled');
    const published = pending.getByRole('switch', { name: 'Not published' });
    expect(published).toHaveAttribute('aria-disabled', 'true');
    expect(published).toHaveAccessibleDescription('Available when the report is ready.');
  });

  it('gives a FAILED report a switch that is off with its own reason', async () => {
    await renderReports({ reports: [makeFailed(2, { title: 'Broken' })] });

    const published = await card('Broken').findByRole('switch');
    expect(published).toHaveAttribute('aria-disabled', 'true');
    expect(published).toHaveAccessibleDescription("A failed report can't be published.");
  });

  it('shows the counts of "All" and "Published" from two reads of one report', async () => {
    const { api } = await renderReports({ reports: sample() });

    expect(await screen.findByRole('radio', { name: 'All · 5' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Published · 2' })).not.toBeChecked();
    const reads = api.callsTo('GET /reports').filter((call) => call.options.query?.pageSize === 1);
    expect(reads.map((call) => call.options.query?.published).sort()).toEqual([true, undefined]);
  });

  it('omits a count that could not be read and keeps the filter working', async () => {
    await renderReports({
      reports: sample(),
      prepare: (api) => {
        api.failNext(
          'GET /reports',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
          (call) => call.options.query?.pageSize === 1 && call.options.query.published === true,
        );
      },
    });

    expect(await screen.findByRole('radio', { name: 'All · 5' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Published' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5);
  });

  it('filters the published reports and keeps the filter in the URL', async () => {
    const user = setupUser();
    const { api, router } = await renderReports({ reports: sample() });
    await screen.findByRole('radio', { name: 'Published · 2' });

    await user.click(screen.getByRole('radio', { name: 'Published · 2' }));

    expect(router.state.location.search).toBe('?published=true');
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'SAR documentation status',
      'Collections and fields',
    ]);
    expect(
      api
        .callsTo('GET /reports')
        .some(
          (call) => call.options.query?.published === true && call.options.query.pageSize === 12,
        ),
    ).toBe(true);
  });

  it('offers to show all reports when none is published', async () => {
    const user = setupUser();
    await renderReports({
      reports: [makeReport(1, { title: 'Not shared' })],
      path: '/reports?published=true',
    });

    expect(await screen.findByText('No published reports')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all reports' }));
    expect(
      await screen.findByRole('heading', { name: 'Not shared', level: 3 }),
    ).toBeInTheDocument();
  });

  it('shows the empty state of an application without reports', async () => {
    await renderReports({ reports: [] });
    expect(await screen.findByText('No reports yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Generate a report to share the documentation of SAR as a PDF or an Excel file.',
      ),
    ).toBeInTheDocument();
  });

  it('asks the API for 12 per page and goes to the next page', async () => {
    const user = setupUser();
    const many = Array.from({ length: 14 }, (_, index) =>
      makeReport(index + 1, { title: `R ${index + 1}` }),
    );
    const { router } = await renderReports({ reports: many });

    expect((await screen.findAllByRole('heading', { level: 3 })).length).toBe(12);
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(router.state.location.search).toBe('?page=2');
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'R 2',
      'R 1',
    ]);
  });

  it('has no pagination row when the whole list fits in one page, as in the frames', async () => {
    await renderReports({ reports: sample() });

    expect(await screen.findAllByRole('heading', { level: 3 })).toHaveLength(5);
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    expect(screen.queryByText('Rows per page')).not.toBeInTheDocument();
  });

  it('shows the server error state with a retry when the list cannot be read', async () => {
    const user = setupUser();
    await renderReports({
      reports: sample(),
      prepare: (api) => {
        api.failNext(
          'GET /reports',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR', requestId: 'req-9' }),
          (call) => call.options.query?.pageSize !== 1,
        );
      },
    });

    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    expect(screen.getByText('req-9')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: 'SAR documentation status', level: 3 }),
    ).toBeInTheDocument();
  });
});

describe('reports: the Reader', () => {
  it('sees only the published reports, with the Published tag and date, and no write action', async () => {
    fixClock();
    const { api } = await renderReports({ role: 'READER', reports: sample() });

    const published = await screen.findByRole('heading', {
      name: 'SAR documentation status',
      level: 3,
    });
    expect(published).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'SAR documentation status',
      'Collections and fields',
    ]);
    const own = card('SAR documentation status');
    expect(own.getByText('Published')).toBeInTheDocument();
    expect(own.getByText('Published 2026-10-05')).toBeInTheDocument();
    expect(own.getByRole('button', { name: /Download/ })).toBeEnabled();
    expect(screen.getByText('Reports published for you.')).toBeInTheDocument();
    // No switch, no filter, no generate, no "Generate again".
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generate/ })).not.toBeInTheDocument();
    // The Reader's list is asked without `published` and the counts are not read at all.
    expect(
      api.callsTo('GET /reports').every((call) => call.options.query?.published === undefined),
    ).toBe(true);
    expect(api.callsTo('GET /reports').every((call) => call.options.query?.pageSize !== 1)).toBe(
      true,
    );
  });

  it('ignores ?published in the URL and shows its own empty state', async () => {
    await renderReports({
      role: 'READER',
      reports: [makeReport(1)],
      path: '/reports?published=true',
    });
    expect(await screen.findByText('No published reports yet')).toBeInTheDocument();
    expect(screen.getByText('Reports published by the team will appear here.')).toBeInTheDocument();
  });
});

describe('reports: an archived application', () => {
  it('shows the read-only notice and still lets a writer publish and generate again', async () => {
    const user = setupUser();
    await renderReports({
      reports: [makeReport(3, { title: 'Ready one' }), makeFailed(2, { title: 'Broken' })],
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });

    expect(await screen.findByText('This application is archived.')).toBeInTheDocument();
    const ready = card('Ready one');
    expect(ready.getByRole('switch')).not.toHaveAttribute('aria-disabled');
    expect(card('Broken').getByRole('button', { name: 'Generate again' })).toBeEnabled();

    await user.click(ready.getByRole('switch'));
    expect(
      await screen.findByText('Published. Readers can now see this report.'),
    ).toBeInTheDocument();
  });
});
