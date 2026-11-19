// The search for the three roles, its accessibility (a search landmark, labels, a list, a live region with the number
// of results) and the timing of its states (skeleton after 300 ms, "taking longer than usual" after 10 s).
import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeApplication } from '../helpers/renderApp';
import { variableElement } from '../helpers/fakeSearchApi';
import { renderSearch } from '../helpers/renderSearch';
import { settle, setupUser } from '../helpers/setupUser';

afterEach(() => {
  vi.useRealTimers();
});

describe('roles', () => {
  it.each(['ADMINISTRATOR', 'DEVELOPER', 'READER'] as const)(
    'lets the %s search and open a result',
    async (role) => {
      const user = setupUser();
      const { router, api } = await renderSearch({ role, path: '/search?q=client' });
      expect(await screen.findByRole('list', { name: 'Search results' })).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: "You don't have access to this page" }),
      ).toBeNull();
      expect(api.listCalls()).toHaveLength(1);
      await user.click(screen.getByRole('link', { name: 'gRegistroSel' }));
      expect(router.state.location.pathname).toBe('/variables/7');
    },
  );
});

describe('accessibility', () => {
  it('has a search landmark with the text box, the chips and the filters, all with a name', async () => {
    await renderSearch({ path: '/search?q=client' });
    await screen.findByRole('list', { name: 'Search results' });
    const form = screen.getByRole('search', { name: 'Advanced search' });
    expect(within(form).getByRole('searchbox', { name: 'Search text' })).toBeInTheDocument();
    expect(within(form).getByRole('group', { name: 'Element types' })).toBeInTheDocument();
    for (const label of ['Environment', 'Status', 'Scope']) {
      expect(within(form).getByRole('combobox', { name: label })).toBeInTheDocument();
    }
    for (const button of within(form).getAllByRole('button')) {
      expect(button).toHaveAccessibleName();
    }
  });

  it('lists the results as a list of items, each with a link named after the element', async () => {
    await renderSearch({ path: '/search?q=client' });
    const list = await screen.findByRole('list', { name: 'Search results' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    for (const item of items) expect(within(item).getByRole('link')).toHaveAccessibleName();
  });

  it('announces the number of results in a polite live region, and nothing before there is a search', async () => {
    const user = setupUser();
    await renderSearch();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await user.click(screen.getByRole('searchbox', { name: 'Search text' }));
    await user.paste('client');
    await user.keyboard('{Enter}');
    await screen.findByRole('list', { name: 'Search results' });
    expect(screen.getByRole('status')).toHaveTextContent('4 results for “client”');
    await user.clear(screen.getByRole('searchbox', { name: 'Search text' }));
    await user.paste('zzzz');
    await user.keyboard('{Enter}');
    await screen.findByText('No results');
    expect(screen.getByRole('status')).toHaveTextContent('0 results for “zzzz”');
  });

  it('says "1 result" in the singular, with no text in the announcement without a search text', async () => {
    await renderSearch({
      path: '/search?scope=CONTEXT',
      elements: [variableElement(1, 'locA', { scope: 'CONTEXT' })],
    });
    await screen.findByRole('list', { name: 'Search results' });
    expect(screen.getByRole('status')).toHaveTextContent('1 result');
    expect(screen.getByRole('status')).not.toHaveTextContent('for');
  });

  it('links the error of the text to the field', async () => {
    await renderSearch({ path: '/search?q=c' });
    const box = screen.getByRole('searchbox', { name: 'Search text' });
    expect(box).toBeInvalid();
    expect(box).toHaveAccessibleDescription(
      'Type at least 2 characters, or search with filters only.',
    );
  });
});

describe('loading', () => {
  it('shows the skeleton only after 300 ms, and "taking longer than usual" after 10 s', async () => {
    let slow!: { release: () => void };
    // The app renders first (that takes real time); the clock of the timers is taken over just before the search
    // starts, so the 300 ms are counted from the moment the page asks.
    const { router } = await renderSearch({
      path: '/dashboard',
      prepare: (fake) => {
        slow = fake.hold((call) => call.query.pageSize !== 1);
      },
    });
    // Only the two timers of the loading states are faked and the clock never moves by itself: the 300 ms and the 10 s
    // are advanced by hand, so how long the machine takes cannot change what the test sees.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => {
      await router.navigate('/search?q=client');
    });
    const rowsOfSkeleton = () =>
      screen.getByRole('region', { name: 'Results' }).querySelectorAll('li').length;
    expect(rowsOfSkeleton()).toBe(0);
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(rowsOfSkeleton()).toBe(0);
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(rowsOfSkeleton()).toBe(4);
    expect(screen.queryByText('This is taking longer than usual.')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(9700);
      await Promise.resolve();
    });
    expect(screen.getByText('This is taking longer than usual.')).toBeInTheDocument();
    await act(async () => {
      slow.release();
      await Promise.resolve();
    });
    await settle();
    expect(screen.getByRole('list', { name: 'Search results' })).toBeInTheDocument();
    expect(screen.queryByText('This is taking longer than usual.')).toBeNull();
  });
});

describe('application', () => {
  it('starts the search over when the application changes in the sidebar', async () => {
    const user = setupUser();
    const { router } = await renderSearch({
      path: '/search?q=client&environment=DEV',
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Other' })],
    });
    await screen.findByRole('list', { name: 'Search results' });
    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(await screen.findByRole('button', { name: 'Other' }));
    expect(router.state.location.search).toBe('');
    expect(screen.getByText('Search the documentation')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search text' })).toHaveValue('');
    expect(
      screen.getByText('Search across screens, variables, collections and components of Other.'),
    ).toBeInTheDocument();
  });
});
