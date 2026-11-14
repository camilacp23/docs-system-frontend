// useGraphParams (parse): the filters and the focus come from the URL; a value that is missing, the default or not valid
// is dropped, so a bad link opens the full map instead of failing.
import { describe, expect, it } from 'vitest';

import { NODE_TYPES } from '../../modules/dependency-map/graphTypes';
import { parseFocus, parseGraphParams } from '../../modules/dependency-map/useGraphParams';

const parse = (query: string) => parseGraphParams(new URLSearchParams(query));

describe('parseGraphParams', () => {
  it('defaults to the full map', () => {
    expect(parse('')).toEqual({
      types: NODE_TYPES,
      environment: '',
      untraced: false,
      focus: null,
      depth: 1,
    });
  });

  it('reads the types in the order of the contract, whatever the order in the URL', () => {
    expect(parse('types=COMPONENT,SCREEN').types).toEqual(['SCREEN', 'COMPONENT']);
  });

  it('drops a types value with nothing valid in it', () => {
    expect(parse('types=NOPE').types).toEqual(NODE_TYPES);
    expect(parse('types=').types).toEqual(NODE_TYPES);
  });

  it('accepts only the environments of the contract', () => {
    expect(parse('environment=PROD').environment).toBe('PROD');
    expect(parse('environment=QA').environment).toBe('');
  });

  it('reads untraced only for 1', () => {
    expect(parse('untraced=1').untraced).toBe(true);
    expect(parse('untraced=true').untraced).toBe(false);
  });

  it('reads a focus as a node key and a depth from 1 to 3', () => {
    expect(parse('focus=variable:7&depth=2')).toMatchObject({
      focus: { type: 'VARIABLE', id: 7, key: 'variable:7' },
      depth: 2,
    });
    expect(parse('focus=collection:21').depth).toBe(1);
    expect(parse('depth=4').depth).toBe(1);
    expect(parse('depth=0').depth).toBe(1);
  });
});

describe('parseFocus', () => {
  it.each([
    ['screen:12', 'SCREEN', 12],
    ['component:31', 'COMPONENT', 31],
  ])('accepts %s', (value, type, id) => {
    expect(parseFocus(value)).toEqual({ type, id, key: value });
  });

  it.each([
    'variable:0',
    'variable:-1',
    'variable:abc',
    'variable:2147483648',
    'variables:7',
    'VARIABLE:7',
    'variable',
    '',
  ])('rejects %s', (value) => {
    expect(parseFocus(value)).toBeNull();
  });

  it('rejects a missing value', () => {
    expect(parseFocus(null)).toBeNull();
  });
});
