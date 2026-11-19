// The advanced search page (S-29, S-29b, S-29c): the text, the filters, the results and the states, over the
// simulator of GET /search (D-105).
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeApplication } from '../helpers/renderApp';
import {
  collectionElement,
  componentElement,
  screenElement,
  variableElement,
} from '../helpers/fakeSearchApi';
import { renderSearch, sampleElements } from '../helpers/renderSearch';
import { controlSearchTimers, endSearchPause } from '../helpers/searchPause';
import { setupUser } from '../helpers/setupUser';

afterEach(() => {
  vi.useRealTimers();
});

const searchBox = () => screen.getByRole('searchbox', { name: 'Search text' });
const resultNames = () =>
  within(screen.getByRole('list', { name: 'Search results' }))
    .getAllByRole('link')
    .map((link) => link.textContent);

async function firstItem(): Promise<HTMLElement> {
  const list = await screen.findByRole('list', { name: 'Search results' });
  return within(list).getAllByRole('listitem')[0]!;
}

async function typeAndSearch(user: ReturnType<typeof setupUser>, text: string) {
  await user.click(searchBox());
  await user.paste(text);
  await user.keyboard('{Enter}');
}

describe('initial state', () => {
  it('asks nothing without text and without a filter, and says what to do', async () => {
    const { api } = await renderSearch();
    expect(screen.getByRole('heading', { name: 'Advanced search', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Search the documentation')).toBeInTheDocument();
    expect(screen.getByText('Type at least 2 characters or choose a filter.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All —' })).toBeInTheDocument();
    expect(api.callsTo('GET /search')).toHaveLength(0);
  });

  it('describes the application in the subtitle', async () => {
    await renderSearch();
    expect(
      screen.getByText('Search across screens, variables, collections and components of SAR.'),
    ).toBeInTheDocument();
  });
});

describe('text', () => {
  it('searches when the user presses Enter and shows the heading with the text', async () => {
    const user = setupUser();
    const { api, router } = await renderSearch();
    await typeAndSearch(user, 'client');
    expect(await screen.findByRole('list', { name: 'Search results' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?q=client');
    expect(screen.getByRole('region', { name: '4 results for “client”' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('4 results for “client”');
    expect(screen.getByText('Exact name matches first, then by name.')).toBeInTheDocument();
    expect(api.listCalls()).toHaveLength(1);
  });

  it('searches at once when the user presses Enter (there is no Search button)', async () => {
    const user = setupUser();
    const { router } = await renderSearch();
    await user.click(searchBox());
    await user.paste('variable');
    await user.keyboard('{Enter}');
    expect(router.state.location.search).toBe('?q=variable');
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
  });

  it('searches by itself after a pause of 300 ms while the user types', async () => {
    controlSearchTimers();
    const user = setupUser();
    const { api, router } = await renderSearch();
    await user.click(searchBox());
    await user.paste('client');
    expect(api.callsTo('GET /search')).toHaveLength(0);
    await endSearchPause();
    expect(router.state.location.search).toBe('?q=client');
    expect(await screen.findByRole('list', { name: 'Search results' })).toBeInTheDocument();
  });

  it('trims the text before sending it and keeps the URL trimmed', async () => {
    const user = setupUser();
    const { api, router } = await renderSearch();
    await typeAndSearch(user, '   client   ');
    await screen.findByRole('list', { name: 'Search results' });
    expect(router.state.location.search).toBe('?q=client');
    for (const call of api.callsTo('GET /search')) expect(call.query.q).toBe('client');
  });

  it('shows the error of one character in the field and sends nothing', async () => {
    const user = setupUser();
    const { api } = await renderSearch();
    await typeAndSearch(user, '  c  ');
    expect(
      await screen.findByText('Type at least 2 characters, or search with filters only.'),
    ).toBeInTheDocument();
    expect(searchBox()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Search the documentation')).toBeInTheDocument();
    expect(api.callsTo('GET /search')).toHaveLength(0);
  });

  it('does not send one character even with a filter chosen', async () => {
    const { api } = await renderSearch({ path: '/search?q=c&scope=CONTEXT' });
    expect(
      screen.getByText('Type at least 2 characters, or search with filters only.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Search the documentation')).toBeInTheDocument();
    expect(api.callsTo('GET /search')).toHaveLength(0);
  });

  it('accepts exactly 100 characters once trimmed, even with spaces around them', async () => {
    const user = setupUser();
    const { api } = await renderSearch();
    const text = 'a'.repeat(100);
    await typeAndSearch(user, `   ${text}   `);
    await screen.findByText('No results');
    expect(api.listCalls()[0]?.query.q).toBe(text);
    expect(screen.queryByText('Use 100 characters or fewer.')).not.toBeInTheDocument();
  });

  it('shows the error of 101 characters and sends nothing', async () => {
    const user = setupUser();
    const { api } = await renderSearch();
    await typeAndSearch(user, 'a'.repeat(101));
    expect(await screen.findByText('Use 100 characters or fewer.')).toBeInTheDocument();
    expect(api.callsTo('GET /search')).toHaveLength(0);
  });
});

describe('results', () => {
  it('shows the icon, the type, the name, where it matched and the snippet of each result, in the order of the API', async () => {
    await renderSearch({ path: '/search?q=client' });
    const list = await screen.findByRole('list', { name: 'Search results' });
    expect(resultNames()).toEqual(['colClientes', 'galClientes', 'gRegistroSel', 'Inicio']);
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);

    const collection = items[0]!;
    expect(within(collection).getByText('Collection')).toBeInTheDocument();
    expect(within(collection).getByText('Matched in Name')).toBeInTheDocument();
    expect(within(collection).getByText('DEV')).toBeInTheDocument();
    expect(within(collection).getByText('PROD')).toBeInTheDocument();

    const component = items[1]!;
    expect(within(component).getByText('Component')).toBeInTheDocument();
    expect(within(component).getByText('Matched in Name · in Inicio')).toBeInTheDocument();

    const variable = items[2]!;
    expect(within(variable).getByText('Matched in Description')).toBeInTheDocument();
    expect(variable.querySelectorAll('mark')).toHaveLength(1);
    expect(variable.querySelector('mark')).toHaveTextContent('client');

    const screenRow = items[3]!;
    expect(within(screenRow).getByText('Screen')).toBeInTheDocument();
    expect(within(screenRow).getByText('Approved')).toBeInTheDocument();
    expect(within(screenRow).getByText('Matched in Template')).toBeInTheDocument();
    expect(Array.from(screenRow.querySelectorAll('mark')).map((mark) => mark.textContent)).toEqual([
      'client',
      'Client',
    ]);
  });

  it('marks the name whenever it contains the text, whatever matchedIn says', async () => {
    await renderSearch({
      path: '/search?q=cliente',
      elements: [variableElement(7, 'gCliente', { description: 'The Cliente of the session.' })],
    });
    const item = await firstItem();
    // The name has priority in matchedIn, but if the name also matched, it is marked and says "Name".
    expect(within(item).getByText('Matched in Name')).toBeInTheDocument();
    const marks = Array.from(item.querySelectorAll('mark')).map((mark) => mark.textContent);
    expect(marks).toEqual(['Cliente']);
  });

  it('leaves the name unmarked when the text is only in another field, and marks it there', async () => {
    await renderSearch({
      path: '/search?q=session',
      elements: [variableElement(7, 'gUsuario', { description: 'Data of the session.' })],
    });
    const item = await firstItem();
    expect(within(item).getByText('Matched in Description')).toBeInTheDocument();
    expect(within(item.querySelector('a')!).queryByText('session')).not.toBeInTheDocument();
    expect(Array.from(item.querySelectorAll('mark')).map((mark) => mark.textContent)).toEqual([
      'session',
    ]);
  });

  it('marks accents, capitals and every appearance, and keeps ñ different from n', async () => {
    await renderSearch({
      path: `/search?q=${encodeURIComponent('configuracion')}`,
      elements: [
        screenElement(1, 'Ajustes', {
          template: ['Configuración y CONFIGURACIÓN, la configuracion final.'],
        }),
      ],
    });
    const item = await firstItem();
    expect(Array.from(item.querySelectorAll('mark')).map((mark) => mark.textContent)).toEqual([
      'Configuración',
      'CONFIGURACIÓN',
      'configuracion',
    ]);
  });

  it('marks a text with characters of a pattern and a snippet cut with "…"', async () => {
    const long = `${'x'.repeat(400)} (50%) a_b ${'y'.repeat(400)}`;
    await renderSearch({
      path: `/search?q=${encodeURIComponent('(50%) a_b')}`,
      elements: [screenElement(1, 'Ajustes', { template: [long] })],
    });
    const item = await firstItem();
    const marks = Array.from(item.querySelectorAll('mark')).map((mark) => mark.textContent);
    expect(marks).toEqual(['(50%) a_b']);
    const snippet = item.querySelector('mark')!.parentElement!.textContent;
    expect(snippet.length).toBeLessThanOrEqual(300);
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('shows the screen of a component and the monospace of a formula', async () => {
    await renderSearch({
      path: '/search?q=filter',
      elements: [
        componentElement(31, 'btnSave', {
          onSelect: 'Set(x, Filter(colClients, Active = true))',
          screen: { id: 12, name: 'scrHome' },
        }),
      ],
    });
    const item = await firstItem();
    expect(within(item).getByText('Matched in OnSelect · in scrHome')).toBeInTheDocument();
    expect(item.querySelector('mark')!.parentElement).toHaveClass('font-mono');
  });

  it('shows the text of a link of a variable as "Used in"', async () => {
    await renderSearch({
      path: '/search?q=onselect',
      elements: [
        variableElement(7, 'gUsuario', { usedIn: ['galClientes.OnSelect'] }),
        collectionElement(21, 'colClientes', { usedIn: ['btnX.OnSelect'] }),
      ],
    });
    await screen.findByRole('list', { name: 'Search results' });
    expect(screen.getAllByText('Matched in Used in')).toHaveLength(2);
  });
});

describe('filters only (S-29b)', () => {
  it('searches without text, shows no "Matched in" and no snippet, and says how many there are', async () => {
    const { api } = await renderSearch({ path: '/search?scope=CONTEXT' });
    await screen.findByRole('list', { name: 'Search results' });
    expect(api.listCalls()[0]?.query).not.toHaveProperty('q');
    expect(screen.queryByText(/^Matched in/)).not.toBeInTheDocument();
    expect(document.querySelectorAll('mark')).toHaveLength(0);
    expect(screen.getByRole('region', { name: '5 results' })).toBeInTheDocument();
    expect(screen.getByText('Sorted by name.')).toBeInTheDocument();
  });

  it('applies scope only to variables: the other types stay in the results', async () => {
    await renderSearch({ path: '/search?scope=CONTEXT' });
    await screen.findByRole('list', { name: 'Search results' });
    expect(resultNames()).toEqual([
      'colClientes',
      'galClientes',
      'Inicio',
      'locMostrarDetalle',
      'locOrden',
    ]);
  });

  it('applies environment only to variables and collections', async () => {
    await renderSearch({
      path: '/search?environment=PROD',
      elements: [
        screenElement(1, 'Inicio'),
        componentElement(2, 'btnA'),
        variableElement(3, 'gDevOnly', { environments: ['DEV'] }),
        variableElement(4, 'gBoth', { environments: ['DEV', 'PROD'] }),
        collectionElement(5, 'colDevOnly', { environments: ['DEV'] }),
        collectionElement(6, 'colProd', { environments: ['PROD'] }),
      ],
    });
    await screen.findByRole('list', { name: 'Search results' });
    expect(resultNames()).toEqual(['btnA', 'colProd', 'gBoth', 'Inicio']);
  });

  it('applies the status only to screens', async () => {
    await renderSearch({
      path: '/search?status=APPROVED',
      elements: [
        screenElement(1, 'Approved screen', { status: 'APPROVED' }),
        screenElement(2, 'Draft screen', { status: 'DRAFT' }),
        variableElement(3, 'gVar'),
        collectionElement(4, 'colX'),
        componentElement(5, 'btnA'),
      ],
    });
    await screen.findByRole('list', { name: 'Search results' });
    expect(resultNames()).toEqual(['Approved screen', 'btnA', 'colX', 'gVar']);
  });

  it('says which types each filter applies to and does not present them as excluding the others', async () => {
    await renderSearch({ path: '/search?q=client' });
    const form = screen.getByRole('search', { name: 'Advanced search' });
    expect(within(form).getByLabelText('Environment')).toHaveAccessibleDescription(
      'Applies to variables and collections; other types stay in the results.',
    );
    expect(within(form).getByLabelText('Status')).toHaveAccessibleDescription(
      'Applies to screens; other types stay in the results.',
    );
    expect(within(form).getByLabelText('Scope')).toHaveAccessibleDescription(
      'Applies to variables; other types stay in the results.',
    );
  });

  it('writes the chosen filters in the URL and clears them all with "Clear all"', async () => {
    const user = setupUser();
    const { router } = await renderSearch({ path: '/search?q=client' });
    await user.selectOptions(screen.getByLabelText('Environment'), 'DEV');
    await user.selectOptions(screen.getByLabelText('Status'), 'APPROVED');
    await user.selectOptions(screen.getByLabelText('Scope'), 'CONTEXT');
    expect(router.state.location.search).toBe(
      '?q=client&environment=DEV&status=APPROVED&scope=CONTEXT',
    );
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(router.state.location.search).toBe('');
    expect(screen.getByText('Search the documentation')).toBeInTheDocument();
    expect(searchBox()).toHaveValue('');
  });
});

describe('empty, error and application states', () => {
  it('says "No results" and offers "Clear filters" only when filters are set', async () => {
    const user = setupUser();
    const { router } = await renderSearch({ path: '/search?q=zzzz&scope=GLOBAL' });
    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(screen.getByText('No elements match this search.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(router.state.location.search).toBe('?q=zzzz');
    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows the server error inside the block, keeps the form, and retries', async () => {
    const user = setupUser();
    const { api } = await renderSearch({
      path: '/search?q=client',
      prepare: (fake) => {
        fake.failNext(
          'GET /search',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR', requestId: 'req-77' }),
          { when: (call) => call.query.pageSize !== 1 },
        );
      },
    });
    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    expect(screen.getByText('req-77')).toBeInTheDocument();
    expect(screen.getByRole('search', { name: 'Advanced search' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Search results' })).toBeInTheDocument();
    expect(api.listCalls()).toHaveLength(2);
  });

  it('shows "This application doesn\'t exist" for a 404 and goes back to the Dashboard', async () => {
    const user = setupUser();
    const { router } = await renderSearch({
      path: '/search?q=client',
      prepare: (fake) => {
        fake.failNext('GET /search', new ApiError({ status: 404, code: 'NOT_FOUND' }), {
          when: (call) => call.query.pageSize !== 1,
        });
      },
    });
    expect(await screen.findByText("This application doesn't exist")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Dashboard' }));
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('treats the 400 required of the API as the initial state, not as an error', async () => {
    await renderSearch({
      path: '/search?scope=GLOBAL',
      prepare: (fake) => {
        fake.failNext(
          'GET /search',
          new ApiError({
            status: 400,
            code: 'VALIDATION_ERROR',
            details: { fields: [{ field: 'q', rule: 'required', message: 'x' }] },
          }),
          { when: (call) => call.query.pageSize !== 1 },
        );
      },
    });
    expect(await screen.findByText('Search the documentation')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong on our side')).not.toBeInTheDocument();
  });

  it('searches an archived application like any other', async () => {
    const { api } = await renderSearch({
      path: '/search?q=client',
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });
    expect(await screen.findByRole('list', { name: 'Search results' })).toBeInTheDocument();
    expect(api.listCalls()).toHaveLength(1);
  });
});

describe('navigation (FR-18)', () => {
  const elements = sampleElements();

  it.each([
    ['Inicio', '/screens/12', ''],
    ['gRegistroSel', '/variables/7', ''],
    ['colClientes', '/collections/21', ''],
    ['galClientes', '/screens/12', '?tab=components'],
  ])('opens %s at %s%s', async (name, pathname, search) => {
    const user = setupUser();
    const { router } = await renderSearch({ path: '/search?q=client', elements });
    await user.click(await screen.findByRole('link', { name }));
    expect(router.state.location.pathname).toBe(pathname);
    expect(router.state.location.search).toBe(search);
  });

  it('opens a component in the screen of the result, not in a page of its own', async () => {
    await renderSearch({
      path: '/search?q=btn',
      elements: [componentElement(31, 'btnSave', { screen: { id: 55, name: 'scrHome' } })],
    });
    expect(await screen.findByRole('link', { name: 'btnSave' })).toHaveAttribute(
      'href',
      '/screens/55?tab=components',
    );
  });
});
