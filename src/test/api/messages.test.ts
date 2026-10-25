// Message catalog: Table 59 texts with placeholders, silent codes, validation rules, contract consistency.
import { afterEach, describe, expect, it, vi } from 'vitest';

import contractYaml from '../../../contract/openapi.yaml?raw';
import { ApiError, type ErrorDetails } from '../../api/ApiError';
import {
  getErrorField,
  getErrorMessage,
  getFieldErrors,
  getThrownMessage,
} from '../../api/messages';

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
  // Rows with a variant label, e.g. "FORBIDDEN (origin)": the details that select that variant.
  const VARIANT_DETAILS: Record<string, ErrorDetails> = {
    'FORBIDDEN (origin)': { reason: 'ORIGIN' },
  };

  it('matches every contract message that has no placeholder', () => {
    const rows = [
      ...contractYaml.matchAll(/^ {4}\| ([A-Z_]+(?: \([a-z ]+\))?) \| (\d+) \| (.+) \|$/gm),
    ];
    expect(rows.length).toBeGreaterThan(25);
    let compared = 0;
    for (const [, label, status, cell] of rows) {
      // The table cell is "<text> (`details`: ...)": the text alone is what the catalog must produce.
      const message = cell?.replace(/ \(`details`: .*\)$/, '');
      if (!label || !message || message.includes('<')) continue;
      const code = label.split(' ')[0] ?? label;
      if (['UNAUTHENTICATED', 'INVALID_SIGNATURE'].includes(code)) continue;
      const details = VARIANT_DETAILS[label] ?? null;
      expect(getErrorMessage(err(code, details, { status: Number(status) })), label).toBe(message);
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

describe('INVALID_ORIGIN_SCREEN (D-68)', () => {
  const APP_TEXT = 'Context variables are created inside a screen, not in App (OnStart).';

  it('names the screen and the application of the other-application case', () => {
    expect(
      getErrorMessage(
        err('INVALID_ORIGIN_SCREEN', {
          field: 'originScreenId',
          screenId: 9,
          screen: 'Pantalla ajena',
          application: 'SAR',
        }),
      ),
    ).toBe('Pantalla ajena belongs to another application. Choose a screen of SAR.');
  });

  it('uses the App (OnStart) text when screen or application is missing, or details are null', () => {
    expect(getErrorMessage(err('INVALID_ORIGIN_SCREEN', { field: 'originScreenId' }))).toBe(
      APP_TEXT,
    );
    expect(getErrorMessage(err('INVALID_ORIGIN_SCREEN', { screen: 'Pantalla ajena' }))).toBe(
      APP_TEXT,
    );
    expect(getErrorMessage(err('INVALID_ORIGIN_SCREEN', { application: 'SAR' }))).toBe(APP_TEXT);
    expect(getErrorMessage(err('INVALID_ORIGIN_SCREEN', { screen: '', application: 'SAR' }))).toBe(
      APP_TEXT,
    );
    expect(getErrorMessage(err('INVALID_ORIGIN_SCREEN', null))).toBe(APP_TEXT);
  });

  it('does not warn in either case', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getErrorMessage(err('INVALID_ORIGIN_SCREEN', null));
    getErrorMessage(err('INVALID_ORIGIN_SCREEN', { screen: 'a', application: 'b' }));
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('FORBIDDEN (D-77)', () => {
  it('tells the origin case from the role case by details.reason', () => {
    const origin = "This request's origin isn't allowed.";
    const role = "Your role doesn't allow this action.";
    expect(getErrorMessage(err('FORBIDDEN', { reason: 'ORIGIN' }, { status: 403 }))).toBe(origin);
    expect(getErrorMessage(err('FORBIDDEN', { requiredRoles: ['ADMIN'] }, { status: 403 }))).toBe(
      role,
    );
    expect(getErrorMessage(err('FORBIDDEN', null, { status: 403 }))).toBe(role);
    expect(getErrorMessage(err('FORBIDDEN', { reason: 'OTHER' }, { status: 403 }))).toBe(role);
  });
});

describe('DUPLICATE_NAME scopes (D-63, D-69)', () => {
  const dup = (details: ErrorDetails) =>
    getErrorMessage(err('DUPLICATE_NAME', details, { status: 409 }));

  it('reads type, name and scope from details for every container', () => {
    expect(
      dup({
        field: 'name',
        type: 'context variable',
        name: 'locFiltro',
        application: 'Solicitudes',
        container: 'screen',
      }),
    ).toBe('A context variable named locFiltro already exists in Solicitudes.');
    expect(
      dup({
        field: 'name',
        type: 'context variable',
        name: 'locFiltro',
        application: 'SAR',
        container: 'application',
      }),
    ).toBe('A context variable named locFiltro already exists in SAR.');
    expect(
      dup({
        field: 'name',
        type: 'collection',
        name: 'colActivos',
        application: 'SAR',
        container: 'application',
      }),
    ).toBe('A collection named colActivos already exists in SAR.');
  });

  it('writes the text when container is missing and warns when name or application are', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(dup({ type: 'screen', name: 'a', application: 'b' })).toBe(
      'A screen named a already exists in b.',
    );
    expect(warn).not.toHaveBeenCalled();
    expect(dup({ type: 'collection' })).toBe(
      'A collection named this item already exists in this application.',
    );
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('business errors with a field position (D-75, D-76)', () => {
  it('reads details.field and the array position', () => {
    const cases: [string, ErrorDetails, string, number | null][] = [
      [
        'CROSS_APPLICATION',
        { field: 'variableAssignments[1].variableId' },
        'variableAssignments[1].variableId',
        1,
      ],
      ['CROSS_APPLICATION', { field: 'derivedFrom[0]' }, 'derivedFrom[0]', 0],
      [
        'SCOPE_MISMATCH',
        { field: 'variableAssignments[12].assignmentFunction' },
        'variableAssignments[12].assignmentFunction',
        12,
      ],
      [
        'CONTEXT_SCREEN_MISMATCH',
        { field: 'variableAssignments[2].screenId', variable: 'v', originScreenId: null },
        'variableAssignments[2].screenId',
        2,
      ],
      ['INVALID_ORIGIN_SCREEN', { field: 'originScreenId' }, 'originScreenId', null],
      [
        'NOT_FOUND',
        { element: 'collection field', id: 7, field: 'fields[2].id' },
        'fields[2].id',
        2,
      ],
    ];
    for (const [code, details, field, index] of cases) {
      expect(getErrorField(err(code, details)), code).toEqual({ field, index });
    }
  });

  it('is null without details, without field or with a non-text field', () => {
    expect(getErrorField(err('SCOPE_MISMATCH'))).toBeNull();
    expect(getErrorField(err('SCOPE_MISMATCH', { function: 'Set' }))).toBeNull();
    expect(getErrorField(err('SCOPE_MISMATCH', { field: 3 }))).toBeNull();
    expect(getErrorField(err('SCOPE_MISMATCH', { field: '' }))).toBeNull();
  });

  it('keeps the texts of Table 59 and D-64 for these codes', () => {
    expect(
      getErrorMessage(
        err('SCOPE_MISMATCH', { field: 'variableAssignments[0].assignmentFunction' }),
      ),
    ).toBe('Set applies to global variables and UpdateContext to context variables.');
    expect(getErrorMessage(err('CROSS_APPLICATION', { field: 'derivedFrom[0]' }))).toBe(
      'You can only link elements of the same application.',
    );
    expect(getErrorMessage(err('CROSS_APPLICATION', null))).toBe(
      'You can only link elements of the same application.',
    );
    expect(
      getErrorMessage(
        err('CONTEXT_SCREEN_MISMATCH', {
          field: 'variableAssignments[2].screenId',
          variableId: 15,
          variable: 'locFiltro',
          originScreenId: 3,
          screen: 'Solicitudes',
          screenId: 4,
          targetScreen: 'Detalle',
        }),
      ),
    ).toBe('locFiltro belongs to Solicitudes. From here you can only write it with Navigate.');
    expect(
      getErrorMessage(
        err('CONTEXT_SCREEN_MISMATCH', {
          field: 'variableAssignments[2].screenId',
          variable: 'locFiltro',
          originScreenId: null,
        }),
      ),
    ).toBe('locFiltro has no origin screen. Set its origin screen before linking it.');
    expect(getErrorMessage(err('SCOPE_CONFLICT', { function: 'Set' }))).toBe(
      "You can't change the scope while collections assign this variable with Set. Update those assignments first.",
    );
  });

  it('writes the 404 of a nested id from details.element, and generically without it', () => {
    expect(
      getErrorMessage(
        err(
          'NOT_FOUND',
          { element: 'collection field', id: 7, field: 'fields[2].id' },
          { status: 404 },
        ),
      ),
    ).toBe("This collection field doesn't exist. It may have been deleted.");
    expect(
      getErrorMessage(
        err(
          'NOT_FOUND',
          { element: 'variable assignment', id: 7, field: 'variableAssignments[0].id' },
          { status: 404 },
        ),
      ),
    ).toBe("This variable assignment doesn't exist. It may have been deleted.");
    expect(getErrorMessage(err('NOT_FOUND', { field: 'derivedFrom[1]' }, { status: 404 }))).toBe(
      "This resource doesn't exist. It may have been deleted.",
    );
  });
});

describe('field errors: unique and self rules (D-74, D-65)', () => {
  const validation = (fields: unknown[]) => err('VALIDATION_ERROR', { fields }, { status: 400 });

  it('marks the exact position and keeps the unique text without the row', () => {
    const result = getFieldErrors(
      validation([
        { field: 'fields[3].name', rule: 'unique', message: 'x' },
        { field: 'environments[1].environment', rule: 'unique', message: 'x' },
        { field: 'derivedFrom[0]', rule: 'unique', message: 'x' },
        { field: 'name', rule: 'required', message: 'x' },
      ]),
      { 'fields[].name': 'Field name', 'environments[].environment': 'Environment' },
    );
    expect(result).toEqual([
      {
        field: 'fields[3].name',
        index: 3,
        rule: 'unique',
        message: 'Field name has repeated values. Each one must be unique.',
      },
      {
        field: 'environments[1].environment',
        index: 1,
        rule: 'unique',
        message: 'Environment has repeated values. Each one must be unique.',
      },
      {
        field: 'derivedFrom[0]',
        index: 0,
        rule: 'unique',
        message: 'This field has repeated values. Each one must be unique.',
      },
      { field: 'name', index: null, rule: 'required', message: 'This field is required.' },
    ]);
  });

  it('writes the self rule with the label of the screen', () => {
    const fields = [{ field: 'derivedFrom[2]', rule: 'self', message: 'server text' }];
    expect(getFieldErrors(validation(fields), { 'derivedFrom[]': 'Derived from' })).toEqual([
      {
        field: 'derivedFrom[2]',
        index: 2,
        rule: 'self',
        message: "Derived from can't point to itself.",
      },
    ]);
    expect(getFieldErrors(validation(fields))[0]?.message).toBe(
      "This field can't point to itself.",
    );
  });
});
