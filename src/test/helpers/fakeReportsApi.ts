// fakeReportsApi: in-memory fake of the six /reports operations behind the API client (no fetch).
// makeReportsApi(apps, init, base?) -> { state, client, calls, callsTo, failNext, hold, settle, downloads }
//   init: role (of the signed-in user), reports (Report[], any order), parameters (by id, what GET /reports/{id}
//   returns as `parameters`; default PDF, SCREEN, publish false). `base` is the client that answers every other path (the
//   sidebar reads GET /screens); by default the screens fake with no screens.
//   It answers like the server (SDD 7.2.7, D-118, D-120, D-121): GET /reports is newest first (createdAt, id), takes
//   published=true|false, gives a Reader only the published ones (published=false: an empty page) and 404 for an
//   application that does not exist; GET /reports/{id} is a 404 for a Reader when the report is not published and carries
//   `parameters`; POST makes a NEW PENDING report (403 for a Reader); PUT publication checks If-Match against
//   W/"<epoch ms of updatedAt>" (412 with currentETag) and then the status (409 REPORT_NOT_READY with details.status);
//   download answers a Blob with Content-Disposition (404 / 409 as the contract says). Every read of a report carries its ETag.
//   settle(id, 'READY' | 'FAILED', overrides?) is the worker: it moves a PENDING report on (and publishes it when its
//   parameters say publish) and bumps updatedAt. failNext('PUT /reports/{id}/publication', error, match?) fails the next call
//   (the next one that `match` accepts) once; hold(predicate) keeps the matching call waiting until release().
import { vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ApiClient } from '../../api/client';
import type { DownloadResult } from '../../api/http';
import type { components } from '../../api/schema';

import { makeScreensApi } from './fakeScreensApi';
import type { RecordedApiCall } from './fakeVariablesApi';
import type { makeApplicationsClient } from './renderApp';

export type ReportRow = components['schemas']['Report'];
type Parameters = components['schemas']['ReportParameters'];
type Role = components['schemas']['UserRole'];

const ERRORS = {
  tooLong: 'The report took too long to generate. Try again with a smaller selection.',
  generic: "The report couldn't be generated. Try again in a few minutes.",
} as const;
export const FAILED_TEXTS = ERRORS;

/** A report as the API serves it (a READY PDF of Camila Castillo, completed on Oct 5 at 09:01 in Costa Rica, unless said). */
export function makeReport(id: number, overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id,
    applicationId: 1,
    title: `Report ${id}`,
    format: 'PDF',
    status: 'READY',
    isPublished: false,
    fileName: `report-${id}-2026-10-05.pdf`,
    fileSize: 412 * 1024,
    errorMessage: null,
    generatedBy: { id: 2, name: 'Camila Castillo' },
    createdAt: `2026-10-05T14:${String(Math.min(id, 59)).padStart(2, '0')}:00.000Z`,
    updatedAt: `2026-10-05T15:${String(Math.min(id, 59)).padStart(2, '0')}:00.000Z`,
    completedAt: '2026-10-05T15:01:00.000Z',
    publishedAt: null,
    ...overrides,
  };
}

/** A PENDING report: no file, no dates, not published. */
export function makePending(id: number, overrides: Partial<ReportRow> = {}): ReportRow {
  return makeReport(id, {
    status: 'PENDING',
    fileName: null,
    fileSize: null,
    completedAt: null,
    ...overrides,
  });
}

/** A FAILED report with one of the four fixed texts. */
export function makeFailed(id: number, overrides: Partial<ReportRow> = {}): ReportRow {
  return makeReport(id, {
    status: 'FAILED',
    fileName: null,
    fileSize: null,
    completedAt: null,
    errorMessage: ERRORS.tooLong,
    ...overrides,
  });
}

/** A published READY report. */
export function makePublished(id: number, overrides: Partial<ReportRow> = {}): ReportRow {
  return makeReport(id, {
    isPublished: true,
    publishedAt: '2026-10-05T15:01:00.000Z',
    ...overrides,
  });
}

export interface ReportsApiInit {
  role?: Role;
  reports?: ReportRow[];
  parameters?: Record<number, Parameters>;
}

const etagOf = (report: ReportRow) => `W/"${Date.parse(report.updatedAt)}"`;
const notFound = (id: unknown) =>
  new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'report', id } });

