// Audit log, the filters (S-32, S-32f): element type, element id (enabled only with a type), action, application,
// user (searched on the server), the period (shortcuts, custom range, inclusive limits, upside-down range) and the
// API's 400 marked on the field it names. Everything is in the URL and in the request.
// Time and zone are fixed (fixClock): today is Oct 5, 2026 in America/Costa_Rica (UTC-6).
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { ENTRIES } from '../helpers/auditSample';
import { makeEntry } from '../helpers/fakeAuditApi';
import { makeUser } from '../helpers/fakeUsersApi';
import { fixClock, renderAudit } from '../helpers/renderAudit';
import { endSearchPause } from '../helpers/searchPause';
import { setupUser } from '../helpers/setupUser';

beforeEach(() => {
  fixClock({ searchPause: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type Rendered = Awaited<ReturnType<typeof renderAudit>>;

function listCalls(api: Rendered['api']) {
  return api.callsTo('GET /audit-log').filter((call) => call.options.query?.pageSize !== 1);
}

function search(view: Rendered) {
  return new URLSearchParams(view.router.state.location.search);
}

describe('audit log, element type, element id and action', () => {
  it('keeps the element id disabled until there is a type, sends both, and clears the id when the type changes', async () => {
    const view = await renderAudit({ entries: ENTRIES });
    const user = setupUser();
    await screen.findByText('Sample Developer A');

    const id = screen.getByRole('textbox', { name: 'Element id' });
    expect(id).toBeDisabled();
    expect(id).toHaveAttribute('title', 'Choose an element type first.');

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Element type' }),
      'Element environment',
    );
    expect(screen.getByRole('textbox', { name: 'Element id' })).toBeEnabled();
    await user.click(screen.getByRole('textbox', { name: 'Element id' }));
    await user.paste('12:DEV');
    await endSearchPause();

    expect(search(view).get('type')).toBe('element_environment');
    expect(search(view).get('entityId')).toBe('12:DEV');
    expect(listCalls(view.api).at(-1)?.options.query).toMatchObject({
      entityType: 'element_environment',
      entityId: '12:DEV',
    });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Element type' }), 'Screen');
    expect(search(view).get('type')).toBe('screen');
    expect(search(view).has('entityId')).toBe(false);
    expect(screen.getByRole('textbox', { name: 'Element id' })).toHaveValue('');
  });

  it('offers a readable name for every audited table', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Sample Developer A');
    const options = within(screen.getByRole('combobox', { name: 'Element type' }))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([
      'Element type',
      'Screen',
      'Variable',
      'Collection',
      'Collection field',
      'Component',
      'Element environment',
      'Screen–variable link',
      'Screen–collection link',
      'Variable–collection assignment',
      'Dependency',
      'Jira ticket',
      'Comment',
      'Report',
      'Application',
      'User',
    ]);
  });

  it('filters by action and by the application, which can be all of them', async () => {
    const view = await renderAudit({ entries: ENTRIES });
    const user = setupUser();
    await screen.findByText('Sample Developer A');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Action' }), 'Created');
    await screen.findByText('locOrden');
    expect(screen.queryByText('Detalle')).toBeNull();
    expect(search(view).get('action')).toBe('CREATE');

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Application' }),
      'All applications',
    );
    await waitFor(() => {
      expect(listCalls(view.api).at(-1)?.options.query).not.toHaveProperty('applicationId');
    });
    expect(search(view).get('application')).toBe('all');
    expect(
      within(screen.getByRole('combobox', { name: 'Application' })).getByRole('option', {
        name: 'Application: SAR',
      }),
    ).toBeInTheDocument();
  });
});

describe('audit log, the period', () => {
  const edge = (id: number, label: string, createdAt: string) =>
    makeEntry(id, { entityLabel: label, createdAt });
  const EDGES = [
    edge(1, 'before', '2026-10-03T05:59:59.999Z'),
    edge(2, 'start', '2026-10-03T06:00:00.000Z'),
    edge(3, 'end', '2026-10-04T05:59:59.999Z'),
    edge(4, 'after', '2026-10-04T06:00:00.000Z'),
  ];

  it('includes the first and the last millisecond of a day in the local zone and nothing outside it', async () => {
    const { api } = await renderAudit({
      entries: EDGES,
      path: '/audit?from=2026-10-03&to=2026-10-03',
    });
    await screen.findByText('start');
    expect(screen.getByText('end')).toBeInTheDocument();
    expect(screen.queryByText('before')).toBeNull();
    expect(screen.queryByText('after')).toBeNull();
    expect(listCalls(api)[0]?.options.query).toMatchObject({
      from: '2026-10-03T06:00:00.000Z',
      to: '2026-10-04T05:59:59.999Z',
    });
  });

  it('picks a shortcut in the panel, which fills the days, and applies it', async () => {
    const view = await renderAudit({ entries: ENTRIES });
    const user = setupUser();
    await screen.findByText('Sample Developer A');

    await user.click(screen.getByRole('button', { name: 'Period: Last 7 days' }));
    const panel = screen.getByRole('dialog', { name: 'Date range' });
    expect(within(panel).getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(panel).getByRole('button', { name: 'Today' }));
    expect(within(panel).getByLabelText('From')).toHaveValue('2026-10-05');
    expect(within(panel).getByLabelText('To')).toHaveValue('2026-10-05');
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));

    expect(screen.queryByRole('dialog', { name: 'Date range' })).toBeNull();
    expect(search(view).get('from')).toBe('2026-10-05');
    expect(search(view).get('to')).toBe('2026-10-05');
    expect(screen.getByRole('button', { name: 'Period: Today' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listCalls(view.api).at(-1)?.options.query).toMatchObject({
        from: '2026-10-05T06:00:00.000Z',
        to: '2026-10-06T05:59:59.999Z',
      });
    });
  });

  it('takes a custom range typed in From and To', async () => {
    const view = await renderAudit({ entries: ENTRIES });
    const user = setupUser();
    await screen.findByText('Sample Developer A');

    await user.click(screen.getByRole('button', { name: 'Period: Last 7 days' }));
    const panel = screen.getByRole('dialog', { name: 'Date range' });
    const from = within(panel).getByLabelText('From');
    await user.clear(from);
    await user.type(from, '2026-10-01');
    const to = within(panel).getByLabelText('To');
    await user.clear(to);
    await user.type(to, '2026-10-03');
    expect(within(panel).getByRole('button', { name: 'Custom range' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));

    expect(screen.getByRole('button', { name: 'Period: Oct 1 – Oct 3' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listCalls(view.api).at(-1)?.options.query).toMatchObject({
        from: '2026-10-01T06:00:00.000Z',
        to: '2026-10-04T05:59:59.999Z',
      });
    });
  });

  it('marks an upside-down range on "To" in the panel and cannot apply it', async () => {
    const view = await renderAudit({ entries: ENTRIES });
    const user = setupUser();
    await screen.findByText('Sample Developer A');
    const callsBefore = listCalls(view.api).length;

    await user.click(screen.getByRole('button', { name: 'Period: Last 7 days' }));
    const panel = screen.getByRole('dialog', { name: 'Date range' });
    const from = within(panel).getByLabelText('From');
    await user.clear(from);
    await user.type(from, '2026-10-05');
    const to = within(panel).getByLabelText('To');
    await user.clear(to);
    await user.type(to, '2026-10-01');

    expect(to).toBeInvalid();
    expect(within(panel).getByText("To can't be earlier than From.")).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(listCalls(view.api)).toHaveLength(callsBefore);
  });

  it('marks an upside-down range that comes from the URL on the period and asks nothing', async () => {
    const { api } = await renderAudit({
      entries: ENTRIES,
      path: '/audit?from=2026-10-05&to=2026-10-01',
    });
    expect(await screen.findByText("To can't be earlier than From.")).toBeInTheDocument();
    expect(api.callsTo('GET /audit-log')).toHaveLength(0);
    expect(screen.queryByText('Sample Developer A')).toBeNull();
  });

  it("marks the API's 400 range on the period too", async () => {
    await renderAudit({
      entries: ENTRIES,
      prepare: (fake) => {
        fake.failNext(
          'GET /audit-log',
          new ApiError({
            status: 400,
            code: 'VALIDATION_ERROR',
            details: { fields: [{ field: 'to', rule: 'range', message: 'server text' }] },
          }),
        );
      },
    });
    expect(await screen.findByText('To is outside the allowed range.')).toBeInTheDocument();
    expect(screen.getByText('Check the highlighted fields.')).toBeInTheDocument();
    expect(screen.queryByText('server text')).toBeNull();
  });
});

