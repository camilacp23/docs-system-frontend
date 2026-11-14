// Audit log, the detail of a record (S-32): the fields of an UPDATE as Field / Before / After, the values of a CREATE, a
// DELETE and an EVENT, the id of the element, the database role (only when the API sends it), values drawn as text,
// nested JSON, long values with "Show more", a password change with no value, and the keyboard use of the opener.
// Time and zone are fixed (fixClock): today is Oct 5, 2026 in America/Costa_Rica (UTC-6).
import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VALUE_LIMIT } from '../../modules/audit/AuditValue';
import { ENTRIES } from '../helpers/auditSample';
import { makeEntry, type EntryOverrides } from '../helpers/fakeAuditApi';
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

/** The record whose element label is `label`. */
function record(label: string) {
  return within(timeline().getByText(label).closest('li') as HTMLElement);
}

/** Opens the record. The record is found BEFORE it opens: its values may repeat the label afterwards. */
async function open(label: string) {
  const user = setupUser();
  const item = record(label);
  await user.click(item.getByRole('button', { name: /^Details of / }));
  return { user, detail: item };
}

/** One record with the given label, alone in the timeline. */
function only(label: string, overrides: EntryOverrides) {
  return [makeEntry(1, { entityLabel: label, ...overrides })];
}

describe('audit log, opening a record', () => {
  it('is closed at first, opens and closes with its button, and says so with aria-expanded and aria-controls', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Detalle');
    const user = setupUser();
    const button = record('Detalle').getByRole('button', {
      name: 'Details of Sample Developer A updated screen Detalle',
    });

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(record('Detalle').queryByRole('table')).toBeNull();

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const detail = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(detail).not.toBeNull();
    expect(
      within(detail as HTMLElement).getByRole('table', { name: 'Changes' }),
    ).toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(record('Detalle').queryByRole('table')).toBeNull();
  });

  it('opens and closes with the keyboard: Enter and Space on the focused button', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Detalle');
    const user = setupUser();
    const button = record('Detalle').getByRole('button', { name: /^Details of / });

    button.focus();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps each record open or closed on its own', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Detalle');
    const created = record('locOrden');
    const inicio = record('Inicio');
    const { user, detail } = await open('Detalle');
    await user.click(created.getByRole('button', { name: /^Details of / }));

    expect(detail.getByRole('table', { name: 'Changes' })).toBeInTheDocument();
    expect(created.getByRole('table', { name: 'Values' })).toBeInTheDocument();
    expect(inicio.queryByRole('table')).toBeNull();
  });
});

describe('audit log, the detail of each action', () => {
  it('UPDATE: a table of Field, Before and After for the fields that changed, "—" for an empty value', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Detalle');
    const { detail } = await open('Detalle');

    const table = detail.getByRole('table', { name: 'Changes' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Field', 'Before', 'After']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const [working, known] = rows as [HTMLElement, HTMLElement];
    expect(within(working).getByRole('rowheader')).toHaveTextContent('workingProcess');
    expect(
      within(working)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['Old text', 'New text']);
    expect(
      within(known)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['—', 'Saving twice may duplicate the Patch.']);
    expect(detail.getByText('Old text')).toHaveClass('line-through');
    // The fields that did not change are not listed.
    expect(detail.queryByText('id')).toBeNull();
  });

  it('CREATE: the new values', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('locOrden');
    const { detail } = await open('locOrden');

    const table = detail.getByRole('table', { name: 'Values' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Field', 'Value']);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((h) => h.textContent),
    ).toEqual(['id', 'name', 'scope']);
    expect(within(table).getByText('CONTEXT')).toBeInTheDocument();
  });

  it('DELETE: the old values', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Fax');
    const { detail } = await open('Fax');
    const table = detail.getByRole('table', { name: 'Values' });
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((h) => h.textContent),
    ).toEqual(['id', 'name']);
    expect(within(table).getByText('5')).toBeInTheDocument();
  });

  it('EVENT: its payload, with "—" for a null id of comment', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Inicio');
    const { detail } = await open('Inicio');
    const table = detail.getByRole('table', { name: 'Values' });
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((h) => h.textContent),
    ).toEqual(['from', 'to', 'commentId']);
    expect(within(table).getByText('IN_REVIEW')).toBeInTheDocument();
    expect(within(table).getByText('APPROVED')).toBeInTheDocument();
    expect(within(table).getByText('—')).toBeInTheDocument();
  });

  it('says so when a record has no details to show', async () => {
    await renderAudit({
      entries: only('empty', { action: 'EVENT', eventName: 'SOMETHING', newValue: null }),
    });
    await screen.findByText('empty');
    const { detail } = await open('empty');
    expect(detail.getByText('No details recorded.')).toBeInTheDocument();
    expect(detail.queryByRole('table')).toBeNull();
  });
});

describe('audit log, the id of the element and the database role', () => {
  it('shows the id of the element, also a composite one, and the database role to an Administrator', async () => {
    await renderAudit({
      entries: only('DEV', {
        entityType: 'element_environment',
        entityId: '12:DEV',
        action: 'CREATE',
        newValue: { elementId: 12, environment: 'DEV' },
      }),
    });
    await screen.findByText('DEV');
    const { detail } = await open('DEV');
    expect(detail.getByText('Element id').nextElementSibling).toHaveTextContent('12:DEV');
    expect(detail.getByText('Database role').nextElementSibling).toHaveTextContent('docs_app');
  });

  it('shows no database role to a Developer, whose answer does not carry it', async () => {
    await renderAudit({ role: 'DEVELOPER', entries: ENTRIES });
    await screen.findByText('Inicio');
    const { detail } = await open('Inicio');
    expect(detail.getByText('Element id')).toBeInTheDocument();
    expect(detail.queryByText('Database role')).toBeNull();
  });
});