export function makeReportsApi(
  apps: ReturnType<typeof makeApplicationsClient>,
  init: ReportsApiInit = {},
  base?: ApiClient,
) {
  const role = init.role ?? 'ADMINISTRATOR';
  const rest = base ?? makeScreensApi(apps, { screenDetails: [] }).client;
  const state = {
    reports: init.reports ?? ([] as ReportRow[]),
    parameters: init.parameters ?? {},
    nextId: 500,
    /** The clock of updatedAt: every change moves it one second on. */
    tick: 0,
    /** The file every download answers. */
    file: new Blob(['%PDF-1.7 test'], { type: 'application/pdf' }),
    /** The Content-Disposition of a download (null: the header is missing). */
    disposition: (report: ReportRow) =>
      report.fileName === null ? null : `attachment; filename="${report.fileName}"`,
  };
  const calls: RecordedApiCall[] = [];
  const downloads: number[] = [];
  const failures = new Map<
    string,
    Array<{ error: ApiError; match?: (call: RecordedApiCall) => boolean }>
  >();
  const holds: Array<{ predicate: (call: RecordedApiCall) => boolean; gate: Promise<void> }> = [];

  const failNext = (
    operation: string,
    error: ApiError,
    match?: (call: RecordedApiCall) => boolean,
  ) => {
    failures.set(operation, [...(failures.get(operation) ?? []), { error, match }]);
  };
  function hold(predicate: (call: RecordedApiCall) => boolean) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    holds.push({ predicate, gate });
    return { release };
  }

  async function enter(operation: string, path: string, options: RecordedApiCall['options']) {
    const call: RecordedApiCall = { method: operation.split(' ')[0] ?? '', path, options };
    calls.push(call);
    for (const held of holds) if (held.predicate(call)) await held.gate;
    const queue = failures.get(operation) ?? [];
    const at = queue.findIndex((entry) => entry.match === undefined || entry.match(call));
    const [failure] = at >= 0 ? queue.splice(at, 1) : [];
    if (failure) throw failure.error;
  }

  const find = (id: unknown) => state.reports.find((report) => report.id === id);
  const visibleTo = (report: ReportRow | undefined) =>
    report !== undefined && (role !== 'READER' || report.isPublished) ? report : undefined;
  const bumpTime = (report: ReportRow): ReportRow => {
    state.tick += 1;
    return {
      ...report,
      updatedAt: new Date(Date.parse('2026-10-05T16:00:00.000Z') + state.tick * 1000).toISOString(),
    };
  };
  const replace = (next: ReportRow) => {
    state.reports = state.reports.map((report) => (report.id === next.id ? next : report));
    return next;
  };
  const answer = <T>(body: T, report: ReportRow, status = 200) => ({
    body,
    status,
    etag: etagOf(report),
    location: null,
  });

  async function list(options: RecordedApiCall['options']) {
    await enter('GET /reports', '/reports', options);
    const query = options.query ?? {};
    if (!apps.state.applications.some((app) => app.id === query.applicationId)) {
      throw new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        details: { element: 'application', id: query.applicationId },
      });
    }
    let rows = state.reports.filter((report) => report.applicationId === query.applicationId);
    if (role === 'READER') rows = rows.filter((report) => report.isPublished);
    if (query.published === true) rows = rows.filter((report) => report.isPublished);
    if (query.published === false)
      rows = role === 'READER' ? [] : rows.filter((r) => !r.isPublished);
    rows = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 20);
    return {
      body: {
        data: rows.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: rows.length,
      },
      status: 200,
      etag: null,
      location: null,
    };
  }

  async function detail(options: RecordedApiCall['options']) {
    // The server reads the report when the request arrives: a held call answers with what was true then.
    const report = visibleTo(find(options.path?.id));
    await enter('GET /reports/{id}', '/reports/{id}', options);
    if (!report) throw notFound(options.path?.id);
    const parameters: Parameters = state.parameters[report.id] ?? {
      format: report.format,
      scope: { elementTypes: ['SCREEN'], includeStatusSummary: false, includeDependencies: false },
      publish: false,
    };
    return answer({ data: { ...report, parameters } }, report);
  }

  async function create(path: string, options: RecordedApiCall['options']) {
    await enter(`POST ${path}`, path, options);
    if (role === 'READER') throw new ApiError({ status: 403, code: 'FORBIDDEN' });
    const body = options.body as {
      applicationId: number;
      title: string;
      scope: Parameters['scope'];
      publish: boolean;
    };
    const id = state.nextId++;
    const format = path === '/reports/pdf' ? 'PDF' : 'XLSX';
    const report = bumpTime(
      makePending(id, {
        applicationId: body.applicationId,
        title: body.title,
        format,
        createdAt: new Date(
          Date.parse('2026-10-05T16:00:00.000Z') + state.tick * 1000,
        ).toISOString(),
      }),
    );
    state.reports = [report, ...state.reports];
    state.parameters[id] = {
      format,
      scope: { ...body.scope },
      publish: body.publish,
    };
    return answer({ data: report }, report, 202);
  }

  async function publication(options: RecordedApiCall['options']) {
    await enter('PUT /reports/{id}/publication', '/reports/{id}/publication', options);
    const report = find(options.path?.id);
    if (!report) throw notFound(options.path?.id);
    if (options.ifMatch !== undefined && options.ifMatch !== etagOf(report)) {
      throw new ApiError({
        status: 412,
        code: 'PRECONDITION_FAILED',
        details: { currentETag: etagOf(report) },
      });
    }
    if (report.status !== 'READY') {
      throw new ApiError({
        status: 409,
        code: 'REPORT_NOT_READY',
        details: { status: report.status },
      });
    }
    const next = (options.body as { isPublished: boolean }).isPublished;
    if (next === report.isPublished) return answer({ data: report }, report);
    const changed = replace(
      bumpTime({
        ...report,
        isPublished: next,
        publishedAt: next ? '2026-10-05T16:00:00.000Z' : null,
      }),
    );
    return answer({ data: changed }, changed);
  }

  async function file(options: RecordedApiCall['options']): Promise<DownloadResult> {
    await enter('GET /reports/{id}/file', '/reports/{id}/file', options);
    const report = visibleTo(find(options.path?.id));
    if (!report) throw notFound(options.path?.id);
    if (report.status !== 'READY') {
      throw new ApiError({
        status: 409,
        code: 'REPORT_NOT_READY',
        details: { status: report.status },
      });
    }
    downloads.push(report.id);
    return {
      blob: state.file,
      contentType: state.file.type,
      contentDisposition: state.disposition(report),
      etag: etagOf(report),
    };
  }

  /** The worker finishes a PENDING report: READY (published when its parameters say so) or FAILED. */
  function settle(id: number, status: 'READY' | 'FAILED', overrides: Partial<ReportRow> = {}) {
    const report = find(id);
    if (!report) throw new Error(`No report ${id}`);
    const publish = state.parameters[id]?.publish === true;
    const done: ReportRow =
      status === 'READY'
        ? {
            ...report,
            status: 'READY',
            fileName: `report-${id}-2026-10-05.${report.format === 'PDF' ? 'pdf' : 'xlsx'}`,
            fileSize: 412 * 1024,
            completedAt: '2026-10-05T16:00:00.000Z',
            isPublished: publish,
            publishedAt: publish ? '2026-10-05T16:00:00.000Z' : null,
            ...overrides,
          }
        : { ...report, status: 'FAILED', errorMessage: ERRORS.generic, ...overrides };
    return replace(bumpTime(done));
  }

  type Anything = (path: string, options?: RecordedApiCall['options']) => Promise<unknown>;
  const get = vi.fn((path: string, options: RecordedApiCall['options'] = {}) => {
    if (path === '/reports') return list(options);
    if (path === '/reports/{id}') return detail(options);
    return (rest.get as unknown as Anything)(path, options);
  });
  const post = vi.fn((path: string, options: RecordedApiCall['options'] = {}) => {
    if (path === '/reports/pdf' || path === '/reports/excel') return create(path, options);
    return (rest.post as unknown as Anything)(path, options);
  });
  const put = vi.fn((path: string, options: RecordedApiCall['options'] = {}) => {
    if (path === '/reports/{id}/publication') return publication(options);
    return (rest.put as unknown as Anything)(path, options);
  });
  const download = vi.fn((path: string, options: RecordedApiCall['options'] = {}) => {
    if (path === '/reports/{id}/file') return file(options);
    return Promise.reject(new Error(`Unexpected download of ${path}`));
  });
  const client = { ...rest, get, post, put, download } as unknown as ApiClient;

  const callsTo = (operation: string) => {
    const [method, ...rest2] = operation.split(' ');
    return calls.filter((call) => call.method === method && call.path === rest2.join(' '));
  };

  return {
    state,
    client,
    calls,
    callsTo,
    failNext,
    hold,
    settle,
    downloads,
    get,
    post,
    put,
    download,
  };
}
