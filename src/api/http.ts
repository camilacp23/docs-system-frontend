// http: low-level transport. One fetch, JSON in and out, every failure turned into an ApiError.
// It adds no token and never retries; src/api/client.ts (authenticated calls) and the session manager
// (login, refresh, logout) build on it. Props of rawRequest: method, path (relative to /api/v1, with {param}
// placeholders), pathParams, query, body, token (sent as Bearer), headers, signal.
// GET requests use `cache: 'no-cache'`: the browser always revalidates with the server (If-None-Match from its own
// cache; a 304 reaches JavaScript as a 200 with the cached body) and never serves a copy older than the last PUT.
// Writes carry no cache option. A raw 304 (only when a caller sets If-None-Match itself) is never an error: the
// result has notModified = true and a null body.
import { ApiError, type ErrorDetails } from './ApiError';

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
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    search.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  const qs = search.toString();
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

export async function rawRequest<T = unknown>(request: RawRequest): Promise<HttpResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json', ...request.headers };
  if (request.token) headers.Authorization = `Bearer ${request.token}`;
  let body: string | undefined;
  if (request.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(request.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(request.path, request.pathParams, request.query), {
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
