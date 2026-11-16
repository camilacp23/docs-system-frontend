// quickSearchModel: the query of the quick search, the groups (order of the frame S-30, three rows each), where a row
// leads, the note of a row, the route of "See all results" and the shortcut hint of the platform.
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SearchResult } from '../../modules/search/searchTypes';
import {
  groupQuickResults,
  quickQuery,
  quickResultHref,
  quickResultNote,
  searchAllHref,
  shortcutHint,
} from '../../layout/quickSearchModel';

function row(
  type: SearchResult['type'],
  id: number,
  extra: Record<string, unknown> = {},
): SearchResult {
  const base = { id, name: `n${id}`, matchedIn: 'name', snippet: null };
  switch (type) {
    case 'SCREEN':
      return { ...base, type, documentationStatus: 'DRAFT', ...extra } as SearchResult;
    case 'COMPONENT':
      return { ...base, type, screen: { id: 12, name: 'Inicio' }, ...extra } as SearchResult;
    default:
      return { ...base, type, environments: ['DEV'], ...extra } as SearchResult;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('quickQuery', () => {
  it('is one page of 20 with the text and the application, and nothing else', () => {
    expect(quickQuery(3, 'client')).toEqual({
      applicationId: 3,
      q: 'client',
      page: 1,
      pageSize: 20,
    });
  });
});

describe('groupQuickResults', () => {
  it('orders the groups as the frame, keeps the order of the rows and takes three of each', () => {
    const rows = [
      row('VARIABLE', 1),
      row('SCREEN', 2),
      row('VARIABLE', 3),
      row('COMPONENT', 4),
      row('VARIABLE', 5),
      row('VARIABLE', 6),
      row('COLLECTION', 7),
      row('SCREEN', 8),
    ];
    const groups = groupQuickResults(rows);
    expect(groups.map((group) => group.type)).toEqual([
      'SCREEN',
      'COLLECTION',
      'COMPONENT',
      'VARIABLE',
    ]);
    expect(groups.map((group) => group.rows.map((r) => r.id))).toEqual([
      [2, 8],
      [7],
      [4],
      [1, 3, 5],
    ]);
  });

  it('leaves out the groups without rows and gives nothing for no rows', () => {
    expect(groupQuickResults([row('COLLECTION', 1)]).map((group) => group.type)).toEqual([
      'COLLECTION',
    ]);
    expect(groupQuickResults([])).toEqual([]);
  });
});

describe('where a row leads and its note', () => {
  it('leads each type to its page; a component to the Components & navigation tab of its screen', () => {
    expect(quickResultHref(row('SCREEN', 5))).toBe('/screens/5');
    expect(quickResultHref(row('VARIABLE', 6))).toBe('/variables/6');
    expect(quickResultHref(row('COLLECTION', 7))).toBe('/collections/7');
    expect(quickResultHref(row('COMPONENT', 8))).toBe('/screens/12?tab=components');
  });

  it('notes the screen of a component and the place of a match that is not the name', () => {
    expect(quickResultNote(row('SCREEN', 1))).toBeNull();
    expect(quickResultNote(row('COMPONENT', 1))).toBe('Inicio');
    expect(quickResultNote(row('VARIABLE', 1))).toBeNull();
    expect(quickResultNote(row('VARIABLE', 1, { matchedIn: 'description' }))).toBe(
      'matched in description',
    );
    expect(quickResultNote(row('COLLECTION', 1, { matchedIn: 'creationCondition' }))).toBe(
      'matched in creation condition',
    );
    expect(quickResultNote(row('VARIABLE', 1, { matchedIn: 'somethingNew' }))).toBe(
      'matched in somethingnew',
    );
  });
});

describe('searchAllHref', () => {
  it('writes the text as the contract does: encoded, no "+" for a space', () => {
    expect(searchAllHref('client')).toBe('/search?q=client');
    expect(searchAllHref('a b&c=d')).toBe('/search?q=a%20b%26c%3Dd');
    expect(searchAllHref('ñandú')).toBe('/search?q=%C3%B1and%C3%BA');
  });
});

describe('shortcutHint', () => {
  it('says Cmd on Apple platforms and Ctrl elsewhere', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)' });
    expect(shortcutHint()).toBe('⌘ K');
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
    expect(shortcutHint()).toBe('Ctrl K');
  });
});