describe('audit log, the 400 of the API on its field', () => {
  it('marks `required` on the element type when an id comes without one (a link written by hand)', async () => {
    await renderAudit({
      entries: ENTRIES,
      path: '/audit?entityId=5&from=2026-09-29&to=2026-10-05',
    });
    expect(await screen.findByText('Element type is required.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Element type' })).toBeInvalid();
    expect(screen.getByRole('combobox', { name: 'Element type' })).toHaveAccessibleDescription(
      'Element type is required.',
    );
  });

  it('marks `format` on the field of the date it names', async () => {
    await renderAudit({
      entries: ENTRIES,
      prepare: (fake) => {
        fake.failNext(
          'GET /audit-log',
          new ApiError({
            status: 400,
            code: 'VALIDATION_ERROR',
            details: { fields: [{ field: 'from', rule: 'format', message: 'server text' }] },
          }),
        );
      },
    });
    expect(await screen.findByText("From isn't in a valid format.")).toBeInTheDocument();
  });
});

describe('audit log, the user filter of an Administrator', () => {
  it('searches the users on the server while the user types, after a short pause, and filters by the one chosen', async () => {
    const view = await renderAudit({ entries: ENTRIES });
    const user = setupUser();
    await screen.findByText('Sample Developer A');
    expect(view.api.users.callsTo('GET /users').at(-1)?.options.query).toEqual({
      pageSize: 20,
      sort: 'name',
    });

    await user.click(screen.getByRole('combobox', { name: 'User' }));
    await user.paste('developer a');
    const callsWhileTyping = view.api.users.callsTo('GET /users').length;
    await endSearchPause();
    await waitFor(() => {
      expect(view.api.users.callsTo('GET /users').length).toBeGreaterThan(callsWhileTyping);
    });
    expect(view.api.users.callsTo('GET /users').at(-1)?.options.query).toEqual({
      pageSize: 20,
      sort: 'name',
      q: 'developer a',
    });

    await user.click(await screen.findByRole('option', { name: /Sample Developer A/ }));
    expect(search(view).get('actor')).toBe('3');
    await waitFor(() => {
      expect(listCalls(view.api).at(-1)?.options.query).toMatchObject({ actorUserId: 3 });
    });
    expect(screen.queryByText('Fax')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'User' })).toHaveValue('Sample Developer A');
  });

  it('shows the name of a user from the URL that is not in the results, or "User #id" when it cannot be read', async () => {
    await renderAudit({
      entries: ENTRIES,
      users: [],
      path: '/audit?actor=3&from=2026-09-29&to=2026-10-05',
    });
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'User' })).toHaveValue('User #3');
    });
  });

  it('reads a user from the URL by id when the first results do not hold them, and shows their name', async () => {
    const users = [
      ...Array.from({ length: 25 }, (_, index) =>
        makeUser(100 + index, `User ${String(index).padStart(2, '0')}`),
      ),
      makeUser(500, 'Zed Zulu'),
    ];
    const { api } = await renderAudit({
      entries: ENTRIES,
      users,
      path: '/audit?actor=500&from=2026-09-29&to=2026-10-05',
    });
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'User' })).toHaveValue('Zed Zulu');
    });
    expect(api.users.callsTo('GET /users/{id}')[0]?.options.path).toEqual({ id: 500 });
  });
});
