// Message catalog: Table 59 texts with placeholders, silent codes, validation rules, contract consistency.
import { afterEach, describe, expect, it, vi } from 'vitest';

import contractYaml from '../../../contract/openapi.yaml?raw';
import { ApiError, type ErrorDetails } from '../../api/ApiError';
import { getErrorMessage, getFieldErrors, getThrownMessage } from '../../api/messages';

function err(
  code: string,
  details: ErrorDetails | null = null,
  extra: { status?: number; requestId?: string; retry?: number } = {},
) {
  return new ApiError({
    status: extra.status ?? 422,
    code,
    details,
    requestId: extra.requestId ?? null,
    retryAfterSeconds: extra.retry ?? null,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('placeholders', () => {
  it('fills DUPLICATE_NAME with the article, type, name and scope (D-63)', () => {
    expect(
      getErrorMessage(
        err('DUPLICATE_NAME', {
          field: 'name',
          type: 'global variable',
          name: 'gUsuarioActual',
          application: 'SAR',
          container: 'application',
        }),
      ),
    ).toBe('A global variable named gUsuarioActual already exists in SAR.');
    expect(
      getErrorMessage(
        err('DUPLICATE_NAME', {
          type: 'application',
          name: 'SAR',
          application: 'Documentación técnica',
          container: 'system',
        }),
      ),
    ).toBe('An application named SAR already exists in Documentación técnica.');
  });

  it('writes CONTEXT_SCREEN_MISMATCH with an origin screen (D-64)', () => {
    const details = {
      variableId: 15,
      variable: 'locFiltro',
      originScreenId: 3,
      screen: 'Solicitudes',
      screenId: 4,
      targetScreen: 'Detalle',
    };
    expect(getErrorMessage(err('CONTEXT_SCREEN_MISMATCH', details))).toBe(
      'locFiltro belongs to Solicitudes. From here you can only write it with Navigate.',
    );
  });

  it('writes CONTEXT_SCREEN_MISMATCH without an origin screen (D-64)', () => {
    const details = {
      variableId: 15,
      variable: 'locFiltro',
      originScreenId: null,
      screenId: 4,
      targetScreen: 'Detalle',
    };
    expect(getErrorMessage(err('CONTEXT_SCREEN_MISMATCH', details))).toBe(
      'locFiltro has no origin screen. Set its origin screen before linking it.',
    );
  });

  it('fills element, function, fields, key, minutes and reference', () => {
    expect(
      getErrorMessage(err('NOT_FOUND', { element: 'variable', id: 42 }, { status: 404 })),
    ).toBe("This variable doesn't exist. It may have been deleted.");
    expect(
      getErrorMessage(
        err('PRECONDITION_FAILED', { element: 'screen', currentETag: 'W/"1"' }, { status: 412 }),
      ),
    ).toBe(
      'Someone else saved changes to this screen after you opened it. Reload to see their version.',
    );
    expect(getErrorMessage(err('SCOPE_CONFLICT', { function: 'UpdateContext' }))).toBe(
      "You can't change the scope while collections assign this variable with UpdateContext. Update those assignments first.",
    );
    expect(getErrorMessage(err('TEMPLATE_INCOMPLETE', { fields: ['risks', 'knownIssues'] }))).toBe(
      'Complete all seven template fields to submit for review. Missing: risks, knownIssues.',
    );
    expect(getErrorMessage(err('JIRA_PARTIAL_FAILURE', { key: 'TECHEA-2' }, { status: 502 }))).toBe(
      "The story TECHEA-2 was created, but the to-do wasn't. Try again to add it to that story.",
    );
    expect(getErrorMessage(err('RATE_LIMITED', { minutes: 15 }, { status: 429 }))).toBe(
      'Too many attempts. Try again in 15 minutes.',
    );
    expect(getErrorMessage(err('INTERNAL_ERROR', null, { status: 500, requestId: '7f3c2a' }))).toBe(
      'Something went wrong on our side. Try again in a moment. Reference: 7f3c2a.',
    );
  });

  it('takes RATE_LIMITED minutes from Retry-After when details lack them', () => {
    expect(getErrorMessage(err('RATE_LIMITED', null, { status: 429, retry: 600 }))).toBe(
      'Too many attempts. Try again in 10 minutes.',
    );
    expect(getErrorMessage(err('RATE_LIMITED', { minutes: 1 }, { status: 429 }))).toBe(
      'Too many attempts. Try again in 1 minute.',
    );
  });

  it('uses generic element and type when nothing is provided, and the page context when it is', () => {
    expect(getErrorMessage(err('NOT_FOUND', null, { status: 404 }))).toBe(
      "This resource doesn't exist. It may have been deleted.",
    );
    expect(getErrorMessage(err('NOT_FOUND', null, { status: 404 }), { element: 'screen' })).toBe(
      "This screen doesn't exist. It may have been deleted.",
    );
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(
      getErrorMessage(err('DUPLICATE_NAME', { name: 'x', application: 'SAR' }, { status: 409 })),
    ).toBe('An item named x already exists in SAR.');
    expect(
      getErrorMessage(err('DUPLICATE_NAME', { name: 'x', application: 'SAR' }, { status: 409 }), {
        type: 'screen',
      }),
    ).toBe('A screen named x already exists in SAR.');
  });

  it('shows the generic not-found text for NOT_IMPLEMENTED and ROUTE_NOT_FOUND', () => {
    for (const reason of ['NOT_IMPLEMENTED', 'ROUTE_NOT_FOUND']) {
      expect(
        getErrorMessage(
          err('NOT_FOUND', { element: 'resource', id: null, reason }, { status: 404 }),
          { element: 'screen' },
        ),
      ).toBe("This resource doesn't exist. It may have been deleted.");
    }
  });
});

describe('missing values the code requires', () => {
  it('warns in DEV and uses neutral texts', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(getErrorMessage(err('DUPLICATE_NAME', { type: 'screen' }, { status: 409 }))).toBe(
      'A screen named this item already exists in this application.',
    );
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]?.[0])).toContain('DUPLICATE_NAME');

    warn.mockClear();
    expect(getErrorMessage(err('CONTEXT_SCREEN_MISMATCH', { originScreenId: 3 }))).toBe(
      'this variable belongs to its origin screen. From here you can only write it with Navigate.',
    );
    expect(warn).toHaveBeenCalled();
  });

  it('does not warn when the values are present', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getErrorMessage(
      err('DUPLICATE_NAME', { type: 'screen', name: 'a', application: 'b' }, { status: 409 }),
    );
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('silent, local and unknown codes', () => {
  it('returns null for codes the user never sees', () => {
    for (const code of ['UNAUTHENTICATED', 'TOKEN_EXPIRED', 'INVALID_SIGNATURE']) {
      expect(getErrorMessage(err(code, null, { status: 401 }))).toBeNull();
    }
  });

  it('uses the offline banner text for NETWORK_ERROR', () => {
    expect(getErrorMessage(err('NETWORK_ERROR', null, { status: 0 }))).toBe(
      "You're offline. Changes can't be saved until the connection is back.",
    );
  });

  it('uses the internal-error text without the reference when there is no request id', () => {
    const expected = 'Something went wrong on our side. Try again in a moment.';
    expect(getErrorMessage(err('UNEXPECTED_RESPONSE', null, { status: 502 }))).toBe(expected);
    expect(getErrorMessage(err('SOMETHING_NEW', null, { status: 500 }))).toBe(expected);
    expect(getErrorMessage(err('SOMETHING_NEW', null, { status: 500, requestId: 'abc' }))).toBe(
      `${expected} Reference: abc.`,
    );
    expect(getThrownMessage(new Error('boom'))).toBe(expected);
  });

  it('never returns the server message', () => {
    const e = new ApiError({ status: 422, code: 'RESERVED_ACCOUNT' });
    expect(getErrorMessage(e)).toBe("This is a system account and can't be changed.");
  });
});

describe('catalog against the contract', () => {
  it('matches every contract message that has no placeholder', () => {
    const yaml = contractYaml;
    const rows = [...yaml.matchAll(/^ {4}\| ([A-Z_]+) \| (\d+) \| (.+) \|$/gm)];
    expect(rows.length).toBeGreaterThan(25);
    let compared = 0;
    for (const [, code, status, message] of rows) {
      if (!code || !message || message.includes('<') || message.includes('(`details`')) continue;
      if (['UNAUTHENTICATED', 'INVALID_SIGNATURE'].includes(code)) continue;
      expect(getErrorMessage(err(code, null, { status: Number(status) })), code).toBe(message);
      compared++;
    }
    expect(compared).toBeGreaterThan(20);
  });
});

describe('field errors (VALIDATION_ERROR)', () => {
  const validation = (fields: unknown[]) => err('VALIDATION_ERROR', { fields }, { status: 400 });

  it('translates by rule with the label of the screen, ignoring the server text', () => {
    const result = getFieldErrors(
      validation([
        { field: 'name', rule: 'required', message: 'server text 1' },
        { field: 'email', rule: 'format', message: 'server text 2' },
        { field: 'components[0].name', rule: 'unique', message: 'server text 3' },
        { field: 'environments', rule: 'minItems', message: 'x' },
        { field: 'role', rule: 'enum', message: 'x' },
        { field: 'name', rule: 'maxLength', message: 'x' },
        { field: 'jiraProjectKey', rule: 'pattern', message: 'x' },
        { field: 'email', rule: 'CHECK', message: 'x' },
      ]),
      {
        name: 'Name',
        email: 'Email',
        'components[].name': 'Component name',
        environments: 'Environments',
        role: 'Role',
        jiraProjectKey: 'Jira project key',
      },
    );
    expect(result.map((r) => r.message)).toEqual([
      'Name is required.',
      "Email isn't in a valid format.",
      'Component name has repeated values. Each one must be unique.',
      'Add at least one item to Environments.',
      'Choose one of the available options for Role.',
      'Name is too long.',
      "Jira project key isn't in a valid format.",
      "Email doesn't meet the required conditions.",
    ]);
    expect(result.some((r) => r.message.includes('server text'))).toBe(false);
  });

  it('uses a neutral label when the screen gives none, and a fixed text for unknown rules', () => {
    const result = getFieldErrors(
      validation([
        { field: 'x', rule: 'required' },
        { field: 'y', rule: 'somethingNew' },
        { field: 'z' },
      ]),
    );
    expect(result.map((r) => r.message)).toEqual([
      'This field is required.',
      "This value isn't valid.",
      "This value isn't valid.",
    ]);
  });

  it('is empty for other codes or malformed details', () => {
    expect(getFieldErrors(err('FORBIDDEN'))).toEqual([]);
    expect(getFieldErrors(err('VALIDATION_ERROR', { fields: 'nope' }, { status: 400 }))).toEqual(
      [],
    );
    expect(getErrorMessage(validation([]))).toBe('Check the highlighted fields.');
  });
});