describe('audit log, values as text', () => {
  it('draws "<", ">" and "&" as the characters they are, never as HTML or Markdown', async () => {
    const nasty = '<b>bold</b> & <script>alert(1)</script> **not bold** [x](http://evil.test)';
    await renderAudit({
      entries: only('nasty', {
        changedFields: ['description'],
        oldValue: { description: '<img src=x onerror=alert(1)>' },
        newValue: { description: nasty },
      }),
    });
    await screen.findByText('nasty');
    const { detail } = await open('nasty');

    expect(detail.getByText(nasty)).toBeInTheDocument();
    expect(detail.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    const element = detail.getByRole('table', { name: 'Changes' });
    expect(element.querySelector('b, script, img, a, strong')).toBeNull();
  });

  it('shows an object or an array as formatted JSON, nested ones included', async () => {
    const parameters = {
      format: 'PDF',
      scope: {
        elementTypes: ['SCREEN', 'VARIABLE'],
        screenIds: [1, 2],
        includeDependencies: false,
      },
    };
    await renderAudit({
      entries: only('Q4', {
        entityType: 'report',
        entityId: '9',
        action: 'CREATE',
        newValue: { id: 9, title: 'Q4', parameters },
      }),
    });
    await screen.findByText('Q4', { selector: 'span' });
    const { detail } = await open('Q4');
    const json = detail.getByText((_, element) => element?.tagName === 'PRE');
    expect(json.textContent).toBe(JSON.stringify(parameters, null, 2));
    expect(json.textContent).toContain('\n    "elementTypes": [\n      "SCREEN",');
  });

  it('cuts a long value, shows it whole with "Show more" and cuts it again with "Show less"', async () => {
    const long = `start-${'x'.repeat(VALUE_LIMIT * 2)}-end`;
    await renderAudit({
      entries: only('long', {
        changedFields: ['notes'],
        oldValue: { notes: null },
        newValue: { notes: long },
      }),
    });
    await screen.findByText('long');
    const { user, detail } = await open('long');

    expect(detail.queryByText(long)).toBeNull();
    expect(detail.getByText(`${long.slice(0, VALUE_LIMIT)}…`)).toBeInTheDocument();
    const more = detail.getByRole('button', { name: 'Show more' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);
    expect(detail.getByText(long)).toBeInTheDocument();
    const less = detail.getByRole('button', { name: 'Show less' });
    expect(less).toHaveAttribute('aria-expanded', 'true');
    await user.click(less);
    expect(detail.getByText(`${long.slice(0, VALUE_LIMIT)}…`)).toBeInTheDocument();
  });

  it('offers no "Show more" for a value that fits', async () => {
    await renderAudit({ entries: ENTRIES });
    await screen.findByText('Detalle');
    const { detail } = await open('Detalle');
    expect(detail.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
});

describe('audit log, a password change', () => {
  it('shows "Password" as changed, with no value, and never draws a hash that might arrive', async () => {
    await renderAudit({
      path: '/audit?application=all',
      entries: only('Dani Dev', {
        entityType: 'app_user',
        entityId: '5',
        applicationId: null,
        changedFields: ['name', 'passwordHash'],
        // The API leaves the key out; if it ever sent it, the client must not draw it.
        oldValue: { name: 'Dani', passwordHash: '$2b$12$secret-old-hash' },
        newValue: { name: 'Dani Dev', passwordHash: '$2b$12$secret-new-hash' },
      }),
    });
    await screen.findByText('Dani Dev', { selector: 'span' });
    const chips = record('Dani Dev').getByRole('list', { name: 'Changed fields' });
    expect(within(chips).getByText('Password')).toBeInTheDocument();
    expect(within(chips).queryByText('passwordHash')).toBeNull();

    const { detail } = await open('Dani Dev');
    const row = detail.getByRole('rowheader', { name: 'Password' }).closest('tr') as HTMLElement;
    expect(within(row).getByText("Changed. The value isn't stored.")).toBeInTheDocument();
    expect(within(row).getAllByRole('cell')).toHaveLength(1);
    expect(screen.queryByText(/secret|\$2b\$/)).toBeNull();
    expect(screen.queryByText('passwordHash')).toBeNull();
    // The other field of the same change still has its values.
    expect(detail.getByText('Dani')).toBeInTheDocument();
  });

  it('shows the field as changed when it is the only one, as the API sends it (no key in the images)', async () => {
    await renderAudit({
      path: '/audit?application=all',
      entries: only('Eva', {
        entityType: 'app_user',
        entityId: '8',
        applicationId: null,
        changedFields: ['passwordHash'],
        oldValue: { id: 8, name: 'Eva' },
        newValue: { id: 8, name: 'Eva' },
      }),
    });
    await screen.findByText('Eva', { selector: 'span' });
    const { detail } = await open('Eva');
    expect(detail.getByText("Changed. The value isn't stored.")).toBeInTheDocument();
    expect(detail.getAllByRole('row')).toHaveLength(2);
  });

  it('leaves a hash out of the values of a creation or a deletion too', async () => {
    await renderAudit({
      path: '/audit?application=all',
      entries: only('Zoe', {
        entityType: 'app_user',
        entityId: '9',
        applicationId: null,
        action: 'CREATE',
        newValue: { id: 9, name: 'Zoe', passwordHash: '$2b$12$secret-hash' },
      }),
    });
    await screen.findByText('Zoe', { selector: 'span' });
    const { detail } = await open('Zoe');
    expect(detail.queryByText(/secret/)).toBeNull();
    expect(detail.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['id', 'name']);
  });
});
