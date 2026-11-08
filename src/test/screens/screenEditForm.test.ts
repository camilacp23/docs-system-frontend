// screenEditForm and screenEditErrors: the body of the PUT, the client checks and the placement of server errors.
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import {
  errorTab,
  hasErrors,
  newComponentRow,
  newNavigationRow,
  newUseRow,
  newVariableLinkRow,
  submittedRows,
  toScreenUpdate,
  validateScreenEdit,
  valuesFromScreen,
} from '../../modules/screens/screenEditForm';
import { mapScreenEditError } from '../../modules/screens/screenEditErrors';

import { sampleScreens } from '../helpers/renderScreens';

function detalle() {
  const screen = sampleScreens().find((candidate) => candidate.name === 'Detalle');
  if (screen === undefined) throw new Error('sample screen missing');
  return valuesFromScreen(screen);
}

describe('toScreenUpdate', () => {
  it('sends the four lists, keeps the ids and leaves the origin rows out', () => {
    const values = detalle();
    expect(values.origins).toHaveLength(1);
    const body = toScreenUpdate(values);

    expect(body.name).toBe('Detalle');
    expect(body.template.knownIssues).toBeNull();
    expect(body.components.map((component) => component.id)).toEqual([301, 302, 303]);
    expect(body.components[0]?.uses?.map((use) => use.id)).toEqual([401, 402]);
    expect(body.components[0]?.uses?.[1]).toMatchObject({
      targetType: 'COLLECTION',
      targetId: 11,
      description: 'Reads the client list.',
    });
    // `uses` travels only for the component that has some.
    expect(body.components[1]).not.toHaveProperty('uses');
    expect(body.variableLinks).toEqual([
      { id: 502, variableId: 3, accessMode: 'READ_WRITE', usedIn: 'btnGuardar.OnSelect' },
    ]);
    expect(body.collectionLinks).toHaveLength(1);
    expect(body.navigations).toEqual([
      { id: 701, targetScreenId: 11, description: 'After saving' },
    ]);
  });

  it('sends new rows without id and empty texts as null', () => {
    const values = detalle();
    values.components.push({ ...newComponentRow(), name: 'btnNuevo', type: 'Button' });
    values.navigations.push({ ...newNavigationRow(), targetScreenId: '13' });
    values.miroLink = '';
    const body = toScreenUpdate(values);

    expect(body.components[3]).toEqual({
      name: 'btnNuevo',
      type: 'Button',
      onSelect: null,
      description: null,
    });
    expect(body.navigations[1]).toEqual({ targetScreenId: 13, description: null });
    expect(body.miroLink).toBeNull();
  });
});

describe('validateScreenEdit', () => {
  it('accepts the loaded screen', () => {
    expect(hasErrors(validateScreenEdit(detalle()))).toBe(false);
  });

  it('checks the rules the contract declares, on the exact row', () => {
    const values = detalle();
    values.name = '   ';
    values.miroLink = 'http://miro.com/x';
    values.template.risks = 'x'.repeat(20001);
    const component = { ...newComponentRow(), name: '1bad', type: '' };
    const use = newUseRow();
    component.uses.push(use);
    values.components.push(component);
    values.variableLinks.push({ ...newVariableLinkRow(), usedIn: 'origin' });
    values.navigations.push(newNavigationRow());

    const errors = validateScreenEdit(values);

    expect(errors.name).toBe('Name is required.');
    expect(errors.miroLink).toBe("Miro link isn't in a valid format.");
    expect(errors.template?.risks).toBe('Risks is too long.');
    expect(errors.componentRows?.[component.key]).toMatchObject({
      name: "Name isn't in a valid format.",
      type: 'Type is required.',
      useRows: { [use.key]: { targetId: 'Target is required.' } },
    });
    const link = values.variableLinks[1];
    expect(errors.variableLinkRows?.[link?.key ?? '']).toEqual({
      variableId: 'Variable is required.',
      accessMode: undefined,
      usedIn: "Used in isn't in a valid format.",
    });
    expect(errors.navigationRows).toBeDefined();
    expect(errorTab(errors)).toBe('template');
  });

  it('limits the number of items of each list', () => {
    const values = detalle();
    values.navigations = Array.from({ length: 101 }, () => newNavigationRow());
    const errors = validateScreenEdit(values);
    expect(errors.navigations).toBe('Navigation has too many items.');
    expect(errorTab({ navigations: errors.navigations })).toBe('components');
  });
});

