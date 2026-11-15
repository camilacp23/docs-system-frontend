// Recent activity (S-31): the 10 most recent records with the same sentence as the audit timeline, in local time,
// with no values, for the Administrator and the Developer; the Reader has no section and no link to the audit log.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { components } from '../../api/schema';
import { actionPhrase, actorText, elementLabel } from '../../modules/audit/auditLabels';
import { browserTimeZone, clockOf } from '../../modules/audit/auditDates';
import { activityTime } from '../../modules/dashboard/dashboardModel';
import { makeActivity, makeIndicators } from '../helpers/fakeDashboardApi';
import { renderDashboard } from '../helpers/renderDashboard';
import { setupUser } from '../helpers/setupUser';

type Role = components['schemas']['UserRole'];

const TEAM = [
  makeActivity(12, {
    actor: { id: 2, name: 'Sample Developer A' },
    entityLabel: 'Detalle',
    createdAt: '2026-10-05T16:21:00.000Z',
  }),
  makeActivity(11, {
    actor: { id: 1, name: 'Camila Castillo' },
    action: 'EVENT',
    eventName: 'DOCUMENTATION_APPROVED',
    entityLabel: 'Inicio',
    createdAt: '2026-10-05T16:05:00.000Z',
  }),
  makeActivity(104, {
    actor: { id: 9, name: 'Integración Jira' },
    entityType: 'jira_ticket',
    entityId: '104',
    entityLabel: 'TECHEA-104',
    createdAt: '2026-10-05T15:52:00.000Z',
  }),
  makeActivity(40, {
    actor: { id: 3, name: 'Sample Developer B' },
    action: 'CREATE',
    entityType: 'variable',
    entityId: '40',
    entityLabel: 'locOrden',
    createdAt: '2026-10-05T15:14:00.000Z',
  }),
  makeActivity(7, {
    actor: null,
    action: 'DELETE',
    entityType: 'collection',
    entityId: '7',
    entityLabel: 'colViejos',
    createdAt: '2026-10-05T14:00:00.000Z',
  }),
];

const activityCard = () => screen.getByRole('region', { name: 'Recent activity' });

describe.each<Role>(['ADMINISTRATOR', 'DEVELOPER'])('recent activity for the %s', (role) => {
  it('lists the records of the whole team in the order the API sends them', async () => {
    await renderDashboard({
      role,
      indicators: { 1: makeIndicators({ recentActivity: TEAM }) },
    });

    const rows = within(activityCard()).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.querySelector('p')?.textContent)).toEqual([
      'Sample Developer A updated screen Detalle',
      'Camila Castillo approved the documentation of Inicio',
      'Integración Jira updated ticket TECHEA-104',
      'Sample Developer B created variable locOrden',
      'Outside the application deleted collection colViejos',
    ]);
  });

  it('says the same sentence as the audit timeline (the same helpers)', async () => {
    await renderDashboard({
      role,
      indicators: { 1: makeIndicators({ recentActivity: TEAM }) },
    });

    const rows = within(activityCard()).getAllByRole('listitem');
    TEAM.forEach((entry, index) => {
      expect(rows[index]?.querySelector('p')?.textContent).toBe(
        `${actorText(entry, false)} ${actionPhrase(entry)} ${elementLabel(entry)}`,
      );
    });
  });

  it('shows the type and the local time of each record', async () => {
    await renderDashboard({
      role,
      indicators: { 1: makeIndicators({ recentActivity: TEAM }) },
    });

    const first = within(activityCard()).getAllByRole('listitem')[0] as HTMLElement;
    const clock = clockOf('2026-10-05T16:21:00.000Z', browserTimeZone());
    // A record of another day than today says the day too.
    expect(first).toHaveTextContent(new RegExp(`Screen · .*${clock}`));
    expect(first.querySelector('time')).toHaveAttribute('datetime', '2026-10-05T16:21:00.000Z');
  });

  it('shows at most 10 records', async () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      makeActivity(100 + index, { entityLabel: `Pantalla${index}` }),
    );
    await renderDashboard({
      role,
      indicators: { 1: makeIndicators({ recentActivity: many }) },
    });

    expect(within(activityCard()).getAllByRole('listitem')).toHaveLength(10);
  });

  it('links the label to its page when its type has one, and leaves the rest as text', async () => {
    await renderDashboard({
      role,
      indicators: { 1: makeIndicators({ recentActivity: TEAM }) },
    });

    const card = within(activityCard());
    expect(card.getByRole('link', { name: 'Detalle' })).toHaveAttribute('href', '/screens/12');
    expect(card.getByRole('link', { name: 'locOrden' })).toHaveAttribute('href', '/variables/40');
    expect(card.getByRole('link', { name: 'colViejos' })).toHaveAttribute('href', '/collections/7');
    expect(card.queryByRole('link', { name: 'TECHEA-104' })).not.toBeInTheDocument();
    expect(card.getByText('TECHEA-104')).toBeInTheDocument();
  });

  it('draws no value of a change: the API does not send them', async () => {
    await renderDashboard({
      role,
      indicators: { 1: makeIndicators({ recentActivity: TEAM }) },
    });

    expect(within(activityCard()).queryByText(/Before|After|Show more/)).not.toBeInTheDocument();
    expect(within(activityCard()).queryAllByRole('button')).toHaveLength(0);
  });

  it('has the "Audit log →" link, which opens the audit log of the selected application', async () => {
    const user = setupUser();
    const { router } = await renderDashboard({
      role,
      indicators: { 1: makeIndicators({ recentActivity: TEAM }) },
    });

    const link = within(activityCard()).getByRole('link', { name: 'Audit log →' });
    expect(link).toHaveAttribute('href', '/audit');
    await user.click(link);

    expect(router.state.location.pathname).toBe('/audit');
  });

  it('says so when there is no activity yet', async () => {
    await renderDashboard({ role });

    expect(within(activityCard()).getByText('No recent activity yet.')).toBeInTheDocument();
  });
});

describe('recent activity: time', () => {
  it('writes only the time for today and the day too for another day', () => {
    expect(activityTime('2026-10-05T16:21:00.000Z', 'America/Costa_Rica', '2026-10-05')).toBe(
      '10:21',
    );
    expect(activityTime('2026-10-04T16:21:00.000Z', 'America/Costa_Rica', '2026-10-05')).toBe(
      'Oct 4, 10:21',
    );
    expect(activityTime('2025-10-04T16:21:00.000Z', 'America/Costa_Rica', '2026-10-05')).toBe(
      'Oct 4, 2025, 10:21',
    );
  });
});

describe('recent activity for the Reader', () => {
  it('has no section, no heading and no link to the audit log', async () => {
    await renderDashboard({
      role: 'READER',
      indicators: { 1: makeIndicators({ recentActivity: TEAM }) },
    });

    // The API does not send the key to a Reader (D-34), so nothing is drawn.
    expect(screen.queryByRole('region', { name: 'Recent activity' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recent activity' })).not.toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(main.queryByRole('link', { name: /Audit log/ })).not.toBeInTheDocument();
    expect(main.queryByText('Sample Developer A', { exact: false })).not.toBeInTheDocument();
    // The rest of the dashboard is there.
    expect(main.getByRole('article', { name: 'Documentation approved' })).toBeInTheDocument();
  });

  it('does not even show the card while the data loads', async () => {
    await renderDashboard({ role: 'READER', settled: false });

    expect(screen.queryByRole('region', { name: 'Recent activity' })).not.toBeInTheDocument();
  });
});
