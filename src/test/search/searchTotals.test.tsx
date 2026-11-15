// The chips of the types (their totals, the selection) and the pagination: what is asked of the API each time, and
// that any change of the text, the types or a filter goes back to page 1.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import {
  collectionElement,
  componentElement,
  screenElement,
  variableElement,
  type SimElement,
} from '../helpers/fakeSearchApi';
import { renderSearch } from '../helpers/renderSearch';
import { setupUser } from '../helpers/setupUser';

/** 32 elements that all match "item": 3 screens, 25 variables, 2 collections and 2 components. */
function manyElements(): SimElement[] {
  return [
    ...Array.from({ length: 3 }, (_unused, index) =>
      screenElement(index + 1, `itemScreen${index + 1}`, {
        status: index === 0 ? 'APPROVED' : 'DRAFT',
      }),
    ),
    ...Array.from({ length: 25 }, (_unused, index) =>
      variableElement(100 + index, `itemVar${String(index + 1).padStart(2, '0')}`, {
        scope: index % 2 === 0 ? 'GLOBAL' : 'CONTEXT',
        environments: index < 5 ? ['PROD'] : ['DEV', 'PROD'],
      }),
    ),
    ...Array.from({ length: 2 }, (_unused, index) =>
      collectionElement(200 + index, `itemCol${index + 1}`),
    ),
    ...Array.from({ length: 2 }, (_unused, index) =>
      componentElement(300 + index, `itemCmp${index + 1}`),
    ),
  ];
}

