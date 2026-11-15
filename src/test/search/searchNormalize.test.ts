// The comparison of the search (D-110 a) reproduced in the browser: the cases the API tests check.
import { describe, expect, it } from 'vitest';

import {
  findMatches,
  normalizeSearchText,
  SEARCH_NORMALIZATION_PAIRS,
  splitByMatches,
} from '../../modules/search/searchNormalize';

const matchedTexts = (text: string, query: string) =>
  findMatches(text, query).map(([start, end]) => text.slice(start, end));

describe('normalizeSearchText', () => {
  it('compares Configuración, configuracion and CONFIGURACIÓN as the same text', () => {
    const forms = ['Configuración', 'configuracion', 'CONFIGURACIÓN', 'ConfiguraciÓn'];
    expect(new Set(forms.map(normalizeSearchText))).toEqual(new Set(['configuracion']));
  });

  it('turns every accented vowel and ü, in both capitalizations, into its vowel', () => {
    expect(normalizeSearchText('áéíóúü ÁÉÍÓÚÜ')).toBe('aeiouu aeiouu');
  });

  it('keeps ñ different from n, in both capitalizations', () => {
    expect(normalizeSearchText('Ñandú NANDU')).toBe('ñandu nandu');
    expect(normalizeSearchText('ñ')).not.toBe(normalizeSearchText('n'));
    expect(normalizeSearchText('Ñ')).toBe('ñ');
  });

  it('leaves the characters outside the map as they are', () => {
    expect(normalizeSearchText('Ç Σ à è ǘ')).toBe('Ç Σ à è ǘ');
    expect(normalizeSearchText('%_()[]{}.*+?\\|^$-')).toBe('%_()[]{}.*+?\\|^$-');
  });

  it('does not depend on the locale of the runtime', () => {
    // With a Turkish locale toLowerCase would turn I into ı; the fixed map never does.
    expect(normalizeSearchText('I')).toBe('i');
    expect('I'.toLocaleLowerCase('tr')).not.toBe('i');
  });

  it('keeps the length of the text, with surrogate pairs and decomposed accents included', () => {
    const texts = ['Configuración', 'Ñandú 😀 ÁÉÍ', 'á', '\r\nFoo\r\n'];
    for (const text of texts) expect(normalizeSearchText(text)).toHaveLength(text.length);
  });

  it('has one pair per character: the list is the only source', () => {
    const keys = SEARCH_NORMALIZATION_PAIRS.map(([from]) => from);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(26 + 1 + 12);
    for (const [from, to] of SEARCH_NORMALIZATION_PAIRS) {
      expect(from).toHaveLength(1);
      expect(to).toHaveLength(1);
    }
  });
});

describe('findMatches', () => {
  it('finds a text whatever its capitalization and accents', () => {
    expect(matchedTexts('Configuración de la CONFIGURACIÓN', 'configuracion')).toEqual([
      'Configuración',
      'CONFIGURACIÓN',
    ]);
    expect(matchedTexts('configuracion', 'CONFIGURACIÓN')).toEqual(['configuracion']);
  });

  it('does not find n where there is ñ, nor ñ where there is n', () => {
    expect(matchedTexts('El año y el ano', 'ano')).toEqual(['ano']);
    expect(matchedTexts('El año y el ano', 'año')).toEqual(['año']);
    expect(findMatches('ano', 'AÑO')).toEqual([]);
  });

  it('finds every appearance, left to right, without overlapping', () => {
    expect(findMatches('cliente Cliente CLIENTE', 'client')).toEqual([
      [0, 6],
      [8, 14],
      [16, 22],
    ]);
    expect(findMatches('aaaaa', 'aa')).toEqual([
      [0, 2],
      [2, 4],
    ]);
  });

  it('takes % and _ as ordinary characters', () => {
    expect(matchedTexts('Descuento del 50% y 100%', '%')).toEqual(['%', '%']);
    expect(matchedTexts('a_b a-b aXb', 'a_b')).toEqual(['a_b']);
    expect(matchedTexts('50% off', '0% o')).toEqual(['0% o']);
  });

  it('takes the characters of a pattern literally', () => {
    expect(matchedTexts('Filter(colClientes, a.b) and [x]', '(colclientes')).toEqual([
      '(colClientes',
    ]);
    expect(matchedTexts('f(x) f(y) f.x', 'f(x)')).toEqual(['f(x)']);
    expect(matchedTexts('a.b axb', 'a.b')).toEqual(['a.b']);
    expect(matchedTexts('a*b ab', 'a*b')).toEqual(['a*b']);
    expect(matchedTexts('[x] x', '[x]')).toEqual(['[x]']);
    expect(matchedTexts('a\\b', 'a\\b')).toEqual(['a\\b']);
    expect(matchedTexts('a|b a b', 'a|b')).toEqual(['a|b']);
  });

  it('keeps the spaces inside the text and ignores the ones around it', () => {
    expect(matchedTexts('Set the user now', '  the user  ')).toEqual(['the user']);
    expect(findMatches('the  user', 'the user')).toEqual([]);
  });

  it('finds nothing for an empty or blank text', () => {
    expect(findMatches('anything', '')).toEqual([]);
    expect(findMatches('anything', '   ')).toEqual([]);
  });

  it('returns positions of the original text, also after an accent and after an emoji', () => {
    const text = '😀 Configuración';
    const [range] = findMatches(text, 'configuracion');
    expect(range).toBeDefined();
    expect(text.slice(range?.[0], range?.[1])).toBe('Configuración');
  });
});

describe('splitByMatches', () => {
  it('cuts the text in consecutive segments that together are the whole text', () => {
    const text = '…the user picks a client in galClientes and opens Detalle…';
    const segments = splitByMatches(text, 'CLIENT');
    expect(segments.map((segment) => segment.text).join('')).toBe(text);
    expect(segments.filter((segment) => segment.matched).map((segment) => segment.text)).toEqual([
      'client',
      'Client',
    ]);
    expect(segments[0]).toEqual({ text: '…the user picks a ', matched: false });
  });

  it('gives one unmatched segment when nothing matches', () => {
    expect(splitByMatches('no match here', 'zzz')).toEqual([
      { text: 'no match here', matched: false },
    ]);
    expect(splitByMatches('', 'zzz')).toEqual([{ text: '', matched: false }]);
  });

  it('starts and ends with a match without empty segments around it', () => {
    expect(splitByMatches('abab', 'ab')).toEqual([
      { text: 'ab', matched: true },
      { text: 'ab', matched: true },
    ]);
  });
});
