// Audit log by role (Table 56, S-32, S-32d, S-41b): the Administrator sees every record and picks a user, the
// Developer sees their own with the user filter fixed on them, and the Reader gets "No access". The API's order of
// errors is kept: 400 before 403.
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

function listCalls(api: Rendered['api']) {
  return api.callsTo('GET /audit-log').filter((call) => call.options.query?.pageSize !== 1);
}

function timeline() {
  return within(screen.getByRole('region', { name: 'Audit records' }));
}

/** The record whose element label is `label` (the shell shows names too, such as the application card's "SAR"). */
function recordText(label: string) {
  return timeline().getByText(label).closest('li') as HTMLElement;
}

describe('audit log, Administrator', () => {
  it('sees the records of every user, with the user filter open and the database role of a write outside the API', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Sample Developer A');

    for (const name of [
      'Sample Developer A',
      'Sample Developer B',
      'Ana Mora',
      'Integración Jira',
    ]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('combobox', { name: 'User' })).toBeEnabled();
    expect(recordText('SAR')).toHaveTextContent('(docs_owner)');
    expect(
      screen.getByText(
        'Every change recorded in SAR, read-only. Click an event to see what changed.',
      ),
    ).toBeInTheDocument();
  });

  it('reads the records of all applications when the application filter says so', async () => {
    const { api } = await renderAudit({ entries: ENTRIES, path: '/audit?application=all' });
    await screen.findByText('Sample Developer A');
    expect(listCalls(api)[0]?.options.query).not.toHaveProperty('applicationId');
    expect(
      screen.getByText(
        'Every change recorded in all applications, read-only. Click an event to see what changed.',
      ),
    ).toBeInTheDocument();
  });
});

describe('audit log, Developer', () => {
  it('sees only their own actions as "You", with the user filter fixed on them, disabled and with the reason', async () => {
    const { api } = await renderAudit({ role: 'DEVELOPER', entries: ENTRIES });
    await screen.findByText('Inicio');

    const filter = screen.getByRole('textbox', { name: 'User' });
    expect(filter).toBeDisabled();
    expect(filter).toHaveValue('Only my actions');
    expect(filter).toHaveAccessibleDescription('Developers can only see their own actions.');
    expect(recordText('Inicio')).toHaveTextContent('You approved the documentation of Inicio');
    expect(recordText('Fax')).toHaveTextContent('You deleted collection field Fax');
    expect(screen.queryByText('Sample Developer A')).toBeNull();
    // (the top bar also says "Ana Mora": only the timeline matters here)
    expect(timeline().queryByText('Ana Mora')).toBeNull();
    expect(
      screen.getByText(
        'Your actions in SAR, read-only. Developers see only their own actions. Click an event to see what changed.',
      ),
    ).toBeInTheDocument();
    // The Developer cannot read the users, and the request names no user: the API uses the caller.
    expect(api.users.callsTo('GET /users')).toHaveLength(0);
    expect(listCalls(api)[0]?.options.query).not.toHaveProperty('actorUserId');
  });

  it('never receives or shows the database role', async () => {
    await renderAudit({ role: 'DEVELOPER', entries: ENTRIES });
    await screen.findByText('Inicio');
    expect(screen.queryByText(/docs_app|docs_owner/)).toBeNull();
  });

  it("answers a link to another user's actions with a clear message and a way to their own", async () => {
    const view = await renderAudit({
      role: 'DEVELOPER',
      entries: ENTRIES,
      path: '/audit?actor=3&from=2026-09-29&to=2026-10-05',
    });
    const user = setupUser();

    expect(await screen.findByText('You can only see your own actions.')).toBeInTheDocument();
    expect(screen.queryByText('Inicio')).toBeNull();
    // The panel of totals is left out: it would only repeat the refusal.
    expect(screen.queryByRole('complementary', { name: 'This period' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Show my actions' }));
    expect(await screen.findByText('Inicio')).toBeInTheDocument();
    expect(view.router.state.location.search).toBe('?from=2026-09-29&to=2026-10-05');
    expect(screen.queryByText('You can only see your own actions.')).toBeNull();
  });

  it('gets the 400 before the 403: a bad request is marked on its field, not refused as "own actions"', async () => {
    await renderAudit({
      role: 'DEVELOPER',
      entries: ENTRIES,
      path: '/audit?actor=3&entityId=5&from=2026-09-29&to=2026-10-05',
    });
    expect(await screen.findByText('Element type is required.')).toBeInTheDocument();
    expect(screen.queryByText('You can only see your own actions.')).toBeNull();
  });
});

describe('audit log, Reader', () => {
  it('gets "No access" (S-41b) and asks the API for nothing', async () => {
    const { api } = await renderAudit({ role: 'READER', entries: ENTRIES });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your role (Reader) doesn't include it. Ask an administrator if you need it.",
      ),
    ).toBeInTheDocument();
    expect(api.callsTo('GET /audit-log')).toHaveLength(0);
    expect(screen.queryByRole('link', { name: 'Audit log' })).toBeNull();
  });

  it('shows "No access" inside the page when the API itself answers 403 for the role', async () => {
    await renderAudit({
      entries: ENTRIES,
      prepare: (fake) => {
        fake.failNext(
          'GET /audit-log',
          new ApiError({
            status: 403,
            code: 'FORBIDDEN',
            details: { requiredRoles: ['ADMINISTRATOR', 'DEVELOPER'] },
          }),
        );
      },
    });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        within(screen.getByRole('region', { name: 'Audit records' })).queryByText(
          'Sample Developer A',
        ),
      ).toBeNull();
    });
  });
});