const chip = (name: string) => screen.getByRole('button', { name });
const names = () =>
  within(screen.getByRole('list', { name: 'Search results' }))
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('totals of the chips', () => {
  it('reads the total of each type with the same text, one type, page 1 and size 1, and sums them in "All"', async () => {
    const { api } = await renderSearch({ path: '/search?q=item', elements: manyElements() });
    await screen.findByRole('list', { name: 'Search results' });
    expect(await screen.findByRole('button', { name: 'All 32' })).toBeInTheDocument();
    expect(chip('Screens 3')).toBeInTheDocument();
    expect(chip('Variables 25')).toBeInTheDocument();
    expect(chip('Collections 2')).toBeInTheDocument();
    expect(chip('Components 2')).toBeInTheDocument();

    const totals = api.totalCalls();
    expect(totals).toHaveLength(4);
    expect(totals.map((call) => call.query.types).sort()).toEqual([
      ['COLLECTION'],
      ['COMPONENT'],
      ['SCREEN'],
      ['VARIABLE'],
    ]);
    for (const call of totals) {
      expect(call.query).toMatchObject({ applicationId: 1, q: 'item', page: 1, pageSize: 1 });
    }
    // One list and four totals: five requests for one search.
    expect(api.callsTo('GET /search')).toHaveLength(5);
  });

  it('gives each chip the same text and the same filters, with a filter only on the types it applies to', async () => {
    const { api } = await renderSearch({
      path: '/search?q=item&environment=DEV&status=APPROVED&scope=CONTEXT',
      elements: manyElements(),
    });
    await screen.findByRole('list', { name: 'Search results' });
    for (const call of api.totalCalls()) {
      expect(call.query).toMatchObject({
        q: 'item',
        environment: 'DEV',
        documentationStatus: 'APPROVED',
        scope: 'CONTEXT',
      });
    }
    // Screens: only the approved one. Variables: context ones in DEV. Collections and components: unfiltered.
    expect(await screen.findByRole('button', { name: 'Screens 1' })).toBeInTheDocument();
    expect(chip('Variables 10')).toBeInTheDocument();
    expect(chip('Collections 2')).toBeInTheDocument();
    expect(chip('Components 2')).toBeInTheDocument();
    expect(chip('All 15')).toBeInTheDocument();
  });

  it('keeps the totals of the four types when types are selected: the selection only changes the list', async () => {
    const { api } = await renderSearch({
      path: '/search?q=item&types=VARIABLE',
      elements: manyElements(),
    });
    await screen.findByRole('list', { name: 'Search results' });
    expect(screen.getByRole('region', { name: '25 results for “item”' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'All 32' })).toBeInTheDocument();
    expect(chip('Screens 3')).toBeInTheDocument();
    expect(chip('Variables 25')).toBeInTheDocument();
    expect(chip('Collections 2')).toBeInTheDocument();
    expect(chip('Components 2')).toBeInTheDocument();
    expect(chip('Variables 25')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('All 32')).toHaveAttribute('aria-pressed', 'false');
    for (const call of api.totalCalls()) expect(call.query.types).toHaveLength(1);
    expect(api.listCalls()[0]?.query.types).toEqual(['VARIABLE']);
  });

  it('reads only the list when a type is chosen, because the totals do not depend on the selection', async () => {
    const user = setupUser();
    const { api, router } = await renderSearch({
      path: '/search?q=item',
      elements: manyElements(),
    });
    await screen.findByRole('button', { name: 'All 32' });
    const totalsBefore = api.totalCalls().length;
    await user.click(chip('Screens 3'));
    await user.click(chip('Components 2'));
    // The URL writes the comma as %2C (URLSearchParams); the request to the API carries it literally (encodeQuery).
    expect(router.state.location.search).toBe('?q=item&types=SCREEN%2CCOMPONENT');
    expect(api.listCalls().at(-1)?.query.types).toEqual(['SCREEN', 'COMPONENT']);
    expect(await screen.findByRole('region', { name: '5 results for “item”' })).toBeInTheDocument();
    expect(names()).toEqual(['itemCmp1', 'itemCmp2', 'itemScreen1', 'itemScreen2', 'itemScreen3']);
    expect(api.totalCalls()).toHaveLength(totalsBefore);
    expect(chip('All 32')).toBeInTheDocument();
    // "All" brings every type back.
    await user.click(chip('All 32'));
    expect(router.state.location.search).toBe('?q=item');
    expect(
      await screen.findByRole('region', { name: '32 results for “item”' }),
    ).toBeInTheDocument();
    expect(api.totalCalls()).toHaveLength(totalsBefore);
  });

  it('turns the chip off by choosing it again, and ends in "All" when the four are chosen', async () => {
    const user = setupUser();
    const { router } = await renderSearch({ path: '/search?q=item', elements: manyElements() });
    await screen.findByRole('button', { name: 'All 32' });
    await user.click(chip('Screens 3'));
    await user.click(chip('Screens 3'));
    expect(router.state.location.search).toBe('?q=item');
    for (const name of ['Screens 3', 'Variables 25', 'Collections 2', 'Components 2']) {
      await user.click(chip(name));
    }
    expect(router.state.location.search).toBe('?q=item');
    expect(chip('All 32')).toHaveAttribute('aria-pressed', 'true');
  });

  it('reads the totals again when the text or a filter changes', async () => {
    const user = setupUser();
    const { api } = await renderSearch({ path: '/search?q=item', elements: manyElements() });
    await screen.findByRole('button', { name: 'All 32' });
    await user.selectOptions(screen.getByLabelText('Scope'), 'CONTEXT');
    expect(await screen.findByRole('button', { name: 'Variables 12' })).toBeInTheDocument();
    expect(api.totalCalls()).toHaveLength(8);
  });

  it('shows "—" in a chip whose total could not be read, and the rest still works', async () => {
    await renderSearch({
      path: '/search?q=item',
      elements: manyElements(),
      prepare: (fake) => {
        fake.failNext('GET /search', new ApiError({ status: 500, code: 'INTERNAL_ERROR' }), {
          when: (call) => Array.isArray(call.query.types) && call.query.types[0] === 'COLLECTION',
        });
      },
    });
    await screen.findByRole('list', { name: 'Search results' });
    expect(await screen.findByRole('button', { name: 'Collections —' })).toBeInTheDocument();
    expect(chip('Screens 3')).toBeInTheDocument();
    expect(chip('All —')).toBeInTheDocument();
  });
});

