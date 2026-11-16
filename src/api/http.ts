// http: low-level transport. One fetch, JSON in and out, every failure turned into an ApiError.
// It adds no token and never retries; src/api/client.ts (authenticated calls) and the session manager
// (login, refresh, logout) build on it. Props of rawRequest: method, path (relative to /api/v1, with {param}
// placeholders), pathParams, query, body, token (sent as Bearer), headers, signal.
// GET requests use `cache: 'no-cache'`: the browser always revalidates with the server (If-None-Match from its own
// cache; a 304 reaches JavaScript as a 200 with the cached body) and never serves a copy older than the last PUT.
// Query parameters go through encodeQuery (RFC 3986, lists as comma-separated values).
// rawDownload is the binary variant (a file): the same request and the same ApiError for a non-2xx answer (its JSON body
// is read), but a successful body is a Blob with the Content-Disposition and Content-Type headers.
// Writes carry no cache option. A raw 304 (only when a caller sets If-None-Match itself) is never an error: the
// result has notModified = true and a null body.
import { ApiError, type ErrorDetails } from './ApiError';
import { encodeQuery } from './encodeQuery';

export const API_BASE = '/api/v1';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RawRequest {
  method: HttpMethod;
  path: string;
  pathParams?: Record<string, string | number>;
  query?: Record<string, unknown>;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface HttpResult<T> {
  body: T;
  status: number;
  /** The `ETag` response header (also on 201 and on the 200 of a PUT, to send back as If-Match), or null. */
  etag: string | null;
  location: string | null;
  /** True for a 304: the body is null and the caller keeps the copy it already has. */
  notModified: boolean;
}

function buildUrl(
  path: string,
  pathParams?: Record<string, string | number>,
  query?: Record<string, unknown>,
) {
  const resolved = path.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = pathParams?.[name];
    if (value === undefined) throw new Error(`Missing path parameter "${name}" for ${path}`);
    return encodeURIComponent(String(value));
  });
  const qs = encodeQuery(query);
  return `${API_BASE}${resolved}${qs ? `?${qs}` : ''}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRetryAfter(header: string | null): number | null {
  if (header === null) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

async function readJson(response: Response): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const text = await response.text();
  if (text === '') return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function toApiError(
  response: Response,
  parsed: { ok: true; value: unknown } | { ok: false },
): ApiError {
  const headerRequestId = response.headers.get('X-Request-Id');
  const value = parsed.ok ? parsed.value : null;
  if (!isRecord(value) || typeof value.code !== 'string') {
    // Not the uniform error format (for example an HTML 502 from a proxy).
    return new ApiError({
      status: response.status,
      code: 'UNEXPECTED_RESPONSE',
      requestId: headerRequestId,
    });
  }
  const details: ErrorDetails | null = isRecord(value.details) ? value.details : null;
  const bodyRequestId = typeof details?.requestId === 'string' ? details.requestId : null;
  return new ApiError({
    status: response.status,
    code: value.code,
    details,
    requestId: bodyRequestId ?? headerRequestId,
    retryAfterSeconds:
      response.status === 429 ? parseRetryAfter(response.headers.get('Retry-After')) : null,
  });
}

async function send(request: RawRequest, accept: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: accept, ...request.headers };
  if (request.token) headers.Authorization = `Bearer ${request.token}`;
  let body: string | undefined;
  if (request.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(request.body);
  }
  try {
    return await fetch(buildUrl(request.path, request.pathParams, request.query), {
      method: request.method,
      headers,
      body,
      credentials: 'same-origin',
      ...(request.method === 'GET' ? { cache: 'no-cache' as const } : {}),
      signal: request.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR' });
  }
}

export async function rawRequest<T = unknown>(request: RawRequest): Promise<HttpResult<T>> {
  const response = await send(request, 'application/json');

  if (response.status === 304) {
    return {
      body: null as T,
      status: 304,
      etag: response.headers.get('ETag'),
      location: null,
      notModified: true,
    };
  }

  const parsed = await readJson(response).catch(() => ({ ok: false }) as const);
  if (!response.ok) throw toApiError(response, parsed);
  if (!parsed.ok) throw new ApiError({ status: response.status, code: 'UNEXPECTED_RESPONSE' });
  return {
    body: parsed.value as T,
    status: response.status,
    etag: response.headers.get('ETag'),
    location: response.headers.get('Location'),
    notModified: false,
  };
}

/** A downloaded file: the bytes and the headers that name it. */
export interface DownloadResult {
  blob: Blob;
  contentType: string | null;
  /** The raw `Content-Disposition` header, or null. */
  contentDisposition: string | null;
  etag: string | null;
}

/** The file of a GET (a report). A non-2xx answer is the usual JSON error, so it becomes an ApiError like any other. */
export async function rawDownload(request: RawRequest): Promise<DownloadResult> {
  const response = await send(
    request,
    'application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json',
  );
  if (!response.ok) {
    const parsed = await readJson(response).catch(() => ({ ok: false }) as const);
    throw toApiError(response, parsed);
  }
  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError({ status: response.status, code: 'UNEXPECTED_RESPONSE' });
  }
  return {
    blob,
    contentType: response.headers.get('Content-Type'),
    contentDisposition: response.headers.get('Content-Disposition'),
    etag: response.headers.get('ETag'),
  };
}
