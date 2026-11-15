// Audit log, links to the element and the note about rows deleted in cascade, plus the structure a screen reader walks:
// day headings, ordered lists and filters with names.
// Time and zone are fixed (fixClock): today is Oct 5, 2026 in America/Costa_Rica (UTC-6).
import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CASCADE_NOTE } from '../../modules/audit/AuditLogPage';
import { ENTRIES } from '../helpers/auditSample';
import { makeEntry } from '../helpers/fakeAuditApi';
import { fixClock, renderAudit } from '../helpers/renderAudit';
import { setupUser } from '../helpers/setupUser';

beforeEach(() => {
  fixClock();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function timeline() {
  return within(screen.getByRole('region', { name: 'Audit records' }));
}

const LINKED = [
  makeEntry(1, { entityType: 'screen', entityId: '12', entityLabel: 'scrHome' }),
  makeEntry(2, { entityType: 'variable', entityId: '41', entityLabel: 'gToken' }),
  makeEntry(3, { entityType: 'collection', entityId: '3', entityLabel: 'colClients' }),
  // A deleted element keeps its link: its page answers with its own "doesn't exist".
  makeEntry(4, { action: 'DELETE', entityType: 'screen', entityId: '99', entityLabel: 'scrGone' }),
];

const NOT_LINKED = [
  makeEntry(11, { entityType: 'application', entityId: '1', entityLabel: 'SAR-app' }),
  makeEntry(12, { entityType: 'element_environment', entityId: '12:DEV', entityLabel: 'DEV' }),
  makeEntry(13, { entityType: 'screen_variable', entityId: '88', entityLabel: 'OnVisible' }),
  makeEntry(14, { entityType: 'screen_collection', entityId: '7', entityLabel: 'OnStart' }),
  makeEntry(15, { entityType: 'variable_collection', entityId: '5', entityLabel: 'Set' }),
  makeEntry(16, { entityType: 'dependency', entityId: '30', entityLabel: 'NAVIGATES_TO' }),
  makeEntry(17, { entityType: 'jira_ticket', entityId: '7', entityLabel: 'TECHEA-104' }),
  makeEntry(18, { entityType: 'comment', entityId: '70', entityLabel: 'Looks good' }),
  makeEntry(19, { entityType: 'report', entityId: '9', entityLabel: 'Q4 report' }),
  makeEntry(20, { entityType: 'component', entityId: '15', entityLabel: 'btnSave' }),
  makeEntry(21, { entityType: 'collection_field', entityId: '5', entityLabel: 'Fax' }),
];

describe('audit log, the link to the element', () => {
  it('links the label of a screen, a variable and a collection to their page, a deleted one too', async () => {
    await renderAudit({ entries: LINKED });
    await screen.findByText('scrHome');

    expect(timeline().getByRole('link', { name: 'scrHome' })).toHaveAttribute(
      'href',
      '/screens/12',
    );
    expect(timeline().getByRole('link', { name: 'gToken' })).toHaveAttribute(
      'href',
      '/variables/41',
    );
    expect(timeline().getByRole('link', { name: 'colClients' })).toHaveAttribute(
      'href',
      '/collections/3',
    );
    expect(timeline().getByRole('link', { name: 'scrGone' })).toHaveAttribute(
      'href',
      '/screens/99',
    );
  });

  it('opens the page of the element when the link is followed', async () => {
    const { router } = await renderAudit({ entries: LINKED });
    const user = setupUser();
    await screen.findByText('gToken');
    await user.click(timeline().getByRole('link', { name: 'gToken' }));
    expect(router.state.location.pathname).toBe('/variables/41');
  });

  it('draws as plain text what has no page of its own: applications, associative tables, dependencies and the rest', async () => {
    await renderAudit({ entries: NOT_LINKED, path: '/audit?application=all' });
    await screen.findByText('SAR-app');

    for (const label of NOT_LINKED.map((entry) => entry.entityLabel ?? '')) {
      expect(timeline().getByText(label)).toBeInTheDocument();
      expect(timeline().queryByRole('link', { name: label })).toBeNull();
    }
    expect(timeline().queryAllByRole('link')).toHaveLength(0);
  });
});

describe('audit log, rows deleted in cascade', () => {
  it('tells, under the timeline, that they carry no application while an application is chosen', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Detalle');
    expect(timeline().getByText(CASCADE_NOTE)).toBeInTheDocument();
    expect(CASCADE_NOTE).toBe(
      'Rows removed together with their element carry no application. Choose "All applications" to find them.',
    );
  });

  it('says it under the "No results" state too', async () => {
    await renderAudit({
      entries: ENTRIES,
      path: '/audit?type=report&from=2026-09-29&to=2026-10-05',
    });
    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(timeline().getByText(CASCADE_NOTE)).toBeInTheDocument();
  });

  it('is left out over all the applications', async () => {
    await renderAudit({ entries: ENTRIES, path: '/audit?application=all' });
    await screen.findByText('Detalle');
    expect(screen.queryByText(CASCADE_NOTE)).toBeNull();
  });

  it('shows the rows without application once "All applications" is chosen (the note names the way)', async () => {
    const orphan = makeEntry(50, {
      action: 'DELETE',
      entityType: 'dependency',
      entityId: '31',
      entityLabel: 'CONTAINS',
      applicationId: null,
    });
    await renderAudit({ entries: [...ENTRIES, orphan] });
    const user = setupUser();
    await screen.findByText('Detalle');
    expect(screen.queryByText('CONTAINS')).toBeNull();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Application' }),
      'All applications',
    );
    expect(await screen.findByText('CONTAINS')).toBeInTheDocument();
  });
});

describe('audit log, what a screen reader walks', () => {
  it('has one level-1 title, a heading for each day and an ordered list of records under each', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Detalle');

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Audit log');
    for (const name of ['Today · Oct 5', 'Yesterday · Oct 4', 'Saturday · Oct 3']) {
      const list = screen.getByRole('list', { name });
      expect(list.tagName).toBe('OL');
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
  });

  it('gives every filter an accessible name', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Detalle');

    expect(screen.getByRole('button', { name: 'Period: Last 7 days' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'User' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Element type' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Element id' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Action' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Application' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'This period' })).toBeInTheDocument();
  });

  it('opens the period panel as a dialog with labelled fields and closes it with Esc', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Detalle');
    const user = setupUser();
    const trigger = screen.getByRole('button', { name: 'Period: Last 7 days' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog', { name: 'Date range' });
    expect(within(dialog).getByLabelText('From')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('To')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Date range' })).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
