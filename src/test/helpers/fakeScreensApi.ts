// fakeScreensApi: in-memory fake of the screen endpoints behind the API client (no fetch).
// makeScreensApi(apps, init) -> { state, client, calls, callsTo, failNext, hold, etagOf, collectionsApi }
//   GET /screens (filters q, documentationStatus, authorId, sort name | documentationStatus | updatedAt |
//   pendingSubtasks, page, pageSize; App (OnStart) is always first; an unknown applicationId is 404, D-70),
//   GET /screens/{id} (with a weak ETag that moves when a write changes something), POST /screens,
//   PUT /screens/{id} (fakeScreenUpdate: the rules of the real server in its order), DELETE /screens/{id},
//   PUT /screens/{id}/status and POST /screens/{id}/review (fakeScreenStatus), GET and POST /screens/{id}/comments and
//   PUT /comments/{id} (fakeScreenComments; a review adds its comment to the thread), GET /screens/{id}/jira-tickets and
//   POST /screens/{id}/jira-ticket (fakeScreenJira; Jira is the state `jira`). Everything else (variables, collections, applications) goes to the collections fake.
//   Writes check in the order of the real server (contract 0.3.5):
//     POST    400 (name, Miro link) -> 404 (application) -> 422 APPLICATION_ARCHIVED -> 409 DUPLICATE_NAME
//     PUT     400 -> 404 -> 422 APPLICATION_ARCHIVED -> 412 -> 422 rules -> 409 DUPLICATE_NAME (see fakeScreenUpdate)
//     DELETE  404 -> 422 APPLICATION_ARCHIVED -> 422 APP_CONTEXT_PROTECTED -> 422 SCREEN_IN_REVIEW (D-82)
//     status  400 -> 404 -> 422 APPLICATION_ARCHIVED -> 412 -> 422 INVALID_TRANSITION -> 422 TEMPLATE_INCOMPLETE (D-88)
//     review  400 -> 404 -> 422 APPLICATION_ARCHIVED -> 422 NOT_IN_REVIEW -> 422 COMMENT_REQUIRED (D-88)
//     jira    400 -> 404 -> 422 APPLICATION_ARCHIVED -> 422 STORY_NOT_IN_SCREEN -> 502 JIRA_UNAVAILABLE -> creation ->
//             502 JIRA_PARTIAL_FAILURE (D-92, D-94); the screen's `pendingSubtasks` follows the Subtasks not done
//   POST starts the screen as UNDOCUMENTED, or DRAFT when a template field has content (D-81). DELETE leaves the
//   variables created in the screen without an origin.
//   Tag of a screen: W/"<version>", and W/"<version>-<comments written>" once a comment was written (D-101: the counter moves
//   the tag of a GET, and If-Match compares only the version part, so a comment is never a 412 for an edit).
import { vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ApiClient } from '../../api/client';
import type { ScreenComment } from '../../modules/comments/commentTypes';
import type {
  Screen,
  ScreenCreate,
  ScreenSummary,
  ScreenUpdate,
} from '../../modules/screens/screenTypes';

import { makeCollectionsApi, type CollectionsApiInit } from './fakeCollectionsApi';
import {
  applyScreenUpdate,
  checkScreenUpdateBody,
  checkScreenUpdateRequest,
  type ScreenUpdateEnv,
} from './fakeScreenUpdate';
import {
  checkCommentBody,
  checkPaging,
  createComment,
  commentEtagOf,
  editComment,
  listComments,
  CURRENT_USER,
} from './fakeScreenComments';
import {
  applyReview,
  applyStatusChange,
  checkReviewBody,
  checkStatusBody,
  type ScreenStatusEnv,
} from './fakeScreenStatus';
import {
  checkJiraCreateBody,
  createJiraTickets,
  listJiraTree,
  makeFakeJira,
  pendingSubtasksOf,
  type FakeJira,
  type JiraEnv,
} from './fakeScreenJira';
import type { RecordedApiCall } from './fakeVariablesApi';
import type { makeApplicationsClient } from './renderApp';

