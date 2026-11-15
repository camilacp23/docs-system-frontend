// Audit log, the "This period" panel (S-32): the number of records and of each action, from the `total` of
// GET /audit-log with pageSize=1, with the same filters as the timeline; each figure has its own state and a failure
// stays in the panel.
// Time and zone are fixed (fixClock): today is Oct 5, 2026 in America/Costa_Rica (UTC-6).
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { ENTRIES } from '../helpers/auditSample';
import { fixClock, renderAudit } from '../helpers/renderAudit';
import { setupUser } from '../helpers/setupUser';

beforeEach(() => {
  fixClock();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type Rendered = Awaited<ReturnType<typeof renderAudit>>;

function totalCalls(api: Rendered['api']) {
  return api.callsTo('GET /audit-log').filter((call) => call.options.query?.pageSize === 1);
}

function panel() {
  return screen.getByRole('complementary', { name: 'This period' });
}

function figure(label: string) {
  return within(panel()).getByText(label).closest('li') as HTMLElement;
}

describe('audit log, totals', () => {
  it('shows the records and the created, updated, deleted and event figures of the period', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Sample Developer A');

    await waitFor(() => {
      expect(figure('Records')).toHaveTextContent(/Records\s*6/);
    });
    expect(figure('Created')).toHaveTextContent(/Created\s*1/);
    expect(figure('Updated')).toHaveTextContent(/Updated\s*3/);
    expect(figure('Deleted')).toHaveTextContent(/Deleted\s*1/);
    expect(figure('Events')).toHaveTextContent(/Events\s*1/);
  });

  it('asks for one record at a time, one call for the total and one for each action', async () => {
    const { api } = await renderAudit({ entries: ENTRIES });
    await screen.findByText('Sample Developer A');
    await waitFor(() => {
      expect(totalCalls(api)).toHaveLength(5);
    });
    expect(
      totalCalls(api)
        .map((call) => call.options.query?.action ?? 'none')
        .sort(),
    ).toEqual(['CREATE', 'DELETE', 'EVENT', 'UPDATE', 'none']);
    expect(totalCalls(api).every((call) => call.options.query?.page === 1)).toBe(true);
  });

  it('uses the same filters as the timeline, except the action it splits by', async () => {
    const { api } = await renderAudit({
      entries: ENTRIES,
      path: '/audit?type=screen&action=UPDATE&from=2026-10-03&to=2026-10-05',
    });
    await screen.findByText('Detalle');
    await waitFor(() => {
      expect(totalCalls(api)).toHaveLength(5);
    });
    for (const call of totalCalls(api)) {
      expect(call.options.query).toMatchObject({
        applicationId: 1,
        entityType: 'screen',
        from: '2026-10-03T06:00:00.000Z',
        to: '2026-10-06T05:59:59.999Z',
      });
    }
    // The action filter narrows the timeline but not the figures: they still tell how the period splits.
    expect(figure('Created')).toHaveTextContent(/Created\s*0/);
    expect(figure('Updated')).toHaveTextContent(/Updated\s*1/);
    expect(figure('Records')).toHaveTextContent(/Records\s*2/);
  });

  it('is read again when a filter changes', async () => {
    const { api } = await renderAudit({ entries: ENTRIES });
    const user = setupUser();
    await screen.findByText('Sample Developer A');
    await waitFor(() => {
      expect(figure('Records')).toHaveTextContent(/Records\s*6/);
    });
    const before = totalCalls(api).length;

    await user.selectOptions(screen.getByRole('combobox', { name: 'Element type' }), 'Variable');
    await waitFor(() => {
      expect(figure('Records')).toHaveTextContent(/Records\s*1/);
    });
    expect(totalCalls(api).length).toBe(before + 5);
    expect(figure('Created')).toHaveTextContent(/Created\s*1/);
  });

  it('filters the timeline by the action of the figure that is chosen, and clears it when chosen again', async () => {
    const view = await renderAudit({ entries: ENTRIES });
    const user = setupUser();
    await screen.findByText('Sample Developer A');

    await user.click(within(panel()).getByRole('button', { name: /Deleted/ }));
    await screen.findByText('Fax');
    expect(screen.queryByText('Detalle')).toBeNull();
    expect(new URLSearchParams(view.router.state.location.search).get('action')).toBe('DELETE');
    expect(within(panel()).getByRole('button', { name: /Deleted/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(within(panel()).getByRole('button', { name: /Deleted/ }));
    await screen.findByText('Detalle');
    expect(new URLSearchParams(view.router.state.location.search).has('action')).toBe(false);
  });
});

describe('audit log, a figure that fails', () => {
  it('keeps the error in the panel, leaves the timeline alone and reads the failed figure again', async () => {
    await renderAudit({
      entries: ENTRIES,
      prepare: (fake) => {
        fake.failNext(
          'GET /audit-log',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR', requestId: 'req-9' }),
          { action: 'DELETE' },
        );
      },
    });
    const user = setupUser();

    expect(await screen.findByText('Sample Developer A')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(panel()).getByRole('alert')).toHaveTextContent("Couldn't load the totals.");
    });
    expect(within(figure('Deleted')).getByLabelText('Unavailable')).toBeInTheDocument();
    expect(figure('Created')).toHaveTextContent(/Created\s*1/);
    // The timeline is untouched.
    expect(screen.getByText('Fax')).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(figure('Deleted')).toHaveTextContent(/Deleted\s*1/);
    });
    expect(within(panel()).queryByRole('alert')).toBeNull();
  });

  it('asks for nothing while the range is upside down', async () => {
    const { api } = await renderAudit({
      entries: ENTRIES,
      path: '/audit?from=2026-10-05&to=2026-10-01',
    });
    await screen.findByText("To can't be earlier than From.");
    expect(api.callsTo('GET /audit-log')).toHaveLength(0);
    expect(within(figure('Records')).getByLabelText('Unavailable')).toBeInTheDocument();
  });
});
