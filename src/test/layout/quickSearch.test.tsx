// Quick search of the top bar (S-30, D-48, D-133, flow 4): the combobox and its panel over the in-memory search API.
// Covers how it opens (click, Ctrl+K, Cmd+K), the rule of the text (2 to 100 characters, nothing asked outside it), the
// single request of 20 rows, the groups (order, 3 rows each, empty groups left out), the marks, the footer, the keyboard
// (arrows, Enter, Esc, Tab), where each type leads, the ARIA pattern, the states (empty, errors, loading) and the answers
// that arrive out of order. The pause after the last key is controlled with the fake clock (searchPause), never outwaited.
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { Role } from '../../app/router/routes';
import { SKELETON_DELAY_MS } from '../../components/ui/useDelayedLoading';
import {
  collectionElement,
  componentElement,
  screenElement,
  variableElement,
  type SimElement,
} from '../helpers/fakeSearchApi';
import { expectConsoleError } from '../helpers/expectConsoleError';
import { renderSearch, type RenderSearchOptions } from '../helpers/renderSearch';
import { controlSearchTimers, endSearchPause } from '../helpers/searchPause';
import { setupUser, settle } from '../helpers/setupUser';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * The pages a result leads to are not served by this fake, so the screen page fails to draw (a screen without a status).
 * Only that error is accepted; any other console.error fails the test.
 */
function quietDestination() {
  expectConsoleError(
    /Cannot read properties of undefined \(reading 'toLowerCase'\)/,
    /The above error occurred in the <ScreenDetailPage> component/,
  );
}

// Ten elements match "client": four screens, one collection, one component, four variables (one only in its description).
const ELEMENTS: SimElement[] = [
  screenElement(1, 'Cliente 1', { status: 'APPROVED' }),
  screenElement(2, 'Cliente 2'),
  screenElement(3, 'Cliente 3'),
  screenElement(4, 'Cliente 4'),
  collectionElement(21, 'colClientes'),
  componentElement(31, 'galClientes', { screen: { id: 12, name: 'Inicio' } }),
  variableElement(7, 'gCliente1'),
  variableElement(8, 'gCliente2'),
  variableElement(9, 'gCliente3'),
  variableElement(10, 'gCliente4'),
  variableElement(11, 'gAux', { description: 'Record of the selected client.' }),
];

interface OpenOptions {
  role?: Role;
  elements?: SimElement[];
  path?: string;
  prepare?: RenderSearchOptions['prepare'];
}

async function open(options: OpenOptions = {}) {
  controlSearchTimers();
  const view = await renderSearch({
    role: options.role,
    path: options.path ?? '/variables',
    elements: options.elements ?? ELEMENTS,
    prepare: options.prepare,
  });
  return { ...view, user: setupUser() };
}

const field = () => screen.getByRole('combobox', { name: 'Quick search' });
const listbox = () => screen.getByRole('listbox', { name: 'Quick search' });
const optionNames = () =>
  within(listbox())
    .getAllByRole('option')
    .map((o) => o.textContent);
const liveText = () => document.querySelector('[aria-live="polite"]')?.textContent;

type Opened = Awaited<ReturnType<typeof open>>;

async function type(view: Opened, text: string) {
  await view.user.click(field());
  await view.user.clear(field());
  await view.user.paste(text);
  await endSearchPause();
}

async function keyDown(init: KeyboardEventInit) {
  await act(async () => {
    fireEvent.keyDown(document.body, init);
    await Promise.resolve();
  });
}

