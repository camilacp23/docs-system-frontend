// Audit log, the timeline (S-32): the default period, the request, the days and records, actors, states and paging.
// Time and zone are fixed (fixClock): today is Oct 5, 2026 and the browser's zone is America/Costa_Rica (UTC-6).
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { encodeQuery } from '../../api/encodeQuery';
import { makeEntry } from '../helpers/fakeAuditApi';
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

/** The calls that read the timeline (the totals of the side panel ask for one record). */
function listCalls(api: Awaited<ReturnType<typeof renderAudit>>['api']) {
  return api.callsTo('GET /audit-log').filter((call) => call.options.query?.pageSize !== 1);
}

/** The record whose element label is `label` (the shell shows names too, such as the application card's "SAR"). */
function recordText(label: string) {
  return within(screen.getByRole('region', { name: 'Audit records' }))
    .getByText(label)
    .closest('li') as HTMLElement;
}

describe('audit log, the default period', () => {
  it('opens on Last 7 days, writes it to the URL and asks once for the selected application, from the start of the first day to the end of the last', async () => {
    const { api, router } = await renderAudit({ entries: ENTRIES });

    await screen.findByText('Sample Developer A');
    expect(router.state.location.search).toBe('?from=2026-09-29&to=2026-10-05');
    expect(listCalls(api)).toHaveLength(1);
    expect(listCalls(api)[0]?.options.query).toEqual({
      applicationId: 1,
      from: '2026-09-29T06:00:00.000Z',
      to: '2026-10-06T05:59:59.999Z',
      page: 1,
      pageSize: 20,
    });
    expect(screen.getByRole('button', { name: 'Period: Last 7 days' })).toBeInTheDocument();
  });

  it('writes the request with the reserved characters encoded (the instants carry ":", an element id too)', () => {
    expect(
      encodeQuery({
        entityType: 'element_environment',
        entityId: '12:DEV',
        from: '2026-09-29T06:00:00.000Z',
        to: '2026-10-06T05:59:59.999Z',
        page: 1,
        pageSize: 20,
      }),
    ).toBe(
      'entityType=element_environment&entityId=12%3ADEV&from=2026-09-29T06%3A00%3A00.000Z&to=2026-10-06T05%3A59%3A59.999Z&page=1&pageSize=20',
    );
  });

  it('keeps the dates of the URL and does not replace them with the default', async () => {
    const { api, router } = await renderAudit({
      entries: ENTRIES,
      path: '/audit?from=2026-10-03&to=2026-10-03',
    });
    await screen.findByText('Fax');
    expect(router.state.location.search).toBe('?from=2026-10-03&to=2026-10-03');
    expect(listCalls(api)[0]?.options.query).toMatchObject({
      from: '2026-10-03T06:00:00.000Z',
      to: '2026-10-04T05:59:59.999Z',
    });
    expect(screen.getByRole('button', { name: 'Period: Oct 3 – Oct 3' })).toBeInTheDocument();
  });
});