export const EMPTY_TEMPLATE: Screen['template'] = {
  onStart: null,
  workingProcess: null,
  architecture: null,
  dataModel: null,
  requirements: null,
  knownIssues: null,
  risks: null,
};

export function makeScreenDetail(
  id: number,
  name: string,
  overrides: Partial<Screen> = {},
): Screen {
  return {
    id,
    applicationId: 1,
    name,
    isAppContext: false,
    documentationStatus: 'DRAFT',
    author: { id: 1, name: 'Admin' },
    pendingSubtasks: 0,
    commentCount: 0,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    miroLink: null,
    template: { ...EMPTY_TEMPLATE },
    components: [],
    variableLinks: [],
    collectionLinks: [],
    navigations: [],
    ...overrides,
  };
}

export interface ScreensApiInit extends CollectionsApiInit {
  /** The screens the API serves (summary and detail). */
  screenDetails?: Screen[];
  /** The state of Jira and of the local tickets (defaults: available, no tickets). */
  jira?: Partial<FakeJira>;
  /** The comments of the screens (oldest first by createdAt, then id). Default: none. */
  comments?: ScreenComment[];
}

const SORT_KEYS = ['name', 'documentationStatus', 'updatedAt', 'pendingSubtasks'] as const;
const STATUS_ORDER = ['UNDOCUMENTED', 'DRAFT', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED'];

function response(body: unknown, etag: string | null = null, status = 200) {
  return Promise.resolve({ body, status, etag, location: null });
}

function summary(screen: Screen): ScreenSummary {
  const {
    miroLink: _miro,
    template: _template,
    components: _components,
    variableLinks: _variableLinks,
    collectionLinks: _collectionLinks,
    navigations: _navigations,
    ...rest
  } = screen;
  void [_miro, _template, _components, _variableLinks, _collectionLinks, _navigations];
  return rest;
}

function validationError(field: string, rule: string): ApiError {
  return new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    details: { fields: [{ field, rule, message: 'x' }] },
  });
}

function notFound(element: string, id: unknown): ApiError {
  return new ApiError({ status: 404, code: 'NOT_FOUND', details: { element, id } });
}

