// variableForm and variableErrors: the complete write body, the checks of the contract rules and the mapping of
// server errors to the exact field.
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import {
  emptyValues,
  hasErrors,
  toVariableWrite,
  validateVariable,
  valuesFromVariable,
} from '../../modules/variables/variableForm';
import {
  mapVariableError,
  scopeConflictFieldText,
  scopeConflictImpact,
} from '../../modules/variables/variableErrors';
import type { Variable, VariableDependencies } from '../../modules/variables/variableTypes';

const variable: Variable = {
  id: 5,
  applicationId: 1,
  name: 'gUsuario',
  dataType: 'RECORD',
  scope: 'GLOBAL',
  originScreen: { id: 11, name: 'App (OnStart)' },
  fullTraceability: true,
  environments: ['PROD'],
  description: null,
  environmentDetails: [{ environment: 'PROD', notes: 'Loaded from the production list.' }],
  createdAt: '2026-10-03T09:14:00.000Z',
  updatedAt: '2026-10-03T09:14:00.000Z',
};

function apiError(code: string, status: number, details: Record<string, unknown> | null = null) {
  return new ApiError({ status, code, details });
}

describe('form values', () => {
  it('starts with a text variable in DEV', () => {
    const values = emptyValues();
    expect(values.environments.DEV.enabled).toBe(true);
    expect(values.environments.PROD.enabled).toBe(false);
    expect(values.originScreenId).toBe('');
  });

  it('reads the values of a variable, with notes per environment', () => {
    const values = valuesFromVariable(variable);
    expect(values.originScreenId).toBe('11');
    expect(values.environments.DEV).toEqual({ enabled: false, notes: '' });
    expect(values.environments.PROD).toEqual({
      enabled: true,
      notes: 'Loaded from the production list.',
    });
    expect(values.description).toBe('');
  });

  it('builds the COMPLETE write body: nulls for empty text and only the chosen environments', () => {
    const values = valuesFromVariable(variable);
    expect(toVariableWrite(values)).toEqual({
      name: 'gUsuario',
      dataType: 'RECORD',
      scope: 'GLOBAL',
      description: null,
      originScreenId: 11,
      environments: [{ environment: 'PROD', notes: 'Loaded from the production list.' }],
    });
    const second = { ...values, originScreenId: '', description: 'Text' };
    second.environments = {
      DEV: { enabled: true, notes: '' },
      PROD: { enabled: true, notes: 'n' },
    };
    expect(toVariableWrite(second)).toMatchObject({
      description: 'Text',
      originScreenId: null,
      environments: [
        { environment: 'DEV', notes: null },
        { environment: 'PROD', notes: 'n' },
      ],
    });
  });
});

describe('validateVariable (only the rules of the contract)', () => {
  it('accepts a valid form', () => {
    expect(hasErrors(validateVariable({ ...emptyValues(), name: 'gFiltro' }))).toBe(false);
  });

  it('requires the name and checks its length and pattern', () => {
    expect(validateVariable(emptyValues()).name).toBe('Name is required.');
    expect(validateVariable({ ...emptyValues(), name: 'a'.repeat(151) }).name).toBe(
      'Name is too long.',
    );
    expect(validateVariable({ ...emptyValues(), name: '1abc' }).name).toBe(
      "Name isn't in a valid format.",
    );
    expect(validateVariable({ ...emptyValues(), name: 'a b' }).name).toBe(
      "Name isn't in a valid format.",
    );
  });

  it('requires a data type and at least one environment', () => {
    const values = emptyValues();
    values.dataType = '';
    values.environments.DEV.enabled = false;
    const errors = validateVariable({ ...values, name: 'gFiltro' });
    expect(errors.dataType).toBe('Data type is required.');
    expect(errors.environments).toBe('Add at least one item to Environments.');
  });

  it('checks the length of the description and of the notes of a chosen environment', () => {
    const values = { ...emptyValues(), name: 'gFiltro', description: 'x'.repeat(4001) };
    values.environments.DEV.notes = 'n'.repeat(2001);
    const errors = validateVariable(values);
    expect(errors.description).toBe('Description is too long.');
    expect(errors.environmentRows?.DEV).toBe('Notes is too long.');
  });

  it('adds no rule of its own (a name with letters, digits and underscores passes)', () => {
    expect(hasErrors(validateVariable({ ...emptyValues(), name: '_a1_B2' }))).toBe(false);
  });
});

