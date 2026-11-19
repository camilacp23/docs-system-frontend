// Jira on the dashboard (NFR-14, S-31j): the pending to-dos always come from the local copy, with the date of the last
// synchronization; with Jira unavailable the card says so and a banner explains it, with no global alarm; and the
// availability the dashboard brings updates the pill of the top bar without calling Jira.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { browserTimeZone } from '../../modules/audit/auditDates';
import { syncedText } from '../../modules/dashboard/dashboardModel';
import { makeIndicators } from '../helpers/fakeDashboardApi';
import { renderDashboard } from '../helpers/renderDashboard';
import { settle, setupUser } from '../helpers/setupUser';

const SYNCED_AT = '2026-10-05T14:40:00.000Z';
const synced = () => syncedText(SYNCED_AT, browserTimeZone()) as string;
const pending = () => screen.getByRole('article', { name: 'Pending to-dos' });
// The age of the copy is a chip in the header of the by-screen card, not in the figure card.
const byScreen = () => screen.getByRole('region', { name: 'Pending to-dos by screen' });
const pill = () => document.querySelector('[data-jira-status]') as HTMLElement;

describe('Jira available', () => {
  it('shows the count with the date of the last synchronization and no warning', async () => {
    await renderDashboard({
      indicators: {
        1: makeIndicators({
          jira: { jiraAvailable: true, lastSyncedAt: SYNCED_AT },
          recentActivity: [],
        }),
      },
    });

    const card = within(pending());
    expect(card.getByText('6')).toBeInTheDocument();
    expect(card.getByText('Subtasks not Done in Jira')).toBeInTheDocument();
    // One short line: a clock and the date; "Last synced" is for screen readers.
    expect(byScreen()).toHaveTextContent(`Last synced ${synced()}`);
    expect(within(byScreen()).getByText(synced()).tagName).toBe('TIME');
    expect(pending()).not.toHaveTextContent('Last synced');
    expect(card.queryByText('Stale')).not.toBeInTheDocument();
    expect(screen.queryByText("Jira isn't responding.")).not.toBeInTheDocument();
    expect(pill()).toHaveTextContent('Jira connected');
  });

  it('says "Never synced" when no ticket was ever synchronized', async () => {
    await renderDashboard({
      indicators: {
        1: makeIndicators({
          jira: { pendingSubtasks: 0, jiraAvailable: true, lastSyncedAt: null },
          recentActivity: [],
        }),
      },
    });

    expect(within(byScreen()).getByText('Never synced')).toBeInTheDocument();
    expect(screen.queryByText("Jira isn't responding.")).not.toBeInTheDocument();
  });
});

describe('Jira unavailable', () => {
  it('keeps the local count, marks it stale, shows the date and explains it', async () => {
    await renderDashboard({
      role: 'DEVELOPER',
      indicators: {
        1: makeIndicators({
          jira: { jiraAvailable: false, lastSyncedAt: SYNCED_AT },
          recentActivity: [],
        }),
      },
    });

    const card = within(pending());
    expect(card.getByText('6')).toBeInTheDocument();
    expect(card.getByText('Stale')).toBeInTheDocument();
    expect(card.getByText('Jira unavailable · last saved copy')).toBeInTheDocument();
    // The date of the copy is in the banner, so the card keeps the height of its neighbours.
    expect(card.queryByText(synced())).not.toBeInTheDocument();
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(
      `Jira isn't responding. To-do counts come from the copy saved on ${synced()}.`,
    );
  });

  it('is not a global alarm: only the card and one banner of the dashboard change', async () => {
    await renderDashboard({
      indicators: {
        1: makeIndicators({ jira: { jiraAvailable: false }, recentActivity: [] }),
      },
    });

    // The rest of the page is as always, and nothing else in the shell raises an alert.
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Documentation approved' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Documentation by status' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Detalle, 3 pending to-dos' })).toBeInTheDocument();
    expect(within(pending()).getByRole('link', { name: 'By screen →' })).toBeInTheDocument();
  });

  it('says so when it was never synchronized, without a date in the sentence', async () => {
    await renderDashboard({
      indicators: {
        1: makeIndicators({
          jira: { jiraAvailable: false, lastSyncedAt: null },
          recentActivity: [],
        }),
      },
    });

    expect(within(pending()).getByText('Jira unavailable · never synced')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Jira isn't responding. To-do counts come from the saved copy.",
    );
  });

  it('shows it to a reader too', async () => {
    await renderDashboard({
      role: 'READER',
      indicators: { 1: makeIndicators({ jira: { jiraAvailable: false } }) },
    });

    expect(within(pending()).getByText('Stale')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("Jira isn't responding.");
  });
});

describe('the pill of the top bar', () => {
  it('is "Jira not checked" until the dashboard answers and then follows jiraAvailable', async () => {
    await renderDashboard({
      settled: false,
      indicators: { 1: makeIndicators({ jira: { jiraAvailable: false }, recentActivity: [] }) },
    });
    expect(pill()).toHaveTextContent('Jira not checked');

    await screen.findByRole('article', { name: 'Pending to-dos' });
    // The pill learns it in an effect after the page is drawn: wait for React to finish, not for the clock.
    await settle();

    expect(pill()).toHaveTextContent('Jira unavailable');
    expect(pill()).toHaveAttribute('data-jira-status', 'unavailable');
  });

  it('changes again with the next read: unavailable, then connected', async () => {
    const user = setupUser();
    const { api } = await renderDashboard({
      indicators: { 1: makeIndicators({ jira: { jiraAvailable: false }, recentActivity: [] }) },
    });
    expect(pill()).toHaveTextContent('Jira unavailable');

    api.state.indicators[1] = makeIndicators({
      jira: { jiraAvailable: true },
      recentActivity: [],
    });
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(pill()).toHaveTextContent('Jira connected');
    expect(screen.queryByText("Jira isn't responding.")).not.toBeInTheDocument();
  });

  it('never calls Jira: the dashboard only reads its own two operations', async () => {
    const { api } = await renderDashboard({
      indicators: { 1: makeIndicators({ jira: { jiraAvailable: false }, recentActivity: [] }) },
    });

    const paths = new Set([...api.calls, ...api.screens.calls].map((call) => call.path));
    expect([...paths].sort()).toEqual(['/dashboard/indicators', '/screens']);
    expect(api.screens.callsTo('GET /screens/{id}/jira-tickets')).toHaveLength(0);
    expect(api.screens.callsTo('POST /screens/{id}/jira-ticket')).toHaveLength(0);
  });
});
