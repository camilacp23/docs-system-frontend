// encodeQuery and the URL the HTTP layer builds: RFC 3986 for every parameter (the characters ! ' ( ) * that
// encodeURIComponent leaves alone, accents, spaces, ISO dates) and lists as comma-separated values.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { encodeQuery, encodeRfc3986 } from '../../api/encodeQuery';
import { rawRequest } from '../../api/http';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('encodeRfc3986', () => {
  it('leaves only the unreserved characters as they are', () => {
    expect(encodeRfc3986('AZaz09-._~')).toBe('AZaz09-._~');
  });

  it.each([
    ['!', '%21'],
    ["'", '%27'],
    ['(', '%28'],
    [')', '%29'],
    ['*', '%2A'],
  ])('encodes %s, which encodeURIComponent leaves alone', (char, encoded) => {
    expect(encodeURIComponent(char)).toBe(char);
    expect(encodeRfc3986(`a${char}b`)).toBe(`a${encoded}b`);
  });

  it('encodes a space as %20, never as +', () => {
    expect(encodeRfc3986('mi aplicación')).toBe('mi%20aplicaci%C3%B3n');
    expect(encodeRfc3986('a+b')).toBe('a%2Bb');
  });

  it('encodes accents and ñ as UTF-8 bytes', () => {
    expect(encodeRfc3986('Documentación técnica ñandú')).toBe(
      'Documentaci%C3%B3n%20t%C3%A9cnica%20%C3%B1and%C3%BA',
    );
  });

  it('encodes the delimiters of a query string', () => {
    expect(encodeRfc3986('a&b=c#d?e/f,g;h:i@j$k')).toBe(
      'a%26b%3Dc%23d%3Fe%2Ff%2Cg%3Bh%3Ai%40j%24k',
    );
  });
});

describe('encodeQuery', () => {
  it('encodes names and values and joins them with &', () => {
    expect(encodeQuery({ q: "Ana's (draft)! *", page: 2 })).toBe(
      'q=Ana%27s%20%28draft%29%21%20%2A&page=2',
    );
  });

  it('encodes ISO 8601 dates with a zone, colons and plus signs included', () => {
    expect(encodeQuery({ from: '2026-10-05T08:02:00.000Z', to: '2026-10-05T08:02:00+02:00' })).toBe(
      'from=2026-10-05T08%3A02%3A00.000Z&to=2026-10-05T08%3A02%3A00%2B02%3A00',
    );
  });

  it('writes booleans and numbers as text', () => {
    expect(encodeQuery({ untraced: true, originScreenId: 12 })).toBe(
      'untraced=true&originScreenId=12',
    );
  });

  it('skips undefined and null', () => {
    expect(encodeQuery({ a: undefined, b: null, c: 'x' })).toBe('c=x');
    expect(encodeQuery(undefined)).toBe('');
    expect(encodeQuery({})).toBe('');
  });

  it('sends a list of one value as the value alone (form, explode false)', () => {
    expect(encodeQuery({ types: ['SCREEN'] })).toBe('types=SCREEN');
  });

  it('sends a list of several values separated by a literal comma', () => {
    expect(encodeQuery({ applicationId: 1, types: ['SCREEN', 'VARIABLE', 'COLLECTION'] })).toBe(
      'applicationId=1&types=SCREEN,VARIABLE,COLLECTION',
    );
  });

  it('encodes each value of a list before joining them', () => {
    expect(encodeQuery({ list: ['a b', "c'd", 'é,f'] })).toBe('list=a%20b,c%27d,%C3%A9%2Cf');
  });

  it('does not send an empty list', () => {
    expect(encodeQuery({ types: [] })).toBe('');
  });
});

describe('the URL of a request', () => {
  it('carries the encoded query string', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await rawRequest({
      method: 'GET',
      path: '/search',
      query: { q: "café (v2)! 'x' *", types: ['SCREEN', 'VARIABLE'], applicationId: 1 },
    });
    expect(spy.mock.calls[0]?.[0]).toBe(
      '/api/v1/search?q=caf%C3%A9%20%28v2%29%21%20%27x%27%20%2A&types=SCREEN,VARIABLE&applicationId=1',
    );
  });

  it('encodes path parameters too and adds no "?" without a query', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    await rawRequest({ method: 'GET', path: '/users/{id}', pathParams: { id: 7 } });
    expect(spy.mock.calls[0]?.[0]).toBe('/api/v1/users/7');
  });
});
