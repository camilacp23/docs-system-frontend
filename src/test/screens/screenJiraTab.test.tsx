// Future to do tab of the screen detail (S-23, S-23b): the tree Epic → Stories → Subtasks with its links, the date of the
// last synchronization, the empty state, the manual refresh, the degraded state (saved copy, Jira unavailable) that never
// becomes a global alarm, the roles (a Reader only queries), the reasons that disable Refresh, and the pending count shared
// with the badge and the side card. Jira is the state of the fake API (fakeScreenJira): nothing here calls Jira.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { Role } from '../../app/router/routes';
import { REFRESHED_TEXT } from '../../modules/screens/JiraTicketsTab';
import { formatTimestamp } from '../../modules/variables/variableLabels';
import { sampleJiraTickets } from '../helpers/fakeScreenJira';
import type { makeScreensApi } from '../helpers/fakeScreensApi';
import { makeApplication } from '../helpers/renderApp';
import { renderScreens, sampleScreens } from '../helpers/renderScreens';
import { setupUser } from '../helpers/setupUser';

const SYNCED = '2026-10-05T08:40:00.000Z';
const ARCHIVED_REFRESH_REASON =
  "Read-only: the application is archived, so the copy can't be refreshed.";
const OFFLINE_REASON = "You're offline. Changes can't be saved until the connection is back.";

afterEach(() => {
  vi.restoreAllMocks();
});

interface OpenOptions {
  role?: Role;
  tickets?: boolean;
  prepare?: (api: ReturnType<typeof makeScreensApi>) => void;
  archived?: boolean;
  path?: string;
}

/** Detalle (12) on its Future to do tab; its tickets are the tree of the frame S-23 unless `tickets` is false. */
async function open(options: OpenOptions = {}) {
  const view = await renderScreens({
    role: options.role,
    path: options.path ?? '/screens/12?tab=todo',
    applications: options.archived
      ? [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })]
      : undefined,
    prepare: (api) => {
      if (options.tickets !== false) api.jira.tickets = sampleJiraTickets(12);
      options.prepare?.(api);
    },
  });
  await screen.findByRole('heading', { name: 'Detalle', level: 1 });
  return view;
}

const table = () => screen.findByRole('table', { name: /Jira Stories and Subtasks/ });