describe('mapVariableError', () => {
  const submitted = toVariableWrite({
    ...valuesFromVariable(variable),
    environments: { DEV: { enabled: true, notes: '' }, PROD: { enabled: true, notes: '' } },
  });

  it('puts DUPLICATE_NAME on the name', () => {
    const errors = mapVariableError(
      apiError('DUPLICATE_NAME', 409, {
        field: 'name',
        type: 'global variable',
        name: 'gUsuario',
        application: 'SAR',
      }),
      submitted,
    );
    expect(errors).toEqual({ name: 'A global variable named gUsuario already exists in SAR.' });
  });

  it('puts both cases of INVALID_ORIGIN_SCREEN on the origin screen', () => {
    expect(
      mapVariableError(
        apiError('INVALID_ORIGIN_SCREEN', 422, { field: 'originScreenId' }),
        submitted,
      ).originScreenId,
    ).toBe('Context variables are created inside a screen, not in App (OnStart).');
    expect(
      mapVariableError(
        apiError('INVALID_ORIGIN_SCREEN', 422, {
          field: 'originScreenId',
          screen: 'Ajena',
          application: 'SAR',
        }),
        submitted,
      ).originScreenId,
    ).toBe('Ajena belongs to another application. Choose a screen of SAR.');
  });

  it('puts CONTEXT_SCREEN_MISMATCH on the origin screen', () => {
    const errors = mapVariableError(
      apiError('CONTEXT_SCREEN_MISMATCH', 422, {
        variable: 'locFiltro',
        originScreenId: 3,
        screen: 'Solicitudes',
      }),
      submitted,
    );
    expect(errors.originScreenId).toBe(
      'locFiltro belongs to Solicitudes. From here you can only write it with Navigate.',
    );
  });

  it('puts a missing origin screen (404) on the origin screen', () => {
    const errors = mapVariableError(
      apiError('NOT_FOUND', 404, { field: 'originScreenId', element: 'screen' }),
      submitted,
    );
    expect(errors.originScreenId).toBe("This screen doesn't exist. It may have been deleted.");
  });

  it('marks the row of a repeated environment (position in the submitted body)', () => {
    const errors = mapVariableError(
      apiError('VALIDATION_ERROR', 400, {
        fields: [{ field: 'environments[1].environment', rule: 'unique', message: 'server text' }],
      }),
      submitted,
    );
    expect(errors.environmentRows).toEqual({
      PROD: 'Environment has repeated values. Each one must be unique.',
    });
  });

  it('maps every validation field to its own field', () => {
    const errors = mapVariableError(
      apiError('VALIDATION_ERROR', 400, {
        fields: [
          { field: 'name', rule: 'pattern', message: 'x' },
          { field: 'dataType', rule: 'enum', message: 'x' },
          { field: 'environments', rule: 'minItems', message: 'x' },
          { field: 'environments[0].notes', rule: 'maxLength', message: 'x' },
          { field: 'description', rule: 'maxLength', message: 'x' },
        ],
      }),
      submitted,
    );
    expect(errors.name).toBe("Name isn't in a valid format.");
    expect(errors.dataType).toBe('Choose one of the available options for Data type.');
    expect(errors.environments).toBe('Add at least one item to Environments.');
    expect(errors.environmentRows?.DEV).toBe('Notes is too long.');
    expect(errors.description).toBe('Description is too long.');
  });

  it('falls back to the form banner for a field the form does not show, and for other codes', () => {
    expect(
      mapVariableError(
        apiError('VALIDATION_ERROR', 400, {
          fields: [{ field: 'applicationId', rule: 'required', message: 'x' }],
        }),
        submitted,
      ).form,
    ).toBe('Check the highlighted fields.');
    expect(mapVariableError(apiError('APPLICATION_ARCHIVED', 422), submitted).form).toBe(
      "This application is archived, so its documentation can't be changed.",
    );
    expect(
      mapVariableError(apiError('SCOPE_CONFLICT', 422, { function: 'Set' }), submitted).form,
    ).toBe(
      "You can't change the scope while collections assign this variable with Set. Update those assignments first.",
    );
  });
});

describe('scopeConflictImpact', () => {
  const dependencies: VariableDependencies = {
    variable: { id: 5, name: 'gUsuario' },
    originScreen: null,
    screens: [],
    components: [],
    collections: [
      {
        id: 1,
        variable: { id: 5, name: 'gUsuario' },
        collection: { id: 20, name: 'colUsuarios' },
        screen: { id: 11, name: 'App (OnStart)' },
        assignmentFunction: 'SET',
        tableFunction: 'First',
        usedIn: 'OnStart',
      },
      {
        id: 2,
        variable: { id: 5, name: 'gUsuario' },
        collection: { id: 20, name: 'colUsuarios' },
        screen: { id: 12, name: 'Inicio' },
        assignmentFunction: 'SET',
        tableFunction: null,
        usedIn: 'OnVisible',
      },
      {
        id: 3,
        variable: { id: 5, name: 'gUsuario' },
        collection: { id: 21, name: 'colOtra' },
        screen: { id: 12, name: 'Inicio' },
        assignmentFunction: 'UPDATE_CONTEXT',
        tableFunction: null,
        usedIn: 'OnVisible',
      },
    ],
  };

  it('counts the assignments of the named function and names each collection once', () => {
    const impact = scopeConflictImpact(
      apiError('SCOPE_CONFLICT', 422, { function: 'Set' }),
      dependencies,
    );
    expect(impact).toEqual({
      functionName: 'Set',
      count: 2,
      collections: [{ id: 20, name: 'colUsuarios' }],
    });
    expect(scopeConflictFieldText(impact!)).toBe('Scope conflicts with 2 Set assignments.');
  });

  it('matches UpdateContext with UPDATE_CONTEXT and uses the singular for one', () => {
    const impact = scopeConflictImpact(
      apiError('SCOPE_CONFLICT', 422, { function: 'UpdateContext' }),
      dependencies,
    );
    expect(impact?.count).toBe(1);
    expect(scopeConflictFieldText(impact!)).toBe(
      'Scope conflicts with 1 UpdateContext assignment.',
    );
  });

  it('is null when the error names no function', () => {
    expect(scopeConflictImpact(apiError('SCOPE_CONFLICT', 422), dependencies)).toBeNull();
  });
});
