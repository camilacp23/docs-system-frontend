// Order of the checks of a write in the in-memory APIs (fakeCollectionsApi, fakeVariablesApi). They must answer in the
// order of the real server (D-76 and SDD Table 45): 400 -> 404 -> 422 APPLICATION_ARCHIVED -> 412 -> 422 business
// rules -> 409 DUPLICATE_NAME. The page tests rely on it: a fake that checked in another order would let a test pass
// for a reason the server never produces.
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { CollectionWrite } from '../../modules/collections/collectionTypes';
import type { VariableDependencies, VariableWrite } from '../../modules/variables/variableTypes';
import { makeCollectionsApi } from '../helpers/fakeCollectionsApi';
import { makeVariablesApi } from '../helpers/fakeVariablesApi';
import { makeApplication, makeApplicationsClient } from '../helpers/renderApp';
import { sampleCollections } from '../helpers/renderCollections';
import {
  APP_SCREEN,
  SCREEN_DETALLE,
  SCREEN_INICIO,
  sampleVariables,
} from '../helpers/renderVariables';

const STALE = 'W/"99"';

function collections(archived = false) {
  const apps = makeApplicationsClient([
    makeApplication(1, { name: 'SAR', status: archived ? 'ARCHIVED' : 'ACTIVE' }),
  ]);
  return makeCollectionsApi(apps, {
    collections: sampleCollections(),
    variables: sampleVariables(),
    screens: [APP_SCREEN, SCREEN_INICIO, SCREEN_DETALLE],
  });
}

/** The body of a valid update of colTemporal (id 12); `extra` adds the fault under test. */
const body = (extra: Partial<CollectionWrite> = {}): CollectionWrite => ({
  name: 'colTemporal',
  environments: [{ environment: 'DEV', notes: null }],
  fields: [],
  variableAssignments: [],
  derivedFrom: [],
  ...extra,
});

const WRONG_FUNCTION: CollectionWrite['variableAssignments'] = [
  // gUsuario is a global variable: UpdateContext is a SCOPE_MISMATCH.
  { variableId: 1, screenId: 11, assignmentFunction: 'UPDATE_CONTEXT', usedIn: 'OnVisible' },
];
const REPEATED_NAMES: CollectionWrite['fields'] = [
  { name: 'Id', dataType: 'TEXT' },
  { name: 'Id', dataType: 'TEXT' },
];
const UNKNOWN_NESTED_ID: CollectionWrite['fields'] = [
  { id: 99999, name: 'Otro', dataType: 'TEXT' },
];

async function codeOf(attempt: Promise<unknown>): Promise<string> {
  try {
    await attempt;
  } catch (thrown) {
    if (thrown instanceof ApiError) return thrown.code;
    throw thrown;
  }
  return 'OK';
}

const put = (
  api: ReturnType<typeof collections>,
  payload: CollectionWrite,
  ifMatch?: string,
  id = 12,
) =>
  codeOf(
    api.client.put('/collections/{id}', {
      path: { id },
      body: payload,
      ...(ifMatch && { ifMatch }),
    }),
  );