describe('pagination', () => {
  it('shows the page of the API with its range and moves through the pages in the URL', async () => {
    const user = setupUser();
    const { api, router } = await renderSearch({
      path: '/search?q=item',
      elements: manyElements(),
    });
    await screen.findByRole('list', { name: 'Search results' });
    expect(names()).toHaveLength(20);
    expect(screen.getByText('Showing 1–20 of 32')).toBeInTheDocument();
    const totalsBefore = api.totalCalls().length;

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(router.state.location.search).toBe('?q=item&page=2');
    expect(await screen.findByText('Showing 21–32 of 32')).toBeInTheDocument();
    expect(names()).toHaveLength(12);
    expect(api.listCalls().map((call) => call.query.page)).toEqual([1, 2]);
    // A new page reads the list only.
    expect(api.totalCalls()).toHaveLength(totalsBefore);

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(router.state.location.search).toBe('?q=item');
  });

  it('opens a page of the URL directly and keeps the order of the API across pages', async () => {
    await renderSearch({ path: '/search?q=item&page=2', elements: manyElements() });
    await screen.findByRole('list', { name: 'Search results' });
    expect(screen.getByText('Showing 21–32 of 32')).toBeInTheDocument();
    // Normalized name order: itemCmp, itemCol, itemScreen and itemVar, so the last page holds the last variables.
    expect(names().at(-1)).toBe('itemVar25');
  });

  it('changes the page size and goes back to page 1', async () => {
    const user = setupUser();
    const { router } = await renderSearch({
      path: '/search?q=item&page=2',
      elements: manyElements(),
    });
    await screen.findByRole('list', { name: 'Search results' });
    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');
    expect(router.state.location.search).toBe('?q=item&pageSize=50');
    expect(await screen.findByText('Showing 1–32 of 32')).toBeInTheDocument();
  });

  it('goes to the last page there is when the URL asks for one past the end', async () => {
    const { router } = await renderSearch({
      path: '/search?q=item&page=9',
      elements: manyElements(),
    });
    expect(await screen.findByText('Showing 21–32 of 32')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?q=item&page=2');
  });

  it.each([
    [
      'the text changes',
      async (user: ReturnType<typeof setupUser>) => {
        await user.clear(screen.getByRole('searchbox', { name: 'Search text' }));
        await user.click(screen.getByRole('searchbox', { name: 'Search text' }));
        await user.paste('itemV');
        await user.keyboard('{Enter}');
      },
      '?q=itemV',
    ],
    [
      'a type is chosen',
      async (user: ReturnType<typeof setupUser>) => {
        await user.click(chip('Variables 25'));
      },
      '?q=item&types=VARIABLE',
    ],
    [
      'the environment changes',
      async (user: ReturnType<typeof setupUser>) => {
        await user.selectOptions(screen.getByLabelText('Environment'), 'DEV');
      },
      '?q=item&environment=DEV',
    ],
    [
      'the status changes',
      async (user: ReturnType<typeof setupUser>) => {
        await user.selectOptions(screen.getByLabelText('Status'), 'DRAFT');
      },
      '?q=item&status=DRAFT',
    ],
    [
      'the scope changes',
      async (user: ReturnType<typeof setupUser>) => {
        await user.selectOptions(screen.getByLabelText('Scope'), 'GLOBAL');
      },
      '?q=item&scope=GLOBAL',
    ],
  ])('goes back to page 1 when %s', async (_name, change, expected) => {
    const user = setupUser();
    const { router, api } = await renderSearch({
      path: '/search?q=item&page=2',
      elements: manyElements(),
    });
    await screen.findByText('Showing 21–32 of 32');
    await change(user);
    expect(router.state.location.search).toBe(expected);
    await screen.findByRole('list', { name: 'Search results' });
    expect(api.listCalls().at(-1)?.query.page).toBe(1);
  });
});