describe('mapScreenEditError', () => {
  const validation = (field: string, rule: string) =>
    new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: { fields: [{ field, rule, message: 'ignored' }] },
    });

  it('translates a position with the rows as they were sent', () => {
    const values = detalle();
    const rows = submittedRows(values);
    // A row added after sending does not move the error.
    values.components.unshift(newComponentRow());

    const errors = mapScreenEditError(validation('components[1].name', 'unique'), rows);
    expect(errors.componentRows?.['component-302']?.name).toBe(
      'Name has repeated values. Each one must be unique.',
    );

    const useErrors = mapScreenEditError(
      validation('components[0].uses[1].targetId', 'unique'),
      rows,
    );
    expect(useErrors.componentRows?.['component-301']?.useRows?.['use-402']?.targetId).toBe(
      'Target has repeated values. Each one must be unique.',
    );
    expect(errorTab(useErrors)).toBe('components');
  });

  it('places the rule self on the target of the navigation', () => {
    const rows = submittedRows(detalle());
    const errors = mapScreenEditError(validation('navigations[0].targetScreenId', 'self'), rows);
    expect(errors.navigationRows?.['navigation-701']?.targetScreenId).toBe(
      "Target screen can't point to itself.",
    );
  });

  it('places a nested id that does not exist (404) on its row with the catalog text', () => {
    const rows = submittedRows(detalle());
    const error = new ApiError({
      status: 404,
      code: 'NOT_FOUND',
      details: { element: 'variable link', id: 9, field: 'variableLinks[0].id' },
    });
    const errors = mapScreenEditError(error, rows);
    expect(errors.variableLinkRows?.['variable-link-502']?.row).toBe(
      "This variable link doesn't exist. It may have been deleted.",
    );
    expect(errorTab(errors)).toBe('links');
  });

  it('places the rule errors of a use and of a link', () => {
    const rows = submittedRows(detalle());
    const cross = mapScreenEditError(
      new ApiError({
        status: 422,
        code: 'CROSS_APPLICATION',
        details: { field: 'components[0].uses[0].targetId' },
      }),
      rows,
    );
    expect(cross.componentRows?.['component-301']?.useRows?.['use-401']?.targetId).toBe(
      'You can only link elements of the same application.',
    );

    const mismatch = mapScreenEditError(
      new ApiError({
        status: 422,
        code: 'CONTEXT_SCREEN_MISMATCH',
        details: {
          field: 'variableLinks[0].variableId',
          variable: 'locOrden',
          screen: 'Inicio',
          originScreenId: 5,
        },
      }),
      rows,
    );
    expect(mismatch.variableLinkRows?.['variable-link-502']?.variableId).toBe(
      'locOrden belongs to Inicio. From here you can only write it with Navigate.',
    );
  });

  it('puts the name errors on the name and the others on the banner', () => {
    const rows = submittedRows(detalle());
    const duplicate = mapScreenEditError(
      new ApiError({
        status: 409,
        code: 'DUPLICATE_NAME',
        details: { field: 'name', type: 'screen', name: 'Inicio', application: 'SAR' },
      }),
      rows,
    );
    expect(duplicate.name).toBe('A screen named Inicio already exists in SAR.');
    expect(
      mapScreenEditError(new ApiError({ status: 422, code: 'APP_CONTEXT_PROTECTED' }), rows).name,
    ).toBe("The App (OnStart) screen can't be renamed.");
    expect(
      mapScreenEditError(new ApiError({ status: 422, code: 'SCREEN_IN_REVIEW' }), rows).form,
    ).toBe('This screen is in review. Edit it after the review, or withdraw it from review.');
    expect(
      mapScreenEditError(new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' }), rows).form,
    ).toBe("This application is archived, so its documentation can't be changed.");
  });

  it('keeps an error whose position is not in the body for the banner', () => {
    const rows = submittedRows(detalle());
    const errors = mapScreenEditError(validation('components[9].name', 'unique'), rows);
    expect(errors.form).toBe('Check the highlighted fields.');
  });
});