describe('audit log, days and records', () => {
  it('groups the records by local day, newest first, under headings and ordered lists', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Sample Developer A');

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
      .filter((text) => text.includes(' · '));
    expect(headings).toEqual(['Today · Oct 5', 'Yesterday · Oct 4', 'Saturday · Oct 3']);

    const today = screen.getByRole('list', { name: 'Today · Oct 5' });
    expect(
      within(today)
        .getAllByRole('listitem')
        .filter((item) => item.querySelector('time') !== null)
        .map((item) => item.querySelector('time')?.textContent),
    ).toEqual(['10:21', '10:05', '09:52', '09:14']);
    expect(screen.getByRole('list', { name: 'Saturday · Oct 3' })).toBeInTheDocument();
  });

  it('writes each record as "<actor> <action> <type> <label>" in the local time of the browser', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Sample Developer A');

    expect(recordText('Detalle')).toHaveTextContent(
      '10:21Sample Developer A updated screen Detalle',
    );
    expect(recordText('Inicio')).toHaveTextContent(
      '10:05Ana Mora approved the documentation of Inicio',
    );
    expect(recordText('locOrden')).toHaveTextContent(
      '09:14Sample Developer B created variable locOrden',
    );
    expect(recordText('Fax')).toHaveTextContent('Ana Mora deleted collection field Fax');
    // 2026-10-04T23:02Z is still Oct 4 at 17:02 in Costa Rica.
    expect(recordText('SAR')).toHaveTextContent('17:02');
  });

  it('shows a chip for each field an UPDATE changed, and none for the other actions', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Sample Developer A');

    const chips = within(recordText('Detalle')).getByRole('list', { name: 'Changed fields' });
    expect(
      within(chips)
        .getAllByRole('listitem')
        .map((chip) => chip.textContent),
    ).toEqual(['Working process', 'Known issues']);
    expect(
      within(recordText('locOrden')).queryByRole('list', { name: 'Changed fields' }),
    ).toBeNull();
  });
});

describe('audit log, who did it', () => {
  it('says "Outside the application" for a null actor and adds the database role for an Administrator', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Sample Developer A');
    expect(recordText('SAR')).toHaveTextContent(
      'Outside the application (docs_owner) updated application SAR',
    );
  });

  it('shows the Jira integration account by its name', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Sample Developer A');
    expect(recordText('TECHEA-104')).toHaveTextContent(
      'Integración Jira updated ticket TECHEA-104',
    );
  });
});

describe('audit log, states', () => {
  it('shows "No results" with Clear filters when nothing matches, and Clear filters brings the default view back', async () => {
    const { api, router } = await renderAudit({
      entries: ENTRIES,
      path: '/audit?type=report&from=2026-09-29&to=2026-10-05',
    });
    const user = setupUser();

    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(screen.getByText('No records match these filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await screen.findByText('Sample Developer A');
    expect(router.state.location.search).toBe('?from=2026-09-29&to=2026-10-05');
    expect(listCalls(api).at(-1)?.options.query).not.toHaveProperty('entityType');
  });

  it('shows the server error state inside the card and reads again with "Try again"', async () => {
    const { api } = await renderAudit({
      entries: ENTRIES,
      prepare: (fake) => {
        fake.failNext(
          'GET /audit-log',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR', requestId: 'req-77' }),
        );
      },
    });
    const user = setupUser();

    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    expect(screen.getByText('req-77')).toBeInTheDocument();
    // The rest of the page keeps working: the filters are there.
    expect(screen.getByRole('combobox', { name: 'User' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Sample Developer A')).toBeInTheDocument();
    expect(listCalls(api)).toHaveLength(2);
  });

  it('pages by 20 and lets the page size change to 50 and 100', async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      makeEntry(100 + index, {
        entityLabel: `scr${String(index).padStart(2, '0')}`,
        createdAt: `2026-10-05T16:${String(59 - index).padStart(2, '0')}:00.000Z`,
      }),
    );
    const { api, router } = await renderAudit({ entries: many });
    const user = setupUser();

    await screen.findByText('scr00');
    expect(screen.getByText(/Showing 1.20 of 25/)).toBeInTheDocument();
    expect(screen.queryByText('scr20')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('scr20');
    expect(router.state.location.search).toContain('page=2');
    expect(listCalls(api).at(-1)?.options.query).toMatchObject({ page: 2, pageSize: 20 });
    expect(screen.queryByText('scr00')).toBeNull();
    expect(screen.getByText(/Showing 21.25 of 25/)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');
    await screen.findByText('scr00');
    expect(router.state.location.search).toContain('pageSize=50');
    expect(router.state.location.search).not.toContain('page=2');
    await waitFor(() => {
      expect(listCalls(api).at(-1)?.options.query).toMatchObject({ page: 1, pageSize: 50 });
    });
  });
});
