// client: authenticated API client typed from the contract (src/api/schema.d.ts).
// createApiClient(port) returns { get, post, put, delete }. Each call sends `Authorization: Bearer <token>`
// from the session port. On a 401 with UNAUTHENTICATED or TOKEN_EXPIRED it asks the port for ONE refresh
// (shared by every concurrent call) and retries ONCE; a second 401 ends the session. The 401 of login and of
// the refresh itself never go through here (see src/session/SessionManager.ts).
// Options per call: path (values for {placeholders}), query, body, ifMatch, signal.
// Result: { body, etag, location, status }. Errors are always ApiError.
import { TOKEN_REFRESH_CODES, isApiError } from './ApiError';
import { rawRequest, type HttpMethod, type HttpResult } from './http';
import type { paths } from './schema';

/** What the client needs from the session. Implemented by SessionManager. */
export interface SessionPort {
  getAccessToken(): string | null;
  /**
   * Returns a valid access token after a 401. `failedToken` is the token the rejected call used: if the session
   * already holds a newer one (another call or tab refreshed), it is returned without calling the API.
   * Rejects with the ApiError of the refresh (REFRESH_INVALID has already ended the session).
   */
  refreshAfterUnauthorized(failedToken: string | null): Promise<string>;
  /** The retried call was rejected again: the session is not usable. */
  endSessionUnauthorized(): void;
}

type Method = 'get' | 'post' | 'put' | 'delete';
type PathsWith<M extends Method> = {
  [P in keyof paths]: paths[P] extends Record<M, unknown> ? P : never;
}[keyof paths];

type OperationOf<P extends keyof paths, M extends Method> = paths[P][M & keyof paths[P]];

type QueryOf<O> = O extends { parameters: { query?: infer Q } } ? Exclude<Q, undefined> : never;
type BodyOf<O> = O extends { requestBody?: { content: { 'application/json': infer B } } }
  ? B
  : never;
type SuccessBodyOf<O> = O extends { responses: infer R }
  ? {
      [S in keyof R & (200 | 201 | 202)]: R[S] extends { content: { 'application/json': infer B } }
        ? B
        : never;
    }[keyof R & (200 | 201 | 202)]
  : never;

export interface RequestOptions<O> {
  /** Values for `{placeholders}` in the path. */
  path?: Record<string, string | number>;
  query?: [QueryOf<O>] extends [never] ? never : QueryOf<O>;
  body?: [BodyOf<O>] extends [never] ? never : BodyOf<O>;
  /** ETag of the last read, sent as If-Match. */
  ifMatch?: string;
  signal?: AbortSignal;
}

export type ApiResult<O> = HttpResult<SuccessBodyOf<O>>;

export interface ApiClient {
  get<P extends PathsWith<'get'>>(
    path: P,
    options?: RequestOptions<OperationOf<P, 'get'>>,
  ): Promise<ApiResult<OperationOf<P, 'get'>>>;
  post<P extends PathsWith<'post'>>(
    path: P,
    options?: RequestOptions<OperationOf<P, 'post'>>,
  ): Promise<ApiResult<OperationOf<P, 'post'>>>;
  put<P extends PathsWith<'put'>>(
    path: P,
    options?: RequestOptions<OperationOf<P, 'put'>>,
  ): Promise<ApiResult<OperationOf<P, 'put'>>>;
  delete<P extends PathsWith<'delete'>>(
    path: P,
    options?: RequestOptions<OperationOf<P, 'delete'>>,
  ): Promise<ApiResult<OperationOf<P, 'delete'>>>;
}

function needsRefresh(error: unknown): boolean {
  return isApiError(error) && error.status === 401 && TOKEN_REFRESH_CODES.includes(error.code);
}

export function createApiClient(port: SessionPort): ApiClient {
  async function send(
    method: HttpMethod,
    path: string,
    options: RequestOptions<never> | undefined,
    token: string | null,
  ) {
    return rawRequest({
      method,
      path,
      pathParams: options?.path,
      query: options?.query,
      body: options?.body,
      token,
      headers: options?.ifMatch ? { 'If-Match': options.ifMatch } : undefined,
      signal: options?.signal,
    });
  }

  async function request(
    method: HttpMethod,
    path: string,
    options: RequestOptions<never> | undefined,
  ) {
    const usedToken = port.getAccessToken();
    try {
      return await send(method, path, options, usedToken);
    } catch (error) {
      if (!needsRefresh(error)) throw error;
      const freshToken = await port.refreshAfterUnauthorized(usedToken);
      try {
        return await send(method, path, options, freshToken);
      } catch (retryError) {
        if (needsRefresh(retryError)) port.endSessionUnauthorized();
        throw retryError;
      }
    }
  }

  const call = (method: HttpMethod) => (path: string, options?: RequestOptions<never>) =>
    request(method, path, options);

  return {
    get: call('GET'),
    post: call('POST'),
    put: call('PUT'),
    delete: call('DELETE'),
  } as unknown as ApiClient;
}
