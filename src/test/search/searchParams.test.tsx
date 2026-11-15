// The URL of the search: what is read from it, what is written, and that ANY change of the text, the types or a
// filter goes back to page 1.
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  normalizeTypes,
  parseSearchListParams,
  useSearchListParams,
} from '../../modules/search/useSearchListParams';

function setup(initial: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/search${initial}`]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      const hook = useSearchListParams();
      const location = useLocation();
      return { ...hook, search: location.search };
    },
    { wrapper },
  );
}

describe('parseSearchListParams', () => {
  it('reads every parameter and trims the text', () => {
    const params = parseSearchListParams(
      new URLSearchParams(
        'q=%20client%20&types=COMPONENT,VARIABLE&environment=PROD&status=IN_REVIEW&scope=CONTEXT&page=2&pageSize=50',
      ),
    );
    expect(params).toEqual({
      q: 'client',
      types: ['VARIABLE', 'COMPONENT'],
      environment: 'PROD',
      status: 'IN_REVIEW',
      scope: 'CONTEXT',
      page: 2,
      pageSize: 50,
    });
  });

  it('drops what is not valid and falls back to the defaults', () => {
    const params = parseSearchListParams(
      new URLSearchParams(
        'types=NOPE,SCREEN,SCREEN&environment=QA&status=x&scope=y&page=0&pageSize=7',
      ),
    );
    expect(params).toEqual({
      q: '',
      types: ['SCREEN'],
      environment: '',
      status: '',
      scope: '',
      page: 1,
      pageSize: 20,
    });
  });

  it('keeps a text of more than 100 characters, so the field can show its error', () => {
    const long = 'x'.repeat(150);
    expect(parseSearchListParams(new URLSearchParams(`q=${long}`)).q).toBe(long);
  });

  it('treats all four types as none', () => {
    expect(normalizeTypes(['SCREEN', 'VARIABLE', 'COLLECTION', 'COMPONENT'])).toEqual([]);
    expect(normalizeTypes(['COMPONENT', 'SCREEN'])).toEqual(['SCREEN', 'COMPONENT']);
  });
});

describe('setParams', () => {
  it('goes back to page 1 when the text changes', () => {
    const { result } = setup('?q=client&page=3');
    act(() => {
      result.current.setParams({ q: 'variable' });
    });
    expect(result.current.search).toBe('?q=variable');
    expect(result.current.params.page).toBe(1);
  });

  it('goes back to page 1 when the types change', () => {
    const { result } = setup('?q=client&page=3');
    act(() => {
      result.current.setParams({ types: ['VARIABLE'] });
    });
    expect(result.current.search).toBe('?q=client&types=VARIABLE');
  });

  it.each([
    ['environment', { environment: 'DEV' as const }, 'environment=DEV'],
    ['status', { status: 'DRAFT' as const }, 'status=DRAFT'],
    ['scope', { scope: 'GLOBAL' as const }, 'scope=GLOBAL'],
    ['page size', { pageSize: 50 }, 'pageSize=50'],
  ])('goes back to page 1 when the %s changes', (_name, patch, written) => {
    const { result } = setup('?q=client&page=3');
    act(() => {
      result.current.setParams(patch);
    });
    expect(result.current.search).toBe(`?q=client&${written}`);
    expect(result.current.params.page).toBe(1);
  });

  it('keeps the page only when the change names it', () => {
    const { result } = setup('?q=client&page=2');
    act(() => {
      result.current.setParams({ page: 3 });
    });
    expect(result.current.search).toBe('?q=client&page=3');
  });

  it('removes a parameter that goes back to its default and keeps unknown parameters', () => {
    const { result } = setup('?q=client&environment=DEV&keep=1');
    act(() => {
      result.current.setParams({ environment: '' });
    });
    expect(result.current.search).toBe('?q=client&keep=1');
  });

  it('clears the filters and the types but keeps the text, and clears everything on "all"', () => {
    const { result } = setup('?q=client&types=SCREEN&environment=DEV&scope=GLOBAL&page=2');
    act(() => {
      result.current.clearFilters();
    });
    expect(result.current.search).toBe('?q=client');
    expect(result.current.hasFilters).toBe(false);
    expect(result.current.hasAnything).toBe(true);
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.search).toBe('');
    expect(result.current.hasAnything).toBe(false);
  });
});