describe('fakeCollectionsApi: PUT answers in the order of the server', () => {
  it('accepts a valid update (the control of every case below)', async () => {
    expect(await put(collections(), body(), 'W/"1"')).toBe('OK');
  });

  it('400 before 404: a repeated field name wins over an id that does not exist', async () => {
    const api = collections();
    expect(await put(api, body({ fields: [...REPEATED_NAMES, ...UNKNOWN_NESTED_ID] }), STALE)).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('404 before APPLICATION_ARCHIVED: an unknown nested id wins over an archived application', async () => {
    expect(await put(collections(true), body({ fields: UNKNOWN_NESTED_ID }))).toBe('NOT_FOUND');
  });

  it('APPLICATION_ARCHIVED before 412: an archived application with a stale ETag is 422', async () => {
    expect(await put(collections(true), body(), STALE)).toBe('APPLICATION_ARCHIVED');
  });

  it('APPLICATION_ARCHIVED before the business rules', async () => {
    expect(await put(collections(true), body({ variableAssignments: WRONG_FUNCTION }))).toBe(
      'APPLICATION_ARCHIVED',
    );
  });

  it('412 before the business rules: a stale ETag with a SCOPE_MISMATCH is 412', async () => {
    expect(await put(collections(), body({ variableAssignments: WRONG_FUNCTION }), STALE)).toBe(
      'PRECONDITION_FAILED',
    );
  });

  it('the business rule is reported when the ETag is current', async () => {
    expect(await put(collections(), body({ variableAssignments: WRONG_FUNCTION }), 'W/"1"')).toBe(
      'SCOPE_MISMATCH',
    );
  });

  it('412 before 409: a stale ETag with a name already taken is 412', async () => {
    expect(await put(collections(), body({ name: 'colActivos' }), STALE)).toBe(
      'PRECONDITION_FAILED',
    );
  });

  it('the business rules before 409 DUPLICATE_NAME', async () => {
    expect(
      await put(collections(), body({ name: 'colActivos', variableAssignments: WRONG_FUNCTION })),
    ).toBe('SCOPE_MISMATCH');
  });

  it('409 DUPLICATE_NAME when it is the only fault', async () => {
    expect(await put(collections(), body({ name: 'colActivos' }), 'W/"1"')).toBe('DUPLICATE_NAME');
  });

  it('answers 404 for a collection that does not exist, before anything else', async () => {
    expect(await put(collections(true), body(), STALE, 999)).toBe('NOT_FOUND');
  });
});

describe('fakeCollectionsApi: POST and DELETE', () => {
  const create = (api: ReturnType<typeof collections>, payload: CollectionWrite) =>
    codeOf(api.client.post('/collections', { body: { applicationId: 1, ...payload } }));

  it('POST: 400, then 404, then APPLICATION_ARCHIVED, then the business rules, then 409', async () => {
    const archived = collections(true);
    expect(await create(archived, body({ name: 'colNueva', fields: [...REPEATED_NAMES] }))).toBe(
      'VALIDATION_ERROR',
    );
    expect(await create(archived, body({ name: 'colNueva', derivedFrom: [9999] }))).toBe(
      'NOT_FOUND',
    );
    expect(
      await create(archived, body({ name: 'colNueva', variableAssignments: WRONG_FUNCTION })),
    ).toBe('APPLICATION_ARCHIVED');

    const active = collections();
    expect(
      await create(active, body({ name: 'colActivos', variableAssignments: WRONG_FUNCTION })),
    ).toBe('SCOPE_MISMATCH');
    expect(await create(active, body({ name: 'colActivos' }))).toBe('DUPLICATE_NAME');
    expect(await create(active, body({ name: 'colNueva' }))).toBe('OK');
  });

  it('DELETE: APPLICATION_ARCHIVED when the application is archived', async () => {
    expect(
      await codeOf(collections(true).client.delete('/collections/{id}', { path: { id: 12 } })),
    ).toBe('APPLICATION_ARCHIVED');
    expect(
      await codeOf(collections().client.delete('/collections/{id}', { path: { id: 12 } })),
    ).toBe('OK');
  });
});

describe('fakeVariablesApi: PUT answers in the order of the server', () => {
  const dependencies: VariableDependencies = {
    variable: { id: 1, name: 'gUsuario' },
    originScreen: null,
    screens: [],
    components: [],
    collections: [
      {
        id: 1,
        variable: { id: 1, name: 'gUsuario' },
        collection: { id: 20, name: 'colUsuarios' },
        screen: { id: APP_SCREEN.id, name: 'App (OnStart)' },
        assignmentFunction: 'SET',
        tableFunction: null,
        usedIn: 'OnStart',
      },
    ],
  };
  // gUsuario is global and a collection sets it: turning it into a context variable is a SCOPE_CONFLICT.
  const toContext: VariableWrite = {
    name: 'gUsuario',
    dataType: 'RECORD',
    scope: 'CONTEXT',
    description: null,
    originScreenId: SCREEN_INICIO.id,
    environments: [{ environment: 'DEV', notes: null }],
  };

  function variables(archived = false) {
    const apps = makeApplicationsClient([
      makeApplication(1, { name: 'SAR', status: archived ? 'ARCHIVED' : 'ACTIVE' }),
    ]);
    return makeVariablesApi(apps, {
      variables: sampleVariables(),
      screens: [APP_SCREEN, SCREEN_INICIO, SCREEN_DETALLE],
      dependencies: { 1: dependencies },
    });
  }
  const putVariable = (api: ReturnType<typeof variables>, ifMatch: string) =>
    codeOf(api.client.put('/variables/{id}', { path: { id: 1 }, body: toContext, ifMatch }));

  it('412 before the business rules', async () => {
    expect(await putVariable(variables(), STALE)).toBe('PRECONDITION_FAILED');
  });

  it('the business rule when the ETag is current', async () => {
    expect(await putVariable(variables(), 'W/"1"')).toBe('SCOPE_CONFLICT');
  });

  it('APPLICATION_ARCHIVED before 412', async () => {
    expect(await putVariable(variables(true), STALE)).toBe('APPLICATION_ARCHIVED');
  });

  it('POST and DELETE answer APPLICATION_ARCHIVED for an archived application', async () => {
    const archived = variables(true);
    expect(
      await codeOf(
        archived.client.post('/variables', {
          body: { applicationId: 1, ...toContext, name: 'gNueva' },
        }),
      ),
    ).toBe('APPLICATION_ARCHIVED');
    expect(await codeOf(archived.client.delete('/variables/{id}', { path: { id: 1 } }))).toBe(
      'APPLICATION_ARCHIVED',
    );
  });
});
