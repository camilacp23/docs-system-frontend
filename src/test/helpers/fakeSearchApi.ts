// fakeSearchApi: in-memory fake of GET /search behind the API client (no fetch), answering like the server (SDD 7.2.6,
// contract 0.3.7, D-105 and D-110).
// makeSearchApi(apps, init) -> { state, client, calls, callsTo, listCalls, totalCalls, failNext, hold, setElements }
//   init.elements: what exists (see screenElement, variableElement, collectionElement, componentElement).
//   The checks, in the order of the API: 404 NOT_FOUND for an unknown applicationId -> 400 VALIDATION_ERROR (a `q` of
//   more than 100 characters is measured WITHOUT trimming, as the real validator does: `maxLength`; once trimmed a
//   text of fewer than 2 characters is `minLength`; no `q` and no filter at all is `required` on `q`; a page size over
//   100 is `maximum`).
//   Text (D-105 a, D-110 a): trimmed, compared with a fixed map one for one (A-Z to lower case, Ñ to ñ, á é í ó ú ü in
//   both capitalizations to their vowel; ñ stays different from n); the characters of a pattern, % and _ are literal.
//   Written on its own, with a string map and no code shared with the page, so the tests do not check the browser's
//   normalization with itself.
//   Filters (D-48, D-105 b): `types` first; `environment` restricts variables and collections; `documentationStatus` only
//   screens; `scope` only variables; the other types are left unfiltered.
//   Where it searches (D-105 c): screens, name and the seven template fields; variables, name, description and `usedIn`;
//   collections, name, description, creation condition, field names and `usedIn`; components, name, description,
//   onSelect and control type. One result per element; `matchedIn` is the first of name, description, template,
//   creationCondition, fieldName, onSelect, type, usedIn; null (and no snippet) without `q`.
//   Snippet (D-105 e): null for `name` or without text; plain text of up to 300 characters around the first match, with
//   "…" where it was cut (the ellipsis counts in the 300).
//   Order (D-105 f, D-110 c): exact name match first (only with `q`), then the normalized name by code point, then the
//   type (SCREEN, VARIABLE, COLLECTION, COMPONENT) and the id. Pagination: `page`, `pageSize`, `total`.
//   Every call is recorded with its query and its AbortSignal. failNext('GET /search', error, { when }) fails the next
//   matching call once; hold(predicate) makes the matching calls wait until `release()` (a call whose signal was aborted
//   while it waited rejects with an AbortError, as fetch does). Everything else (the screen count of the application
//   card) goes to the variables fake.
import { vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

import { makeVariablesApi } from './fakeVariablesApi';
import type { makeApplicationsClient } from './renderApp';

type SearchResult = components['schemas']['SearchResult'];
type ElementType = components['schemas']['ElementType'];
type Environment = components['schemas']['Environment'];
type DocumentationStatus = components['schemas']['DocumentationStatus'];
type VariableScope = components['schemas']['VariableScope'];

export interface SimElement {
  type: ElementType;
  id: number;
  applicationId: number;
  name: string;
  description: string | null;
  /** The seven template fields of a screen, in the order of the template. */
  template: string[];
  creationCondition: string | null;
  /** The names of the fields of a collection, by position. */
  fieldNames: string[];
  onSelect: string | null;
  /** The control type of a component. */
  controlType: string | null;
  /** The `usedIn` of the links of a variable or a collection, the one of the lowest link id first. */
  usedIn: string[];
  status: DocumentationStatus;
  scope: VariableScope;
  environments: Environment[];
  /** The screen of a component, or where a variable was created (null: none). */
  screen: { id: number; name: string } | null;
}

type Details = Partial<Omit<SimElement, 'type' | 'id' | 'name'>>;

function element(type: ElementType, id: number, name: string, details: Details): SimElement {
  return {
    type,
    id,
    name,
    applicationId: 1,
    description: null,
    template: [],
    creationCondition: null,
    fieldNames: [],
    onSelect: null,
    controlType: null,
    usedIn: [],
    status: 'DRAFT',
    scope: 'GLOBAL',
    environments: ['DEV', 'PROD'],
    screen: null,
    ...details,
  };
}

export const screenElement = (id: number, name: string, details: Details = {}) =>
  element('SCREEN', id, name, details);
export const variableElement = (id: number, name: string, details: Details = {}) =>
  element('VARIABLE', id, name, details);
export const collectionElement = (id: number, name: string, details: Details = {}) =>
  element('COLLECTION', id, name, details);
export const componentElement = (id: number, name: string, details: Details = {}) =>
  element('COMPONENT', id, name, { screen: { id: 1, name: 'Inicio' }, ...details });

export interface SearchApiInit {
  elements?: SimElement[];
}

export interface SearchCall {
  method: string;
  path: string;
  query: Record<string, unknown>;
  signal: AbortSignal | undefined;
}

// The fixed map of D-110 a, written as two strings of equal length.
const MAP_FROM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÑáéíóúüÁÉÍÓÚÜ';
const MAP_TO = 'abcdefghijklmnopqrstuvwxyzñaeiouuaeiouu';

function normalize(text: string): string {
  let result = '';
  for (const unit of text.split('')) {
    const at = MAP_FROM.indexOf(unit);
    result += at === -1 ? unit : (MAP_TO[at] ?? unit);
  }
  return result;
}

const TYPE_ORDER: ElementType[] = ['SCREEN', 'VARIABLE', 'COLLECTION', 'COMPONENT'];
const SNIPPET_MAX = 300;

/** Up to 300 characters around the first match, with "…" where it is cut (the ellipsis counts). */
function snippetOf(text: string, query: string): string {
  if (text.length <= SNIPPET_MAX) return text;
  const at = Math.max(normalize(text).indexOf(normalize(query)), 0);
  const room = SNIPPET_MAX - 2;
  let start = Math.max(0, at - Math.floor((room - query.length) / 2));
  let end = start + room;
  if (end > text.length) {
    end = text.length;
    start = Math.max(0, end - room);
  }
  const body = text.slice(start, end);
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`.slice(0, SNIPPET_MAX);
}

/** The places an element is searched, in the order of `matchedIn` (the first that matches wins). */
function places(item: SimElement): Array<[string, string[]]> {
  switch (item.type) {
    case 'SCREEN':
      return [
        ['name', [item.name]],
        ['template', item.template],
      ];
    case 'VARIABLE':
      return [
        ['name', [item.name]],
        ['description', item.description === null ? [] : [item.description]],
        ['usedIn', item.usedIn],
      ];
    case 'COLLECTION':
      return [
        ['name', [item.name]],
        ['description', item.description === null ? [] : [item.description]],
        ['creationCondition', item.creationCondition === null ? [] : [item.creationCondition]],
        ['fieldName', item.fieldNames],
        ['usedIn', item.usedIn],
      ];
    case 'COMPONENT':
      return [
        ['name', [item.name]],
        ['description', item.description === null ? [] : [item.description]],
        ['onSelect', item.onSelect === null ? [] : [item.onSelect]],
        ['type', item.controlType === null ? [] : [item.controlType]],
      ];
  }
}

function toResult(item: SimElement, found: { matchedIn: string; snippet: string | null } | null) {
  const base = {
    type: item.type,
    id: item.id,
    name: item.name,
    matchedIn: found?.matchedIn ?? null,
    snippet: found?.snippet ?? null,
  };
  switch (item.type) {
    case 'SCREEN':
      return { ...base, documentationStatus: item.status };
    case 'VARIABLE':
      return { ...base, screen: item.screen, environments: item.environments };
    case 'COLLECTION':
      return { ...base, environments: item.environments };
    case 'COMPONENT':
      return { ...base, screen: item.screen };
  }
}

function validationError(field: string, rule: string): ApiError {
  return new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    details: { fields: [{ field, rule, message: 'x' }] },
  });
}

export function makeSearchApi(
  apps: ReturnType<typeof makeApplicationsClient>,
  init: SearchApiInit = {},
) {
  const variablesApi = makeVariablesApi(apps, { screens: [] });
  const state = { elements: init.elements ?? [] };
  const calls: SearchCall[] = [];
  const failures: Array<{ error: ApiError; when: (call: SearchCall) => boolean }> = [];
  const holds: Array<{ predicate: (call: SearchCall) => boolean; gate: Promise<void> }> = [];

  function setElements(elements: SimElement[]) {
    state.elements = elements;
  }

  function failNext(
    operation: string,
    error: ApiError,
    options: { when?: (call: SearchCall) => boolean } = {},
  ) {
    if (operation !== 'GET /search') throw new Error(`fakeSearchApi cannot fail ${operation}`);
    failures.push({ error, when: options.when ?? (() => true) });
  }

  function hold(predicate: (call: SearchCall) => boolean) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    holds.push({ predicate, gate });
    return { release };
  }

  function search(query: Record<string, unknown>) {
    const applicationId = query.applicationId;
    if (!apps.state.applications.some((application) => application.id === applicationId)) {
      throw new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        details: { element: 'application', id: applicationId },
      });
    }
    const rawText = typeof query.q === 'string' ? query.q : null;
    // The real validator measures the text as it arrives, before it is trimmed.
    if (rawText !== null && Array.from(rawText).length > 100)
      throw validationError('q', 'maxLength');
    const text = rawText === null ? null : rawText.trim();
    if (text !== null && Array.from(text).length < 2) throw validationError('q', 'minLength');
    const types = Array.isArray(query.types) ? (query.types as ElementType[]) : null;
    const { environment, documentationStatus, scope } = query;
    const hasFilter =
      (types !== null && types.length > 0) ||
      environment !== undefined ||
      documentationStatus !== undefined ||
      scope !== undefined;
    if (text === null && !hasFilter) throw validationError('q', 'required');
    const pageSize = typeof query.pageSize === 'number' ? query.pageSize : 20;
    const page = typeof query.page === 'number' ? query.page : 1;
    if (pageSize > 100) throw validationError('pageSize', 'maximum');

    const wanted = text === null ? null : normalize(text);
    const matches: Array<{ item: SimElement; matchedIn: string | null; snippet: string | null }> =
      [];
    for (const item of state.elements) {
      if (item.applicationId !== applicationId) continue;
      if (types !== null && types.length > 0 && !types.includes(item.type)) continue;
      if (item.type !== 'SCREEN' && item.type !== 'COMPONENT' && typeof environment === 'string') {
        if (!item.environments.includes(environment as Environment)) continue;
      }
      if (item.type === 'SCREEN' && typeof documentationStatus === 'string') {
        if (item.status !== documentationStatus) continue;
      }
      if (item.type === 'VARIABLE' && typeof scope === 'string') {
        if (item.scope !== scope) continue;
      }
      if (wanted === null || text === null) {
        matches.push({ item, matchedIn: null, snippet: null });
        continue;
      }
      for (const [place, texts] of places(item)) {
        const hit = texts.find((candidate) => normalize(candidate).includes(wanted));
        if (hit !== undefined) {
          matches.push({
            item,
            matchedIn: place,
            snippet: place === 'name' ? null : snippetOf(hit, text),
          });
          break;
        }
      }
    }

    const exact = (item: SimElement) =>
      wanted !== null && normalize(item.name) === wanted ? 0 : 1;
    matches.sort((a, b) => {
      const byExact = exact(a.item) - exact(b.item);
      if (byExact !== 0) return byExact;
      const nameA = normalize(a.item.name);
      const nameB = normalize(b.item.name);
      if (nameA !== nameB) return nameA < nameB ? -1 : 1;
      const byType = TYPE_ORDER.indexOf(a.item.type) - TYPE_ORDER.indexOf(b.item.type);
      return byType !== 0 ? byType : a.item.id - b.item.id;
    });

    const data = matches
      .slice((page - 1) * pageSize, page * pageSize)
      .map(
        ({ item, matchedIn, snippet }) =>
          toResult(
            item,
            matchedIn === null ? null : { matchedIn, snippet },
          ) as unknown as SearchResult,
      );
    return { data, page, pageSize, total: matches.length };
  }

  async function handle(method: string, path: string, options: Record<string, unknown> = {}) {
    if (path !== '/search') {
      const fallback = variablesApi.client as unknown as Record<
        string,
        (p: string, o?: unknown) => Promise<unknown>
      >;
      return fallback[method.toLowerCase()]?.(path, options);
    }
    const query = (options.query ?? {}) as Record<string, unknown>;
    const signal = options.signal as AbortSignal | undefined;
    const call: SearchCall = { method, path, query, signal };
    calls.push(call);
    for (const held of holds) {
      if (held.predicate(call)) {
        await held.gate;
        if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
      }
    }
    const failureAt = failures.findIndex((failure) => failure.when(call));
    const [failure] = failureAt === -1 ? [] : failures.splice(failureAt, 1);
    if (failure !== undefined) throw failure.error;
    return { body: search(query), status: 200, etag: null, location: null };
  }

  const client = {
    get: vi.fn((path: string, options?: Record<string, unknown>) => handle('GET', path, options)),
    post: vi.fn((path: string, options?: Record<string, unknown>) => handle('POST', path, options)),
    put: vi.fn((path: string, options?: Record<string, unknown>) => handle('PUT', path, options)),
    delete: vi.fn((path: string, options?: Record<string, unknown>) =>
      handle('DELETE', path, options),
    ),
  } as unknown as ApiClient;

  const callsTo = (operation: string) =>
    calls.filter((call) => `${call.method} ${call.path}` === operation);
  /** The reads of the list (a page of results), not the totals of the chips (page size 1 with a single type). */
  const listCalls = () => callsTo('GET /search').filter((call) => !isTotalCall(call));
  /** The reads of the totals of the chips: one type and a page size of 1. */
  const totalCalls = () => callsTo('GET /search').filter(isTotalCall);

  return { state, client, calls, callsTo, listCalls, totalCalls, failNext, hold, setElements };
}

function isTotalCall(call: SearchCall): boolean {
  return (
    call.query.pageSize === 1 && Array.isArray(call.query.types) && call.query.types.length === 1
  );
}