export function makeScreensApi(
  apps: ReturnType<typeof makeApplicationsClient>,
  init: ScreensApiInit = {},
) {
  const screenDetails = init.screenDetails ?? [];
  const collectionsApi = makeCollectionsApi(apps, {
    ...init,
    screens: init.screens ?? screenDetails.map(summary),
  });
  const state = {
    screens: screenDetails,
    versions: new Map<number, number>(),
    nextId: 2000,
    nextNestedId: 5000,
    comments: init.comments ?? ([] as ScreenComment[]),
    nextCommentId: 9000,
    commentsWritten: new Map<number, number>(),
  };
  const jira = makeFakeJira(init.jira);
  const calls: RecordedApiCall[] = [];
  const failures = new Map<string, ApiError[]>();
  const holds: Array<{ predicate: (call: RecordedApiCall) => boolean; gate: Promise<void> }> = [];

  const etagOf = (id: number) => {
    const written = state.commentsWritten.get(id) ?? 0;
    const version = state.versions.get(id) ?? 1;
    return written > 0 ? `W/"${version}-${written}"` : `W/"${version}"`;
  };

  function failNext(operation: string, error: ApiError) {
    failures.set(operation, [...(failures.get(operation) ?? []), error]);
  }

  function hold(predicate: (call: RecordedApiCall) => boolean) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    holds.push({ predicate, gate });
    return { release };
  }

  function find(id: unknown): Screen {
    const found = state.screens.find((s) => s.id === id);
    if (!found) throw notFound('screen', id);
    return found;
  }

  function checkApplication(applicationId: unknown): {
    id: number;
    name: string;
    archived: boolean;
  } {
    const application = apps.state.applications.find((a) => a.id === applicationId);
    if (!application) throw notFound('application', applicationId);
    return {
      id: application.id,
      name: application.name,
      archived: application.status === 'ARCHIVED',
    };
  }

  function listScreens(query: Record<string, unknown>) {
    checkApplication(query.applicationId);
    let rows = state.screens.filter((s) => s.applicationId === query.applicationId);
    if (typeof query.q === 'string') {
      const q = query.q.toLowerCase();
      rows = rows.filter((s) => s.name.toLowerCase().includes(q));
    }
    if (typeof query.documentationStatus === 'string') {
      rows = rows.filter((s) => s.documentationStatus === query.documentationStatus);
    }
    if (typeof query.authorId === 'number') {
      rows = rows.filter((s) => s.author.id === query.authorId);
    }
    const sort = typeof query.sort === 'string' ? query.sort : 'name';
    const key = sort.replace(/^-/, '') as (typeof SORT_KEYS)[number];
    if (!SORT_KEYS.includes(key)) throw validationError('sort', 'enum');
    const value = (screen: Screen) =>
      key === 'documentationStatus'
        ? STATUS_ORDER.indexOf(screen.documentationStatus)
        : key === 'pendingSubtasks'
          ? screen.pendingSubtasks
          : screen[key];
    rows = [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      return typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));
    });
    if (sort.startsWith('-')) rows.reverse();
    // App (OnStart) is always listed first, whatever the order.
    rows = [...rows.filter((s) => s.isAppContext), ...rows.filter((s) => !s.isAppContext)];
    const page = (query.page as number | undefined) ?? 1;
    const pageSize = (query.pageSize as number | undefined) ?? 20;
    return {
      data: rows.slice((page - 1) * pageSize, page * pageSize).map(summary),
      page,
      pageSize,
      total: rows.length,
    };
  }

  const hasContent = (template: Screen['template']) =>
    Object.values(template).some((text) => typeof text === 'string' && text.trim() !== '');

  async function handle(method: string, path: string, options: RecordedApiCall['options'] = {}) {
    const own = [
      '/screens',
      '/screens/{id}',
      '/screens/{id}/status',
      '/screens/{id}/review',
      '/screens/{id}/comments',
      '/comments/{id}',
      '/screens/{id}/jira-tickets',
      '/screens/{id}/jira-ticket',
    ];
    if (!own.includes(path)) {
      const fallback = collectionsApi.client as unknown as Record<
        string,
        (p: string, o?: unknown) => Promise<unknown>
      >;
      return fallback[method.toLowerCase()]?.(path, options);
    }
    const call: RecordedApiCall = { method, path, options };
    calls.push(call);
    for (const held of holds) if (held.predicate(call)) await held.gate;
    const queued = failures.get(`${method} ${path}`);
    const failure = queued?.shift();
    if (failure) throw failure;
    const query = options.query ?? {};

    if (method === 'GET' && path === '/screens') return response(listScreens(query));
    if (method === 'GET' && path === '/screens/{id}') {
      const screen = find(options.path?.id);
      // The origin row shows where its variable is created (contract 0.5.0): it lives on the variable.
      const variables = collectionsApi.variablesApi.state.variables;
      const data = {
        ...screen,
        variableLinks: screen.variableLinks.map((link) =>
          link.isOrigin
            ? {
                ...link,
                originUsedIn:
                  variables.find((variable) => variable.id === link.variable.id)?.originUsedIn ??
                  link.originUsedIn,
              }
            : link,
        ),
      };
      return response({ data }, etagOf(screen.id));
    }
    if (method === 'POST' && path === '/screens') {
      const body = options.body as ScreenCreate;
      // 400: what the body says by itself.
      if (body.name.length < 1) throw validationError('name', 'minLength');
      if (body.name.length > 150) throw validationError('name', 'maxLength');
      if (typeof body.miroLink === 'string' && !/^https:\/\//.test(body.miroLink)) {
        throw validationError('miroLink', 'pattern');
      }
      // 404, then 422 APPLICATION_ARCHIVED, then 409 DUPLICATE_NAME.
      const application = checkApplication(body.applicationId);
      if (application.archived) throw new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' });
      if (state.screens.some((s) => s.applicationId === application.id && s.name === body.name)) {
        throw new ApiError({
          status: 409,
          code: 'DUPLICATE_NAME',
          details: {
            field: 'name',
            type: 'screen',
            name: body.name,
            application: application.name,
            container: 'application',
          },
        });
      }
      const id = state.nextId++;
      const created = makeScreenDetail(id, body.name, {
        applicationId: application.id,
        documentationStatus: hasContent(body.template) ? 'DRAFT' : 'UNDOCUMENTED',
        miroLink: body.miroLink ?? null,
        template: body.template,
        author: { id: 7, name: 'Ana Mora' },
        updatedAt: new Date().toISOString(),
      });
      state.screens = [...state.screens, created];
      return response({ data: created }, etagOf(id), 201);
    }
    if (method === 'PUT' && path === '/screens/{id}') {
      const body = options.body as ScreenUpdate;
      // 400 -> 404 (the screen, the nested ids, the references) -> 422 APPLICATION_ARCHIVED -> 412 -> 422 -> 409.
      checkScreenUpdateBody(body, Number(options.path?.id));
      const current = find(options.path?.id);
      const application = checkApplication(current.applicationId);
      const env: ScreenUpdateEnv = {
        screens: state.screens,
        variables: collectionsApi.variablesApi.state.variables,
        collections: collectionsApi.state.collections,
        application: { name: application.name, archived: application.archived },
        etagOf,
        nextNestedId: () => state.nextNestedId++,
        now: () => new Date().toISOString(),
      };
      checkScreenUpdateRequest(body, current, env);
      const { screen, changed } = applyScreenUpdate(env, current, body, options.ifMatch);
      if (changed) {
        state.screens = state.screens.map((s) => (s.id === screen.id ? screen : s));
        state.versions.set(screen.id, (state.versions.get(screen.id) ?? 1) + 1);
      }
      return response({ data: screen }, etagOf(screen.id));
    }
    if (method === 'DELETE' && path === '/screens/{id}') {
      const current = find(options.path?.id);
      if (checkApplication(current.applicationId).archived) {
        throw new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' });
      }
      if (current.isAppContext) throw new ApiError({ status: 422, code: 'APP_CONTEXT_PROTECTED' });
      if (current.documentationStatus === 'IN_REVIEW') {
        throw new ApiError({ status: 422, code: 'SCREEN_IN_REVIEW' });
      }
      state.screens = state.screens.filter((s) => s.id !== current.id);
      // The variables created in the screen keep existing without an origin.
      collectionsApi.variablesApi.state.variables = collectionsApi.variablesApi.state.variables.map(
        (v) =>
          v.originScreen?.id === current.id
            ? { ...v, originScreen: null, fullTraceability: false }
            : v,
      );
      return response(null, null, 204);
    }
    if (
      (method === 'PUT' && path === '/screens/{id}/status') ||
      (method === 'POST' && path === '/screens/{id}/review')
    ) {
      // 400 (the body) -> 404 (the screen) -> the rules of the operation, in their order.
      const isStatus = path.endsWith('/status');
      const parsedStatus = isStatus ? checkStatusBody(options.body) : null;
      const parsedReview = isStatus ? null : checkReviewBody(options.body);
      const current = find(options.path?.id);
      const env: ScreenStatusEnv = {
        application: { archived: checkApplication(current.applicationId).archived },
        etagOf,
        now: () => new Date().toISOString(),
      };
      const screen =
        parsedStatus !== null
          ? applyStatusChange(env, current, parsedStatus.status, options.ifMatch)
          : applyReview(env, current, parsedReview as NonNullable<typeof parsedReview>);
      if (parsedReview !== null && screen.commentCount > current.commentCount) {
        // A review that left a comment adds it to the thread, as a review comment (D-56, D-88).
        state.comments = [
          ...state.comments,
          {
            id: state.nextCommentId++,
            screenId: screen.id,
            author: { ...CURRENT_USER },
            text: parsedReview.comment as string,
            reviewDecision: parsedReview.decision,
            createdAt: new Date().toISOString(),
            updatedAt: null,
          },
        ];
        state.commentsWritten.set(screen.id, (state.commentsWritten.get(screen.id) ?? 0) + 1);
      }
      state.screens = state.screens.map((s) => (s.id === screen.id ? screen : s));
      state.versions.set(screen.id, (state.versions.get(screen.id) ?? 1) + 1);
      return response({ data: screen }, etagOf(screen.id));
    }
    if (path === '/screens/{id}/comments') {
      const writeEnv = (screenId: number) => ({
        application: { archived: checkApplication(find(screenId).applicationId).archived },
        now: () => new Date().toISOString(),
      });
      if (method === 'GET') {
        const paging = checkPaging(query);
        const screen = find(options.path?.id);
        return response(listComments(state.comments, screen.id, paging));
      }
      // POST: 400 -> 404 -> 422 APPLICATION_ARCHIVED.
      const { text } = checkCommentBody(options.body);
      const screen = find(options.path?.id);
      const created = createComment(writeEnv(screen.id), state.nextCommentId++, screen.id, text);
      state.comments = [...state.comments, created];
      state.screens = state.screens.map((s) =>
        s.id === screen.id ? { ...s, commentCount: s.commentCount + 1 } : s,
      );
      state.commentsWritten.set(screen.id, (state.commentsWritten.get(screen.id) ?? 0) + 1);
      return response({ data: created }, commentEtagOf(created), 201);
    }
    if (method === 'PUT' && path === '/comments/{id}') {
      // 400 -> 404 -> 403 -> 422 APPLICATION_ARCHIVED -> 412 -> 422 REVIEW_COMMENT_LOCKED.
      const { text } = checkCommentBody(options.body);
      const current = state.comments.find((c) => c.id === options.path?.id);
      if (!current) throw notFound('comment', options.path?.id);
      const screen = find(current.screenId);
      const edited = editComment(
        {
          application: { archived: checkApplication(screen.applicationId).archived },
          now: () => new Date().toISOString(),
        },
        current,
        text,
        options.ifMatch,
      );
      state.comments = state.comments.map((c) => (c.id === edited.id ? edited : c));
      return response({ data: edited }, commentEtagOf(edited));
    }
    if (path === '/screens/{id}/jira-tickets' || path === '/screens/{id}/jira-ticket') {
      const isCreate = method === 'POST';
      // 400 (the body) -> 404 (the screen) -> the rules of the operation, in their order.
      const parsed = isCreate ? checkJiraCreateBody(options.body) : null;
      const current = find(options.path?.id);
      const application = checkApplication(current.applicationId);
      const env: JiraEnv = {
        application: { name: application.name, archived: application.archived },
        now: () => new Date().toISOString(),
      };
      const syncPending = () => {
        state.screens = state.screens.map((s) =>
          s.id === current.id ? { ...s, pendingSubtasks: pendingSubtasksOf(jira, s.id) } : s,
        );
      };
      if (!isCreate) {
        const tree = listJiraTree(jira, env, current.id, query.refresh === true);
        syncPending();
        return response({ data: tree });
      }
      try {
        const created = createJiraTickets(jira, env, current, parsed as NonNullable<typeof parsed>);
        return response({ data: created }, null, 201);
      } finally {
        syncPending();
      }
    }
    throw new Error(`fakeScreensApi: unhandled ${method} ${path}`);
  }

  const client = {
    get: vi.fn((path: string, options?: RecordedApiCall['options']) =>
      handle('GET', path, options),
    ),
    post: vi.fn((path: string, options?: RecordedApiCall['options']) =>
      handle('POST', path, options),
    ),
    put: vi.fn((path: string, options?: RecordedApiCall['options']) =>
      handle('PUT', path, options),
    ),
    delete: vi.fn((path: string, options?: RecordedApiCall['options']) =>
      handle('DELETE', path, options),
    ),
  } as unknown as ApiClient;

  const callsTo = (operation: string) =>
    calls.filter((call) => `${call.method} ${call.path}` === operation);

  return { state, jira, client, calls, callsTo, failNext, hold, etagOf, collectionsApi };
}
