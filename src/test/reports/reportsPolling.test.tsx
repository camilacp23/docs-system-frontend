// The polling of PENDING reports (NFR-12, Figure 27, D-135), driven with a fake clock so no test waits for real time: one
// request per PENDING report every 3 s, it stops at READY and FAILED, it stops while the tab is hidden and goes on when
// the tab is back, an old answer never replaces a newer one, it gives up after 180 s with "Check again", and it ends
// with the page. The toast offers "Download" when a report becomes READY.
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makePending, makeReport } from '../helpers/fakeReportsApi';
import { renderReports, setTabVisibility, useFakeReportClock } from '../helpers/renderReports';

afterEach(() => {
  setTabVisibility('visible');
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const detailCalls = (api: { callsTo: (operation: string) => unknown[] }) =>
  api.callsTo('GET /reports/{id}');
const card = (title: string) => {
  const item = screen.getByRole('heading', { name: title, level: 3 }).closest('li');
  if (item === null) throw new Error(`No card for ${title}`);
  return within(item);
};

describe('polling: the rhythm', () => {
  it('asks for a PENDING report every 3 seconds and not before', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({ reports: [makePending(5, { title: 'Weekly' })] });
    expect(card('Weekly').getByText('Generating')).toBeInTheDocument();
    expect(detailCalls(api)).toHaveLength(0);

    await clock.advance(2999);
    expect(detailCalls(api)).toHaveLength(0);
    await clock.advance(1);
    expect(detailCalls(api)).toHaveLength(1);
    await clock.advance(3000);
    expect(detailCalls(api)).toHaveLength(2);
    await clock.advance(3000);
    expect(detailCalls(api)).toHaveLength(3);
  });

  it('polls only the PENDING reports, one request each, never the READY ones', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({
      reports: [makePending(5), makePending(6), makeReport(4), makeReport(3)],
    });

    await clock.advance(3000);

    const ids = detailCalls(api).map(
      (call) => (call as { options: { path: { id: number } } }).options.path.id,
    );
    expect(ids.sort()).toEqual([5, 6]);
  });

  it('stops at READY: the row is Ready, a toast offers Download and nothing is asked again', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({ reports: [makePending(5, { title: 'Weekly' })] });
    api.settle(5, 'READY');

    await clock.advance(3000);

    expect(card('Weekly').getByText('Ready')).toBeInTheDocument();
    expect(card('Weekly').getByText('Completed Oct 5 · 10:00 · 412 KB')).toBeInTheDocument();
    expect(screen.getByText(/is ready\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    const asked = detailCalls(api).length;
    await clock.advance(30_000);
    expect(detailCalls(api)).toHaveLength(asked);
  });

  it('leaves a report that was asked to publish published when it becomes READY (P-06)', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({
      reports: [makePending(5, { title: 'Weekly' })],
      parameters: {
        5: {
          format: 'PDF',
          scope: {
            elementTypes: ['SCREEN'],
            includeStatusSummary: false,
            includeDependencies: false,
          },
          publish: true,
        },
      },
    });
    api.settle(5, 'READY');

    await clock.advance(3000);

    expect(card('Weekly').getByRole('switch', { name: 'Published' })).toBeChecked();
  });

  it('stops at FAILED and shows the reason of the API, with Generate again and no toast', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({ reports: [makePending(5, { title: 'Weekly' })] });
    api.settle(5, 'FAILED');

    await clock.advance(3000);

    expect(card('Weekly').getByText('Failed')).toBeInTheDocument();
    expect(
      card('Weekly').getByText("The report couldn't be generated. Try again in a few minutes."),
    ).toBeInTheDocument();
    expect(card('Weekly').getByRole('button', { name: 'Generate again' })).toBeInTheDocument();
    expect(screen.queryByText(/is ready\.$/)).not.toBeInTheDocument();
    const asked = detailCalls(api).length;
    await clock.advance(30_000);
    expect(detailCalls(api)).toHaveLength(asked);
  });

  it('does not stop for a network failure: it tries again at the next tick', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({
      reports: [makePending(5, { title: 'Weekly' })],
      prepare: (fake) => {
        fake.failNext('GET /reports/{id}', new ApiError({ status: 0, code: 'NETWORK_ERROR' }));
      },
    });

    await clock.advance(3000);
    expect(detailCalls(api)).toHaveLength(1);
    api.settle(5, 'READY');
    await clock.advance(3000);

    expect(detailCalls(api)).toHaveLength(2);
    expect(card('Weekly').getByText('Ready')).toBeInTheDocument();
  });

  it('reads the list again when the report is no longer readable (404)', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({
      reports: [makePending(5, { title: 'Weekly' })],
      prepare: (fake) => {
        fake.failNext(
          'GET /reports/{id}',
          new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'report', id: 5 } }),
        );
      },
    });
    const before = api.callsTo('GET /reports').length;

    await clock.advance(3000);

    expect(api.callsTo('GET /reports').length).toBeGreaterThan(before);
    const asked = detailCalls(api).length;
    await clock.advance(9000);
    expect(detailCalls(api).length).toBeGreaterThanOrEqual(asked);
  });
});

