// ApiError: the single error type the API layer throws.
// Props: status (HTTP, 0 when no response), code (server `code`, or a local NETWORK_ERROR / UNEXPECTED_RESPONSE),
// details (server `details` object or null), requestId (body `details.requestId` or X-Request-Id),
// retryAfterSeconds (429 only, from Retry-After). Code never depends on the server `message`: the UI text comes
// from src/api/messages.ts.
import type { components } from './schema';

/** Codes of the contract (`Error.code`). */
export type ServerErrorCode = components['schemas']['Error']['code'];

/** Codes raised by the client itself when there is no usable server answer. */
export type LocalErrorCode = 'NETWORK_ERROR' | 'UNEXPECTED_RESPONSE';

export type ErrorCode = ServerErrorCode | LocalErrorCode;

export type ErrorDetails = Record<string, unknown>;

/** 401 codes that mean "the access token is missing or expired": a refresh may fix them. */
export const TOKEN_REFRESH_CODES: readonly string[] = ['UNAUTHENTICATED', 'TOKEN_EXPIRED'];

export interface ApiErrorInit {
  status: number;
  code: string;
  details?: ErrorDetails | null;
  requestId?: string | null;
  retryAfterSeconds?: number | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetails | null;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(init: ApiErrorInit) {
    // The Error message is only for logs and test output; the UI never shows it.
    super(`${init.code} (HTTP ${init.status})`);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? null;
    this.requestId = init.requestId ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
