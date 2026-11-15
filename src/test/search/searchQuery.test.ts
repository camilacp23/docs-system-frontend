// What the search may ask the API: the trimmed text and its limits, the states, and the queries of the list and of
// the total of each type.
import { describe, expect, it } from 'vitest';

import {
  listQuery,
  searchState,
  totalQuery,
  validateSearchText,
} from '../../modules/search/searchQuery';
import {
  parseSearchListParams,
  type SearchListParams,
} from '../../modules/search/useSearchListParams';

function paramsOf(query: string): SearchListParams {
  return parseSearchListParams(new URLSearchParams(query));
}

describe('validateSearchText', () => {
  it('measures the trimmed text: 2 to 100 characters', () => {
    expect(validateSearchText('')).toBeNull();
    expect(validateSearchText('   ')).toBeNull();
    expect(validateSearchText('a')).toBe('tooShort');
    expect(validateSearchText('  a  ')).toBe('tooShort');
    expect(validateSearchText('ab')).toBeNull();
    expect(validateSearchText('  ab  ')).toBeNull();
    expect(validateSearchText('x'.repeat(100))).toBeNull();
    expect(validateSearchText(`  ${'x'.repeat(100)}  `)).toBeNull();
    expect(validateSearchText('x'.repeat(101))).toBe('tooLong');
    expect(validateSearchText(`  ${'x'.repeat(101)}  `)).toBe('tooLong');
  });

  it('counts characters, not UTF-16 units, as the validator does', () => {
    expect(validateSearchText('😀')).toBe('tooShort');
    expect(validateSearchText('😀😀')).toBeNull();
    expect(validateSearchText('😀'.repeat(100))).toBeNull();
    expect(validateSearchText('😀'.repeat(101))).toBe('tooLong');
  });
});

describe('searchState', () => {
  it('is initial without text and without a filter', () => {
    expect(searchState(paramsOf(''))).toBe('initial');
    expect(searchState(paramsOf('page=3&pageSize=50'))).toBe('initial');
    expect(searchState(paramsOf('q=%20%20'))).toBe('initial');
  });

  it('is ready with a valid text or with any one filter', () => {
    expect(searchState(paramsOf('q=client'))).toBe('ready');
    expect(searchState(paramsOf('types=VARIABLE'))).toBe('ready');
    expect(searchState(paramsOf('environment=DEV'))).toBe('ready');
    expect(searchState(paramsOf('status=DRAFT'))).toBe('ready');
    expect(searchState(paramsOf('scope=CONTEXT'))).toBe('ready');
  });

  it('is invalid with a text that is too short or too long, also with filters: nothing is sent', () => {
    expect(searchState(paramsOf('q=c'))).toBe('invalid');
    expect(searchState(paramsOf('q=c&environment=DEV&types=VARIABLE'))).toBe('invalid');
    expect(searchState(paramsOf(`q=${'x'.repeat(101)}`))).toBe('invalid');
  });
});

describe('listQuery and totalQuery', () => {
  const params = paramsOf(
    'q=%20client%20&types=COMPONENT,SCREEN&environment=DEV&status=APPROVED&scope=GLOBAL&page=3&pageSize=50',
  );

  it('sends the trimmed text, the selected types, the three filters, the page and the size', () => {
    expect(listQuery(1, params)).toEqual({
      applicationId: 1,
      q: 'client',
      types: ['SCREEN', 'COMPONENT'],
      environment: 'DEV',
      documentationStatus: 'APPROVED',
      scope: 'GLOBAL',
      page: 3,
      pageSize: 50,
    });
  });

  it('leaves out what is not set: no text, no types, no filters', () => {
    expect(listQuery(7, paramsOf('environment=PROD'))).toEqual({
      applicationId: 7,
      environment: 'PROD',
      page: 1,
      pageSize: 20,
    });
  });

  it('asks the total of one type with the same text and filters, without the selection and on page 1', () => {
    expect(totalQuery(1, params, 'VARIABLE')).toEqual({
      applicationId: 1,
      q: 'client',
      environment: 'DEV',
      documentationStatus: 'APPROVED',
      scope: 'GLOBAL',
      types: ['VARIABLE'],
      page: 1,
      pageSize: 1,
    });
  });

  it('gives the same total query whatever the selection of types, the page or the size', () => {
    const a = paramsOf('q=client&types=SCREEN&page=4&pageSize=100');
    const b = paramsOf('q=client');
    for (const type of ['SCREEN', 'VARIABLE', 'COLLECTION', 'COMPONENT'] as const) {
      expect(totalQuery(1, a, type)).toEqual(totalQuery(1, b, type));
    }
  });
});