describe('polling: the tab and the page', () => {
  it('does not ask while the tab is hidden and asks at once when it is back', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({ reports: [makePending(5, { title: 'Weekly' })] });

    setTabVisibility('hidden');
    await clock.advance(30_000);
    expect(detailCalls(api)).toHaveLength(0);

    setTabVisibility('visible');
    await clock.advance(0);
    expect(detailCalls(api)).toHaveLength(1);
    await clock.advance(3000);
    expect(detailCalls(api)).toHaveLength(2);
  });

  it('aborts the request in flight when the tab is hidden', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({
      reports: [makePending(5, { title: 'Weekly' })],
      prepare: (fake) => {
        fake.hold((call) => call.path === '/reports/{id}');
      },
    });
    await clock.advance(3000);
    const signal = (detailCalls(api)[0] as { options: { signal: AbortSignal } }).options.signal;
    expect(signal.aborted).toBe(false);

    setTabVisibility('hidden');

    expect(signal.aborted).toBe(true);
  });

  it('drops an old answer that arrives after a newer one', async () => {
    const clock = useFakeReportClock();
    const gate = { release: () => {} };
    const { api } = await renderReports({
      reports: [makePending(5, { title: 'Weekly' })],
      prepare: (fake) => {
        // Only the first poll waits; the one after the tab comes back is answered at once.
        let first = true;
        const held = fake.hold((call) => {
          if (call.path !== '/reports/{id}' || !first) return false;
          first = false;
          return true;
        });
        gate.release = held.release;
      },
    });
    await clock.advance(3000); // poll 1: in flight, the server read it as PENDING
    api.settle(5, 'READY');
    setTabVisibility('hidden');
    setTabVisibility('visible'); // poll 2: the server answers READY
    await clock.advance(0);
    expect(card('Weekly').getByText('Ready')).toBeInTheDocument();

    gate.release(); // poll 1 now arrives, with PENDING
    await clock.advance(0);

    expect(card('Weekly').getByText('Ready')).toBeInTheDocument();
    expect(card('Weekly').queryByText('Generating')).not.toBeInTheDocument();
    const asked = detailCalls(api).length;
    await clock.advance(9000);
    expect(detailCalls(api)).toHaveLength(asked);
  });

  it('stops asking and aborts what is in flight when the user leaves the page', async () => {
    const clock = useFakeReportClock();
    const { api, router } = await renderReports({
      reports: [makePending(5, { title: 'Weekly' })],
      prepare: (fake) => {
        fake.hold((call) => call.path === '/reports/{id}');
      },
    });
    await clock.advance(3000);
    const signal = (detailCalls(api)[0] as { options: { signal: AbortSignal } }).options.signal;

    await router.navigate('/variables');
    await clock.advance(0);

    expect(signal.aborted).toBe(true);
    const asked = detailCalls(api).length;
    await clock.advance(30_000);
    expect(detailCalls(api)).toHaveLength(asked);
  });
});

describe('polling: the cap of 180 seconds', () => {
  it('gives up with a message and "Check again", and starts again when asked', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({ reports: [makePending(5, { title: 'Weekly' })] });

    await clock.advance(177_000);
    expect(card('Weekly').queryByText(/Still generating/)).not.toBeInTheDocument();
    await clock.advance(3000); // t = 180 s: the answer is still PENDING and the cap is reached
    expect(
      card('Weekly').getByText('Still generating. You can keep working or check again.'),
    ).toBeInTheDocument();
    const asked = detailCalls(api).length;
    expect(asked).toBe(60);
    await clock.advance(30_000);
    expect(detailCalls(api)).toHaveLength(asked);

    api.settle(5, 'READY');
    // fireEvent, not userEvent: the user-event wrapper waits on a real timer, which a fake clock never fires.
    fireEvent.click(card('Weekly').getByRole('button', { name: 'Check again' }));
    await clock.advance(0);

    expect(detailCalls(api)).toHaveLength(asked + 1);
    expect(card('Weekly').getByText('Ready')).toBeInTheDocument();
  });

  it('keeps a timed-out report quiet when another report appears or goes', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({
      reports: [makePending(5, { title: 'Weekly' }), makePending(6, { title: 'Second' })],
    });
    await clock.advance(180_000);
    api.settle(6, 'READY');
    const asked = detailCalls(api).length;

    await clock.advance(30_000);

    // Both gave up at the same time: nothing is asked until the user presses "Check again".
    expect(detailCalls(api)).toHaveLength(asked);
    expect(card('Weekly').getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  });
});