describe('Future to do: the tree', () => {
  it('shows the Epic, the Stories and the Subtasks with their keys, summaries, states and categories', async () => {
    await open();

    expect(await screen.findByText(/Detalle \(SAR\)/)).toBeVisible();
    expect(screen.getByText('TECHEA-101')).toHaveClass('font-mono');
    const grid = await table();
    const rows = within(grid).getAllByRole('row');
    // The header and the six rows of two Stories and four Subtasks.
    expect(rows).toHaveLength(7);
    const first = within(rows[1] as HTMLElement);
    expect(first.getByText('TECHEA-102')).toHaveClass('font-mono');
    expect(first.getByText('Validation improvements')).toBeVisible();
    expect(first.getByText('Story')).toBeVisible();
    const subtask = within(rows[2] as HTMLElement);
    expect(subtask.getByText('Validate required fields before Patch')).toBeVisible();
    expect(subtask.getByText('To Do')).toBeVisible();
    expect(subtask.getAllByRole('cell')[2]).toHaveTextContent('To do');
    expect(within(rows[3] as HTMLElement).getAllByRole('cell')[2]).toHaveTextContent('In progress');
    expect(within(rows[6] as HTMLElement).getAllByRole('cell')[2]).toHaveTextContent('Done');
  });

  it('links every issue to Jira in another tab without leaking the opener', async () => {
    await open();
    await table();

    const links = screen.getAllByRole('link', { name: /Open in Jira/ });
    // The Epic, two Stories and four Subtasks.
    expect(links).toHaveLength(7);
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(
      screen.getByRole('link', { name: /Open in Jira\s*TECHEA-103 \(opens in a new tab\)/ }),
    ).toHaveAttribute('href', 'https://jira.example.test/browse/TECHEA-103');
  });

  it('never makes a link of an address that is not http or https', async () => {
    await open({
      prepare: (api) => {
        const [epic, ...rest] = sampleJiraTickets(12);
        api.jira.tickets = [
          { ...(epic as NonNullable<typeof epic>), url: 'javascript:alert(1)' },
          ...rest,
        ];
      },
    });
    await table();

    expect(screen.getAllByRole('link', { name: /Open in Jira/ })).toHaveLength(6);
    expect(screen.queryByRole('link', { name: /TECHEA-101/ })).not.toBeInTheDocument();
  });

  it('hides the link to Jira when the API sends url: null (Jira without a base URL) and logs nothing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await open({
      prepare: (api) => {
        api.jira.tickets = sampleJiraTickets(12).map((ticket) => ({ ...ticket, url: null }));
      },
    });
    const tree = await table();

    // The tree is complete: only the links are gone.
    expect(within(tree).getByText('TECHEA-103')).toBeInTheDocument();
    expect(screen.getByText('TECHEA-101')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open in Jira/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Open in Jira')).not.toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('shows the pending to-dos and the date of the last synchronization', async () => {
    await open();
    await table();

    expect(
      screen.getByText(`3 pending to-dos · last synced ${formatTimestamp(SYNCED)}`),
    ).toBeVisible();
  });

  it('shows an empty state without an Epic, with no table and no date', async () => {
    await open({ tickets: false });

    expect(await screen.findByRole('heading', { name: 'No to-dos yet' })).toBeVisible();
    expect(
      screen.getByText(
        "To-dos are Jira Subtasks. The first one creates this screen's Epic in Jira.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/last synced/)).not.toBeInTheDocument();
  });

  it('reads the local copy when the tab opens, without asking Jira to refresh', async () => {
    const { api } = await open();
    await table();

    const reads = api.callsTo('GET /screens/{id}/jira-tickets');
    expect(reads).toHaveLength(1);
    expect(reads[0]?.options.query).toBeUndefined();
  });

  it('does not read the tickets while another tab is shown', async () => {
    const { api } = await open({ path: '/screens/12' });

    expect(api.callsTo('GET /screens/{id}/jira-tickets')).toHaveLength(0);
  });

  it('folds and unfolds the Subtasks of a Story with a button that says what it hides', async () => {
    const user = setupUser();
    await open();
    const grid = await table();

    const toggle = within(grid).getByRole('button', { name: 'Subtasks of TECHEA-102' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const controlled = (toggle.getAttribute('aria-controls') ?? '').split(' ');
    expect(controlled).toHaveLength(2);
    for (const id of controlled) expect(document.getElementById(id)).not.toBeNull();
    expect(within(grid).getByText('TECHEA-103')).toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(grid).queryByText('TECHEA-103')).not.toBeVisible();
    // The other Story keeps its Subtasks.
    expect(within(grid).getByText('TECHEA-106')).toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(grid).getByText('TECHEA-103')).toBeVisible();
  });

  it('can be used with the keyboard: Enter and Space fold, Tab reaches the links', async () => {
    const user = setupUser();
    await open();
    const grid = await table();
    const toggle = within(grid).getByRole('button', { name: 'Subtasks of TECHEA-102' });

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    expect(within(grid).getByRole('link', { name: /TECHEA-102/ })).toHaveFocus();
  });

  it('tells a screen reader what each row is and names the columns', async () => {
    await open();
    const grid = await table();

    expect(
      within(grid).getByRole('rowheader', { name: /Subtask of TECHEA-102:\s*TECHEA-103/ }),
    ).toBeVisible();
    expect(
      within(grid)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Key', 'Summary', 'Jira status', 'Category', 'Link']);
  });

  it('shows an Epic without Stories as such', async () => {
    await open({
      prepare: (api) => {
        api.jira.tickets = sampleJiraTickets(12).slice(0, 1);
      },
    });

    expect(await screen.findByText('This Epic has no Stories yet.')).toBeVisible();
  });

  it('shows the server error state with a retry when the first read fails', async () => {
    const user = setupUser();
    await open({
      prepare: (api) => {
        api.failNext(
          'GET /screens/{id}/jira-tickets',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });

    expect(await screen.findByText('Something went wrong on our side')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await table()).toBeVisible();
  });
});

describe('Future to do: roles', () => {
  it.each(['ADMINISTRATOR', 'DEVELOPER'] as const)('%s has Refresh from Jira', async (role) => {
    await open({ role });
    await table();

    expect(screen.getByRole('button', { name: 'Refresh from Jira' })).toBeEnabled();
  });

  it('a Reader only queries: no Refresh, and the tree is there', async () => {
    await open({ role: 'READER' });

    expect(await table()).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Refresh from Jira' })).not.toBeInTheDocument();
  });
});

describe('Future to do: refresh', () => {
  it('asks the server to refresh, shows what changed and says so', async () => {
    const user = setupUser();
    const { api } = await open({
      prepare: (a) => {
        a.jira.remote.set(3, { status: 'Done', statusCategory: 'DONE' });
      },
    });
    await table();

    await user.click(screen.getByRole('button', { name: 'Refresh from Jira' }));

    expect(await screen.findByText(REFRESHED_TEXT)).toBeVisible();
    expect(api.callsTo('GET /screens/{id}/jira-tickets').at(-1)?.options.query).toEqual({
      refresh: true,
    });
    // TECHEA-103 is Done now: two pending to-dos are left, in the footer and in the badge.
    expect(await screen.findByText(/^2 pending to-dos · last synced/)).toBeVisible();
    expect(screen.getByRole('tab', { name: /^Future to do\s*2$/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a loading state on the button while it waits', async () => {
    const user = setupUser();
    const { api } = await open();
    await table();
    const gate = api.hold(
      (call) => call.path === '/screens/{id}/jira-tickets' && call.options.query?.refresh === true,
    );

    await user.click(screen.getByRole('button', { name: 'Refresh from Jira' }));
    expect(screen.getByRole('button', { name: 'Refresh from Jira' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await act(async () => {
      gate.release();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh from Jira' })).not.toHaveAttribute(
        'aria-busy',
      );
    });
  });

  it('shows the message of a call that failed and keeps the tree', async () => {
    const user = setupUser();
    const { api } = await open();
    await table();
    api.failNext(
      'GET /screens/{id}/jira-tickets',
      new ApiError({ status: 0, code: 'NETWORK_ERROR' }),
    );

    await user.click(screen.getByRole('button', { name: 'Refresh from Jira' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(OFFLINE_REASON);
    expect(await table()).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('is disabled with the reason when the application is archived', async () => {
    await open({ archived: true });
    await table();

    const refresh = screen.getByRole('button', { name: 'Refresh from Jira' });
    expect(refresh).toBeDisabled();
    expect(refresh).toHaveAttribute('title', ARCHIVED_REFRESH_REASON);
    expect(refresh).toHaveAccessibleDescription(ARCHIVED_REFRESH_REASON);
  });

  it('is disabled with the reason when there is no connection', async () => {
    await open();
    await table();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const refresh = screen.getByRole('button', { name: 'Refresh from Jira' });
    await waitFor(() => {
      expect(refresh).toBeDisabled();
    });
    expect(refresh).toHaveAttribute('title', OFFLINE_REASON);
  });
});

describe('Future to do: degraded state (S-23b)', () => {
  it('shows the saved copy with its time and the Stale tag when Jira is not available, and the rest keeps working', async () => {
    await open({
      prepare: (api) => {
        api.jira.available = false;
      },
    });

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(
      `Jira isn't responding. You're seeing the copy saved on ${formatTimestamp(SYNCED)}; statuses may be out of date.`,
    );
    expect(screen.getByText('Stale')).toBeVisible();
    // The tree and the rest of the screen are still there: never a global alarm.
    expect(await table()).toBeVisible();
    expect(screen.getByRole('button', { name: 'Withdraw from review' })).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeVisible();
  });

  it('a refresh that cannot complete keeps the saved copy marked as stale, without a success notice', async () => {
    const user = setupUser();
    const { api } = await open({
      prepare: (a) => {
        a.jira.remote.set(3, { status: 'Done', statusCategory: 'DONE' });
      },
    });
    await table();
    expect(screen.queryByText('Stale')).not.toBeInTheDocument();

    api.jira.available = false;
    await user.click(screen.getByRole('button', { name: 'Refresh from Jira' }));

    expect(await screen.findByText('Stale')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent("Jira isn't responding.");
    expect(screen.queryByText(REFRESHED_TEXT)).not.toBeInTheDocument();
    // The saved copy is untouched.
    expect(screen.getByText(/^3 pending to-dos · last synced/)).toBeVisible();
  });

  it('shows no banner and no Stale tag when Jira is available and the copy is current', async () => {
    await open();
    await table();

    expect(screen.queryByText('Stale')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Future to do: the Jira pill and the pending count', () => {
  it('the pill is not checked until the tab is read', async () => {
    await open({ path: '/screens/12' });
    expect(screen.getByText('Jira not checked')).toBeVisible();
  });

  it('the pill says Jira connected after reading the tree of an available Jira', async () => {
    await open();
    await table();

    expect(await screen.findByText('Jira connected')).toBeVisible();
  });

  it('the pill says Jira unavailable when the tree says so', async () => {
    await open({
      prepare: (api) => {
        api.jira.available = false;
      },
    });
    await table();

    expect(await screen.findByText('Jira unavailable')).toBeVisible();
  });

  it('shares the count of the tree with the badge and the side card once the tab has been read', async () => {
    const user = setupUser();
    await renderScreens({
      path: '/screens/12',
      screens: sampleScreens().map((s) => (s.id === 12 ? { ...s, pendingSubtasks: 5 } : s)),
      prepare: (api) => {
        api.jira.tickets = sampleJiraTickets(12);
      },
    });
    await screen.findByRole('heading', { name: 'Detalle', level: 1 });
    // Until the tree is read the badge is the count of the detail.
    expect(screen.getByRole('tab', { name: /^Future to do\s*5$/ })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Future to do/ }));
    await table();
    expect(await screen.findByRole('tab', { name: /^Future to do\s*3$/ })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Template' }));
    expect(screen.getByText('Pending to-dos').nextElementSibling).toHaveTextContent('3 in Jira');
  });

  it('the tab is part of the URL', async () => {
    const user = setupUser();
    const { router } = await open({ path: '/screens/12' });

    await user.click(screen.getByRole('tab', { name: /Future to do/ }));
    expect(router.state.location.search).toBe('?tab=todo');
    expect(await table()).toBeVisible();
  });
});
