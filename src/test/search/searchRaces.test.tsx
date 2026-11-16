// Answers that arrive out of order: the search of the moment wins, an old request is cancelled, and a late answer
// never replaces the current one (neither in the list nor in the totals of the chips).
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { variableElement } from '../helpers/fakeSearchApi';
import { renderSearch } from '../helpers/renderSearch';
import { setupUser, settle } from '../helpers/setupUser';

const searchBox = () => screen.getByRole('searchbox', { name: 'Search text' });
const names = () =>
  within(screen.getByRole('list', { name: 'Search results' }))
    .getAllByRole('link')
    .map((link) => link.textContent);

async function search(user: ReturnType<typeof setupUser>, text: string) {
  await user.clear(searchBox());
  await user.click(searchBox());
  await user.paste(text);
  await user.keyboard('{Enter}');
}

async function release(...holds: Array<{ release: () => void }>) {
  await act(async () => {
    for (const hold of holds) hold.release();
    await Promise.resolve();
  });
  await settle();
}

const ELEMENTS = [
  variableElement(1, 'abOnly'),
  variableElement(2, 'abcThing'),
  variableElement(3, 'abAndMore'),
];

describe('answers out of order', () => {
  it('keeps the current search when the answer of the old one arrives last', async () => {
    const user = setupUser();
    let slowAb!: { release: () => void };
    const { api } = await renderSearch({
      elements: ELEMENTS,
      prepare: (fake) => {
        slowAb = fake.hold((call) => call.query.q === 'ab');
      },
    });
    await search(user, 'ab');
    await search(user, 'abc');
    expect(await screen.findByRole('region', { name: '1 result for “abc”' })).toBeInTheDocument();
    expect(names()).toEqual(['abcThing']);

    // The answer of "ab" (list and totals) arrives after the one of "abc".
    await release(slowAb);
    expect(screen.getByRole('region', { name: '1 result for “abc”' })).toBeInTheDocument();
    expect(names()).toEqual(['abcThing']);
    expect(screen.getByRole('button', { name: 'Variables 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All 1' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 result for “abc”');
    expect(api.listCalls().map((call) => call.query.q)).toEqual(['ab', 'abc']);
  });

  it('cancels the request of the old search when a new one starts', async () => {
    const user = setupUser();
    const { api } = await renderSearch({
      elements: ELEMENTS,
      prepare: (fake) => {
        fake.hold((call) => call.query.q === 'ab');
      },
    });
    await search(user, 'ab');
    const [first] = api.listCalls();
    expect(first?.signal?.aborted).toBe(false);
    await search(user, 'abc');
    expect(first?.signal?.aborted).toBe(true);
    // The totals of the old search are cancelled too.
    const oldTotals = api.totalCalls().filter((call) => call.query.q === 'ab');
    expect(oldTotals.length).toBeGreaterThan(0);
    for (const call of oldTotals) expect(call.signal?.aborted).toBe(true);
    const currentTotals = api.totalCalls().filter((call) => call.query.q === 'abc');
    for (const call of currentTotals) expect(call.signal?.aborted).toBe(false);
  });

  it('shows the answer of the last search when both answers arrive in reverse order', async () => {
    const user = setupUser();
    let slowAb!: { release: () => void };
    let slowAbc!: { release: () => void };
    await renderSearch({
      elements: ELEMENTS,
      prepare: (fake) => {
        slowAb = fake.hold((call) => call.query.q === 'ab');
        slowAbc = fake.hold((call) => call.query.q === 'abc');
      },
    });
    await search(user, 'ab');
    await search(user, 'abc');
    // The newer one answers first, then the older one.
    await release(slowAbc);
    expect(await screen.findByRole('region', { name: '1 result for “abc”' })).toBeInTheDocument();
    await release(slowAb);
    expect(screen.getByRole('region', { name: '1 result for “abc”' })).toBeInTheDocument();
    expect(names()).toEqual(['abcThing']);
  });

  it('keeps the rows of the page on screen, dimmed, with the marks of THEIR text while the new search loads', async () => {
    const user = setupUser();
    let slowAbc!: { release: () => void };
    await renderSearch({
      elements: ELEMENTS,
      prepare: (fake) => {
        slowAbc = fake.hold((call) => call.query.q === 'abc');
      },
    });
    await search(user, 'ab');
    await screen.findByRole('list', { name: 'Search results' });
    await search(user, 'abc');
    const list = screen.getByRole('list', { name: 'Search results' });
    expect(list).toHaveAttribute('aria-busy', 'true');
    expect(within(list).getAllByRole('link')).toHaveLength(3);
    // Nothing is announced while the new page is read, and the marks are the ones of the text of those rows.
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    const marks = Array.from(list.querySelectorAll('mark')).map((mark) => mark.textContent);
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect(mark?.toLowerCase()).toBe('ab');
    await release(slowAbc);
    expect(screen.getByRole('list', { name: 'Search results' })).toHaveAttribute(
      'aria-busy',
      'false',
    );
  });
});