describe('opening', () => {
  it('is a combobox named "Quick search" with the frame placeholder, the application chip and the shortcut', async () => {
    await open();
    expect(field()).toHaveAttribute(
      'placeholder',
      'Search screens, variables, collections, components…',
    );
    expect(field()).toHaveAttribute('aria-expanded', 'false');
    expect(field()).toHaveAttribute('aria-autocomplete', 'list');
    expect(screen.getByText('in SAR')).toBeInTheDocument();
    expect(screen.getByText('Ctrl K')).toBeInTheDocument();
  });

  it('opens the panel with the help text on click, and the combobox points to its listbox', async () => {
    const view = await open();
    await view.user.click(field());
    expect(field()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Type at least 2 characters to search.')).toBeInTheDocument();
    const listboxId = field().getAttribute('aria-controls');
    expect(listboxId).not.toBeNull();
    expect(document.getElementById(listboxId ?? '')).toBe(listbox());
  });

  it('Ctrl+K focuses the field and opens the panel, and the browser does not get the key', async () => {
    await open();
    const notCancelled = fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    await settle();
    expect(notCancelled).toBe(false);
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute('aria-expanded', 'true');
  });

  it('Cmd+K does the same, from a field of the page', async () => {
    const view = await open();
    await view.user.click(screen.getByRole('searchbox', { name: /search/i }));
    await keyDown({ key: 'k', metaKey: true });
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not take Ctrl+Shift+K or a plain k', async () => {
    await open();
    await keyDown({ key: 'k', ctrlKey: true, shiftKey: true });
    await keyDown({ key: 'k' });
    expect(field()).not.toHaveFocus();
  });
});

describe('the text', () => {
  it('asks nothing with fewer than 2 characters once trimmed and shows the help', async () => {
    const view = await open();
    const { api } = view;
    await type(view, 'a');
    await type(view, '   a  ');
    expect(api.calls).toHaveLength(0);
    expect(screen.getByText('Type at least 2 characters to search.')).toBeInTheDocument();
  });

  it('asks nothing with more than 100 characters and says so', async () => {
    const view = await open();
    await type(view, 'a'.repeat(101));
    expect(view.api.calls).toHaveLength(0);
    expect(screen.getByText('Use up to 100 characters.')).toBeInTheDocument();
  });

  it('asks the trimmed text with one request of 20 rows for the selected application', async () => {
    const view = await open();
    await type(view, '  client  ');
    await screen.findByRole('listbox', { name: 'Quick search' });
    expect(view.api.calls).toHaveLength(1);
    expect(view.api.calls[0]?.query).toEqual({
      applicationId: 1,
      q: 'client',
      page: 1,
      pageSize: 20,
    });
  });

  it('waits for the pause after the last key: several keys are one request', async () => {
    const view = await open();
    await view.user.click(field());
    await view.user.keyboard('clie');
    expect(view.api.calls).toHaveLength(0);
    await view.user.keyboard('nt');
    await endSearchPause();
    expect(view.api.calls.map((call) => call.query.q)).toEqual(['client']);
  });

  it('accepts exactly 100 characters', async () => {
    const view = await open();
    await type(view, 'a'.repeat(100));
    expect(view.api.calls).toHaveLength(1);
  });
});

describe('the results', () => {
  it('groups them by type in the order of the frame, three rows at most, and leaves out empty groups', async () => {
    const view = await open();
    await type(view, 'client');
    const headings = within(listbox())
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-labelledby'))
      .map((id) => document.getElementById(id ?? '')?.textContent);
    expect(headings).toEqual(['Screens', 'Collections', 'Components', 'Variables']);
    expect(
      within(screen.getByRole('group', { name: 'Screens' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Cliente 1Approved', 'Cliente 2Draft', 'Cliente 3Draft']);
    expect(
      within(screen.getByRole('group', { name: 'Variables' })).getAllByRole('option'),
    ).toHaveLength(3);
  });

  it('shows no group for a type without rows', async () => {
    const view = await open({ elements: [variableElement(7, 'gCliente')] });
    await type(view, 'client');
    expect(screen.queryByRole('group', { name: 'Screens' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Variables' })).toBeInTheDocument();
  });

  it('shows the note of each row: the screen of a component and where a variable matched, not the name', async () => {
    const view = await open();
    await type(view, 'client');
    expect(
      within(screen.getByRole('group', { name: 'Components' })).getByText('Inicio'),
    ).toBeInTheDocument();
    expect(screen.queryByText('matched in name')).not.toBeInTheDocument();
    await type(view, 'selected');
    expect(await screen.findByText('matched in description')).toBeInTheDocument();
  });

  it('marks the text with the rules of the API: capitals and accents are the same, in the name', async () => {
    const view = await open({ elements: [variableElement(1, 'gÁrbol')] });
    await type(view, 'ARBOL');
    const marks = within(listbox()).getAllByText('gÁrbol'.slice(1), { selector: 'mark' });
    expect(marks).toHaveLength(1);
  });

  it('has the footer as the last option with the text, the Enter hint and the total of the answer', async () => {
    const view = await open();
    await type(view, 'client');
    const footer = within(listbox()).getAllByRole('option').at(-1);
    expect(footer).toHaveTextContent('See all results for “client”· Enter11 results');
    expect(liveText()).toBe('11 results');
  });

  it('draws the text of the page, not escaped away: markup in a name stays text', async () => {
    const view = await open({ elements: [variableElement(1, 'gClient<b>x</b>')] });
    await type(view, 'client');
    expect(await screen.findByRole('option', { name: /gClient<b>x<\/b>/ })).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
  });
});

describe('the keyboard', () => {
  it('moves through the rows with the arrows without leaving the field, and wraps', async () => {
    const view = await open();
    await type(view, 'client');
    const options = within(listbox()).getAllByRole('option');
    await view.user.keyboard('{ArrowDown}');
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute('aria-activedescendant', options[0]?.id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await view.user.keyboard('{ArrowDown}');
    expect(field()).toHaveAttribute('aria-activedescendant', options[1]?.id);
    await view.user.keyboard('{ArrowUp}{ArrowUp}');
    // Up from the first row wraps to the footer.
    expect(field()).toHaveAttribute('aria-activedescendant', options.at(-1)?.id);
    await view.user.keyboard('{ArrowDown}');
    expect(field()).toHaveAttribute('aria-activedescendant', options[0]?.id);
    expect(field()).toHaveFocus();
  });

  it('has no active row at first: ArrowUp starts at the footer', async () => {
    const view = await open();
    await type(view, 'client');
    expect(field()).not.toHaveAttribute('aria-activedescendant');
    await view.user.keyboard('{ArrowUp}');
    expect(field()).toHaveAttribute(
      'aria-activedescendant',
      within(listbox()).getAllByRole('option').at(-1)?.id,
    );
  });

  // One destination per test: a destination page that is still reading when the next search starts would update outside act.
  it.each([
    ['a screen', '{ArrowDown}', '/screens/1'],
    ['a collection', '{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}', '/collections/21'],
    ['a variable', '{ArrowUp}{ArrowUp}', '/variables/8'],
  ])('Enter opens the active row of %s at its page', async (_what, keys, path) => {
    quietDestination();
    const view = await open();
    await type(view, 'client');
    await view.user.keyboard(`${keys}{Enter}`);
    expect(view.router.state.location.pathname).toBe(path);
  });

  it('opens a component in the Components & navigation tab of its screen (D-102)', async () => {
    quietDestination();
    const view = await open();
    await type(view, 'client');
    await view.user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(view.router.state.location.pathname).toBe('/screens/12');
    expect(view.router.state.location.search).toBe('?tab=components');
  });

  it('Enter with no active row opens the advanced search with the text', async () => {
    const view = await open();
    await type(view, ' ñandú & co ');
    await view.user.keyboard('{Enter}');
    expect(view.router.state.location.pathname).toBe('/search');
    expect(new URLSearchParams(view.router.state.location.search).get('q')).toBe('ñandú & co');
    expect(await screen.findByRole('searchbox', { name: 'Search text' })).toHaveValue('ñandú & co');
  });

  it('Enter with a text outside 2 to 100 characters goes nowhere', async () => {
    const view = await open();
    await type(view, 'a');
    await view.user.keyboard('{Enter}');
    expect(view.router.state.location.pathname).toBe('/variables');
  });

  it('"See all results" leads to /search with q, by click too', async () => {
    const view = await open();
    await type(view, 'client');
    await view.user.click(within(listbox()).getAllByRole('option').at(-1) as HTMLElement);
    expect(view.router.state.location.pathname).toBe('/search');
    expect(view.router.state.location.search).toBe('?q=client');
  });

  it('a click on a row opens it, closes the panel and clears the field', async () => {
    quietDestination();
    const view = await open();
    await type(view, 'client');
    await view.user.click(within(listbox()).getAllByRole('option')[0] as HTMLElement);
    expect(view.router.state.location.pathname).toBe('/screens/1');
    expect(field()).toHaveAttribute('aria-expanded', 'false');
    expect(field()).toHaveValue('');
  });

  it('Esc closes the panel and leaves the focus in the field; typing opens it again', async () => {
    const view = await open();
    await type(view, 'client');
    await view.user.keyboard('{Escape}');
    expect(field()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
    expect(field()).toHaveValue('client');
    await view.user.keyboard('s');
    expect(field()).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes with a click outside and when Tab leaves the field', async () => {
    const view = await open();
    await type(view, 'client');
    await view.user.click(document.body);
    expect(field()).toHaveAttribute('aria-expanded', 'false');
    await view.user.click(field());
    expect(field()).toHaveAttribute('aria-expanded', 'true');
    await view.user.tab();
    expect(field()).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('states', () => {
  it('says there are no results, names the application and the text, and keeps "See all results"', async () => {
    const view = await open();
    await type(view, 'zzz');
    expect(await screen.findByText('No results', { selector: 'p' })).toBeInTheDocument();
    expect(
      screen.getByText('Nothing in SAR matches “zzz”. Try another word or open advanced search.'),
    ).toBeInTheDocument();
    expect(optionNames()).toEqual(['See all results for “zzz”· Enter']);
    expect(liveText()).toBe('No results');
  });

  it('shows the catalog text of a 400', async () => {
    const view = await open({
      prepare: (api) => {
        api.failNext(
          'GET /search',
          new ApiError({
            status: 400,
            code: 'VALIDATION_ERROR',
            details: { fields: [{ field: 'q', rule: 'minLength', message: 'x' }] },
          }),
        );
      },
    });
    await type(view, 'client');
    expect(await screen.findByRole('alert')).toHaveTextContent('Check the highlighted fields.');
  });

  it('shows the text of an internal error with its reference', async () => {
    const view = await open({
      prepare: (api) => {
        api.failNext(
          'GET /search',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR', requestId: 'req-77' }),
        );
      },
    });
    await type(view, 'client');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side. Try again in a moment. Reference: req-77.',
    );
  });

  it('asks again with the next text after an error', async () => {
    const view = await open({
      prepare: (api) => {
        api.failNext('GET /search', new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
      },
    });
    await type(view, 'client');
    await screen.findByRole('alert');
    await type(view, 'clientes');
    expect(await screen.findByRole('group', { name: 'Collections' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('draws a skeleton only after 300 ms of waiting', async () => {
    let gate!: { release: () => void };
    const view = await open({
      prepare: (api) => {
        gate = api.hold(() => true);
      },
    });
    await type(view, 'client');
    expect(document.querySelectorAll('.rounded-skeleton')).toHaveLength(0);
    await act(async () => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
      await Promise.resolve();
    });
    expect(document.querySelectorAll('.rounded-skeleton').length).toBeGreaterThan(0);
    await act(async () => {
      gate.release();
      await Promise.resolve();
    });
    await settle();
    expect(document.querySelectorAll('.rounded-skeleton')).toHaveLength(0);
    expect(within(listbox()).getAllByRole('option').length).toBeGreaterThan(1);
  });
});

describe('answers out of order', () => {
  const RACE: SimElement[] = [
    variableElement(1, 'abOnly'),
    variableElement(2, 'abcThing'),
    variableElement(3, 'abAndMore'),
  ];

  it('keeps the rows of the current text when the answer of the old one arrives last', async () => {
    let slowAb!: { release: () => void };
    const view = await open({
      elements: RACE,
      prepare: (api) => {
        slowAb = api.hold((call) => call.query.q === 'ab');
      },
    });
    await type(view, 'ab');
    await type(view, 'abc');
    expect(await screen.findByRole('option', { name: /abcThing/ })).toBeInTheDocument();
    expect(optionNames()[0]).toContain('abcThing');

    await act(async () => {
      slowAb.release();
      await Promise.resolve();
    });
    await settle();
    expect(optionNames()).toEqual(['abcThing', 'See all results for “abc”· Enter1 result']);
    expect(view.api.calls.map((call) => call.query.q)).toEqual(['ab', 'abc']);
    // The request of the old text was cancelled, not just ignored.
    expect(view.api.calls[0]?.signal?.aborted).toBe(true);
    expect(view.api.calls[1]?.signal?.aborted).toBe(false);
  });

  it('does not show the rows of the old text as the answer of the new one when it fails', async () => {
    const view = await open({
      elements: RACE,
      prepare: (api) => {
        api.failNext('GET /search', new ApiError({ status: 500, code: 'INTERNAL_ERROR' }), {
          when: (call) => call.query.q === 'abc',
        });
      },
    });
    await type(view, 'ab');
    await screen.findByRole('option', { name: /abOnly/ });
    await type(view, 'abc');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /abOnly/ })).not.toBeInTheDocument();
  });
});

describe('the three roles', () => {
  it.each<Role>(['ADMINISTRATOR', 'DEVELOPER', 'READER'])(
    '%s can search and open a result',
    async (role) => {
      quietDestination();
      const view = await open({ role });
      await type(view, 'client');
      expect(within(listbox()).getAllByRole('option').length).toBeGreaterThan(1);
      await view.user.keyboard('{ArrowDown}{Enter}');
      expect(view.router.state.location.pathname).toBe('/screens/1');
    },
  );

  it('is disabled while there is no selected application', async () => {
    controlSearchTimers();
    const view = await renderSearch({ path: '/admin/applications', applications: [] });
    expect(view.api.calls).toHaveLength(0);
    expect(field()).toBeDisabled();
  });
});
