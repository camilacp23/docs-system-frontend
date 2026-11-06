// Edit collection page (S-16, S-44): the form loaded from the collection and the COMPLETE PUT with If-Match: the three
// arrays always travel (an omitted array deletes what exists), existing items keep their id, new ones go without
// one, a removed row is not sent and `position` is the visible order; the errors of the server on the exact field or
// row (by the position of the body that was sent, also after the rows were moved), 412 keeping what the user edited,
// the application archived, offline, and the Reader.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { CollectionWrite } from '../../modules/collections/collectionTypes';
import { makeCollection, makeField } from '../helpers/fakeCollectionsApi';
import { makeApplication } from '../helpers/renderApp';
import { renderCollections, type RenderCollectionsOptions } from '../helpers/renderCollections';

type User = ReturnType<typeof userEvent.setup>;
type Body = Required<CollectionWrite>;

const render = (extra: Partial<RenderCollectionsOptions> = {}) =>
  renderCollections({ path: '/collections/11/edit', ...extra });

/** What the PUT must carry for colClientes when nothing was touched: everything, with the ids of the server. */
const UNTOUCHED_BODY: Body = {
  name: 'colClientes',
  description: 'Active clients shown on the home gallery.',
  creationCondition: 'ClearCollect(colClientes, Filter(Clientes, Activo = true))',
  environments: [
    { environment: 'DEV', notes: null },
    { environment: 'PROD', notes: 'Fewer rows in production.' },
  ],
  fields: [
    { id: 110, name: 'Nombre', dataType: 'TEXT', description: 'Client display name.', position: 0 },
    { id: 111, name: 'Correo', dataType: 'TEXT', description: 'Contact e-mail.', position: 1 },
    { id: 112, name: 'Activo', dataType: 'BOOLEAN', description: 'Active flag.', position: 2 },
    { id: 113, name: 'Saldo', dataType: 'CURRENCY', description: 'Balance.', position: 3 },
  ],
  variableAssignments: [
    {
      id: 120,
      variableId: 3,
      screenId: 11,
      assignmentFunction: 'SET',
      tableFunction: 'First',
      usedIn: 'galClientes.OnSelect',
    },
    {
      id: 121,
      variableId: 4,
      screenId: 12,
      assignmentFunction: 'UPDATE_CONTEXT',
      tableFunction: 'IsEmpty',
      usedIn: 'OnVisible',
    },
    {
      id: 122,
      variableId: 2,
      screenId: 10,
      assignmentFunction: 'SET',
      tableFunction: null,
      usedIn: 'OnStart',
    },
  ],
  derivedFrom: [20],
};

async function ready() {
  await screen.findByRole('heading', { name: /^Edit/ });
  // The selects need their options: the first assignment shows gRegistroSel once the variables are read.
  await waitFor(() => {
    expect(screen.getByLabelText('Variable (assignment 1)')).toHaveValue('3');
  });
  return { save: screen.getByRole('button', { name: 'Save changes' }) };
}

/** Puts a text in a field in one step: how fast it is typed does not matter in these tests. */
async function replaceText(user: User, field: HTMLElement, text: string) {
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

const putCalls = (api: Awaited<ReturnType<typeof render>>['api']) =>
  api.callsTo('PUT /collections/{id}');
const sentBody = (api: Awaited<ReturnType<typeof render>>['api']) =>
  putCalls(api)[0]?.options.body as Body;

const names = (fields: Array<{ name: string }>) => fields.map((field) => field.name);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('edit collection: the form', () => {
  it('loads the complete form of the collection', async () => {
    await render();
    await ready();

    expect(screen.getByRole('heading', { name: /Edit colClientes/ })).toBeInTheDocument();
    const name = screen.getByLabelText(/^Name\b(?! of)/);
    expect(name).toHaveValue('colClientes');
    expect(name).toHaveClass('font-mono');
    expect(screen.getByLabelText('Description')).toHaveValue(
      'Active clients shown on the home gallery.',
    );
    expect(screen.getByLabelText('Creation condition')).toHaveValue(
      'ClearCollect(colClientes, Filter(Clientes, Activo = true))',
    );
    expect(screen.getByRole('checkbox', { name: 'DEV' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'PROD' })).toBeChecked();
    expect(screen.getByLabelText('Notes for PROD')).toHaveValue('Fewer rows in production.');
    // Fields, in the order of `position`.
    for (const [number, field] of [
      [1, 'Nombre'],
      [2, 'Correo'],
      [3, 'Activo'],
      [4, 'Saldo'],
    ] as const) {
      expect(screen.getByLabelText(`Name of field ${number}`)).toHaveValue(field);
    }
    expect(screen.getByLabelText('Data type of field 4')).toHaveValue('CURRENCY');
    expect(screen.getByLabelText('Description of field 1')).toHaveValue('Client display name.');
    // Assignments.
    expect(screen.getByLabelText('Function (assignment 2)')).toHaveValue('UPDATE_CONTEXT');
    expect(screen.getByLabelText('Table function (assignment 1)')).toHaveValue('First');
    expect(screen.getByLabelText('Used in (assignment 1)')).toHaveValue('galClientes.OnSelect');
    expect(screen.getByLabelText('Screen (assignment 3)')).toHaveValue('10');
    // Derived from: the other collections of the application, never this one.
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'colUsuarios' })).toBeChecked();
    });
    expect(screen.getByRole('checkbox', { name: 'colActivos' })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'colClientes' })).not.toBeInTheDocument();
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(await within(breadcrumb).findByRole('link', { name: 'colClientes' })).toHaveAttribute(
      'href',
      '/collections/11',
    );
    expect(within(breadcrumb).getByText('Edit')).toHaveAttribute('aria-current', 'page');
  });

  it('goes back to the detail with Cancel', async () => {
    const user = userEvent.setup();
    const { router } = await render();
    await ready();

    await user.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(router.state.location.pathname).toBe('/collections/11');
  });

  it('shows "doesn\'t exist" for an unknown collection', async () => {
    await render({ path: '/collections/999/edit' });

    expect(await screen.findByText("This collection doesn't exist")).toBeInTheDocument();
  });

  it('offers the select only the variables and screens of the application, with the saved ones chosen', async () => {
    await render();
    await ready();

    const options = within(screen.getByLabelText('Variable (assignment 1)'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([
      'Choose a variable',
      'gFiltroActivo',
      'gRegistroSel',
      'gUsuario',
      'locMostrarDetalle',
      'locOrden',
    ]);
    expect(
      within(screen.getByLabelText('Screen (assignment 1)'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Choose a screen', 'App (OnStart)', 'Inicio', 'Detalle']);
  });
});

describe('edit collection: the PUT is the complete representation', () => {
  it('sends the three arrays, with the ids of the server, even if the user touched nothing', async () => {
    const user = userEvent.setup();
    const { api, router } = await render();
    const { save } = await ready();
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'colUsuarios' })).toBeChecked();
    });

    await user.click(save);

    await waitFor(() => {
      expect(putCalls(api)).toHaveLength(1);
    });
    expect(putCalls(api)[0]?.options.ifMatch).toBe('W/"1"');
    expect(putCalls(api)[0]?.options.path).toEqual({ id: 11 });
    expect(putCalls(api)[0]?.options.body).toEqual(UNTOUCHED_BODY);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/collections/11');
    });
    expect(await screen.findByText('Collection saved.')).toBeInTheDocument();
  });

  it('sends the three arrays when only the description changed', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { save } = await ready();
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'colUsuarios' })).toBeChecked();
    });

    await replaceText(user, screen.getByLabelText('Description'), 'New description');
    await user.click(save);

    await waitFor(() => {
      expect(putCalls(api)).toHaveLength(1);
    });
    expect(sentBody(api)).toEqual({ ...UNTOUCHED_BODY, description: 'New description' });
  });

  it('sends empty arrays, not missing ones, for a collection that has no assignments and no derivations', async () => {
    const user = userEvent.setup();
    const { api } = await render({ path: '/collections/12/edit' });
    await screen.findByRole('heading', { name: /Edit colTemporal/ });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(putCalls(api)).toHaveLength(1);
    });
    const body = sentBody(api);
    expect(body.variableAssignments).toEqual([]);
    expect(body.derivedFrom).toEqual([]);
    expect(body.fields.map((field) => field.id)).toEqual([300, 301]);
  });

  it('sends empty arrays when the user removes every item', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { save } = await ready();
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'colUsuarios' })).toBeChecked();
    });

    for (const label of [
      'Remove field 4',
      'Remove field 3',
      'Remove field 2',
      'Remove field 1',
      'Remove assignment 3',
      'Remove assignment 2',
      'Remove assignment 1',
    ]) {
      await user.click(screen.getByRole('button', { name: label }));
    }
    await user.click(screen.getByRole('checkbox', { name: 'colUsuarios' }));
    await user.click(save);

    await waitFor(() => {
      expect(putCalls(api)).toHaveLength(1);
    });
    expect(sentBody(api)).toMatchObject({ fields: [], variableAssignments: [], derivedFrom: [] });
  });

  it('keeps the id of an edited item and sends new items without id, never a client key', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { save } = await ready();
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'colUsuarios' })).toBeChecked();
    });

    await replaceText(user, screen.getByLabelText('Name of field 2'), 'CorreoElectronico');
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    await replaceText(user, screen.getByLabelText('Name of field 5'), 'Notas');
    await user.click(screen.getByRole('button', { name: 'Add assignment' }));
    await user.selectOptions(screen.getByLabelText('Variable (assignment 4)'), 'gUsuario');
    await user.selectOptions(screen.getByLabelText('Screen (assignment 4)'), 'Inicio');
    await replaceText(user, screen.getByLabelText('Used in (assignment 4)'), 'btnGuardar.OnSelect');
    await user.click(save);

    await waitFor(() => {
      expect(putCalls(api)).toHaveLength(1);
    });
    const body = sentBody(api);
    expect(body.fields[1]).toMatchObject({ id: 111, name: 'CorreoElectronico', position: 1 });
    const created = body.fields[4] as Record<string, unknown>;
    expect(created).toEqual({
      name: 'Notas',
      dataType: 'TEXT',
      description: null,
      position: 4,
    });
    expect(created).not.toHaveProperty('id');
    expect(body.variableAssignments).toHaveLength(4);
    expect(body.variableAssignments[3]).toEqual({
      variableId: 1,
      screenId: 11,
      assignmentFunction: 'SET',
      tableFunction: null,
      usedIn: 'btnGuardar.OnSelect',
    });
    expect(body.variableAssignments[3]).not.toHaveProperty('id');
    // The ids of the rows that already existed are untouched, and nothing local travels.
    expect(body.variableAssignments.slice(0, 3).map((a) => a.id)).toEqual([120, 121, 122]);
    expect(JSON.stringify(body)).not.toMatch(/new-|"key"|field-|assignment-/);
  });

  it('turns the order of the rows into `position` when a field is moved up or down', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { save } = await ready();
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'colUsuarios' })).toBeChecked();
    });

    await user.click(screen.getByRole('button', { name: 'Move field 4 up' }));
    await user.click(screen.getByRole('button', { name: 'Move field 1 down' }));
    // Now: Correo, Nombre, Saldo, Activo.
    expect(
      [1, 2, 3, 4].map(
        (number) => screen.getByLabelText<HTMLInputElement>(`Name of field ${number}`).value,
      ),
    ).toEqual(['Correo', 'Nombre', 'Saldo', 'Activo']);
    await user.click(save);

    await waitFor(() => {
      expect(putCalls(api)).toHaveLength(1);
    });
    expect(sentBody(api).fields.map((field) => [field.id, field.name, field.position])).toEqual([
      [111, 'Correo', 0],
      [110, 'Nombre', 1],
      [113, 'Saldo', 2],
      [112, 'Activo', 3],
    ]);
  });

  it('moves a row with the keyboard, keeps the focus on the button and says the new position', async () => {
    const user = userEvent.setup();
    await render();
    await ready();

    const up = screen.getByRole('button', { name: 'Move field 3 up' });
    up.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByLabelText<HTMLInputElement>('Name of field 2').value).toBe('Activo');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Move field 2 up' })).toHaveFocus();
    });
    expect(screen.getByText('Field Activo moved to position 2 of 4.')).toBeInTheDocument();

    // The first row cannot go up and the last cannot go down.
    expect(screen.getByRole('button', { name: 'Move field 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move field 4 down' })).toBeDisabled();
  });

  it('keeps the focus on the neighbour button when the moved row reaches the edge', async () => {
    const user = userEvent.setup();
    await render();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Move field 2 up' }));

    // Row 1 now: its "up" button is disabled, so the focus goes to its "down" button.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Move field 1 down' })).toHaveFocus();
    });
  });

  it('does not send a removed row and sends the remaining ones with consecutive positions', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { save } = await ready();
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'colUsuarios' })).toBeChecked();
    });

    await user.click(screen.getByRole('button', { name: 'Remove field 2' }));
    await user.click(screen.getByRole('button', { name: 'Remove assignment 1' }));
    await user.click(save);

    await waitFor(() => {
      expect(putCalls(api)).toHaveLength(1);
    });
    const body = sentBody(api);
    expect(body.fields.map((field) => [field.id, field.position])).toEqual([
      [110, 0],
      [112, 1],
      [113, 2],
    ]);
    expect(body.variableAssignments.map((assignment) => assignment.id)).toEqual([121, 122]);
    // The server reconciled by id: the removed items are gone.
    const saved = api.state.collections.find((collection) => collection.id === 11);
    expect(names(saved?.fields ?? [])).toEqual(['Nombre', 'Activo', 'Saldo']);
    expect(saved?.variableAssignments.map((assignment) => assignment.id)).toEqual([121, 122]);
  });

  it('derives from several collections of the application and sends their ids', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { save } = await ready();
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'colUsuarios' })).toBeChecked();
    });

    await user.click(screen.getByRole('checkbox', { name: 'colActivos' }));
    await user.click(screen.getByRole('checkbox', { name: 'colTemporal' }));
    await user.click(save);

    await waitFor(() => {
      expect(putCalls(api)).toHaveLength(1);
    });
    expect(sentBody(api).derivedFrom).toEqual([20, 10, 12]);
  });

  it('suggests the function of the scope of the chosen variable, without blocking another choice', async () => {
    const user = userEvent.setup();
    await render();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Add assignment' }));
    expect(screen.getByLabelText('Function (assignment 4)')).toHaveValue('');
    await user.selectOptions(screen.getByLabelText('Variable (assignment 4)'), 'gUsuario');
    expect(screen.getByLabelText('Function (assignment 4)')).toHaveValue('SET');
    await user.selectOptions(screen.getByLabelText('Variable (assignment 4)'), 'locOrden');
    expect(screen.getByLabelText('Function (assignment 4)')).toHaveValue('UPDATE_CONTEXT');
    // A function chosen by hand is not replaced by the suggestion of another variable.
    await user.selectOptions(screen.getByLabelText('Function (assignment 4)'), 'SET');
    await user.selectOptions(screen.getByLabelText('Variable (assignment 4)'), 'gUsuario');
    expect(screen.getByLabelText('Function (assignment 4)')).toHaveValue('SET');
    // The saved rows are not touched by a suggestion.
    expect(screen.getByLabelText('Function (assignment 2)')).toHaveValue('UPDATE_CONTEXT');
  });

  it('checks only the rules of the contract and lists the controls that need attention', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { save } = await ready();

    await user.clear(screen.getByLabelText(/^Name\b(?! of)/));
    await replaceText(user, screen.getByLabelText('Name of field 3'), '');
    await user.click(screen.getByRole('button', { name: 'Add assignment' }));
    await user.click(save);

    expect(await screen.findByText('6 fields need attention.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name\b(?! of)/)).toHaveFocus();
    expect(screen.getByLabelText(/^Name\b(?! of)/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Name\b(?! of)/)).toHaveAccessibleDescription(
      /Name is required\./,
    );
    expect(screen.getByLabelText('Name of field 3')).toHaveAccessibleDescription(
      'Name is required.',
    );
    expect(screen.getByLabelText('Variable (assignment 4)')).toHaveAccessibleDescription(
      'Variable is required.',
    );
    expect(putCalls(api)).toHaveLength(0);

    // Each entry of the summary is a link to its control.
    const summary = screen
      .getByText('6 fields need attention.')
      .closest('[role="alert"]') as HTMLElement;
    await user.click(within(summary).getByRole('button', { name: 'Name of field 3' }));
    expect(screen.getByLabelText('Name of field 3')).toHaveFocus();
  });
});

describe('edit collection: errors on the exact field or row', () => {
  async function saveWith(
    user: User,
    api: Awaited<ReturnType<typeof render>>['api'],
    error: ApiError,
  ) {
    api.failNext('PUT /collections/{id}', error);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
  }

  it('puts DUPLICATE_NAME on the name', async () => {
    const user = userEvent.setup();
    await render();
    await ready();

    await replaceText(user, screen.getByLabelText(/^Name\b(?! of)/), 'colActivos');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('A collection named colActivos already exists in SAR.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name\b(?! of)/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Name\b(?! of)/)).toHaveFocus();
  });

  it('puts a repeated field name on the row where it was sent, also after the rows were moved', async () => {
    const user = userEvent.setup();
    await render();
    await ready();

    // Saldo goes to the top: Saldo, Nombre, Correo, Activo. Then Correo (row 3) is renamed Saldo: the server finds
    // the repeat at position 2 of the body, which is row 3 now and was row 2 (Correo) when the form was opened.
    await user.click(screen.getByRole('button', { name: 'Move field 4 up' }));
    await user.click(screen.getByRole('button', { name: 'Move field 3 up' }));
    await user.click(screen.getByRole('button', { name: 'Move field 2 up' }));
    expect(screen.getByLabelText<HTMLInputElement>('Name of field 1').value).toBe('Saldo');
    await replaceText(user, screen.getByLabelText('Name of field 4'), 'Saldo');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const repeated = await screen.findByLabelText('Name of field 4');
    await waitFor(() => {
      expect(repeated).toHaveAttribute('aria-invalid', 'true');
    });
    expect(repeated).toHaveAccessibleDescription(
      'Name has repeated values. Each one must be unique.',
    );
    expect(repeated).toHaveFocus();
    for (const number of [1, 2, 3]) {
      expect(screen.getByLabelText(`Name of field ${number}`)).not.toHaveAttribute('aria-invalid');
    }
  });

  it('puts a repeated assignment on its row', async () => {
    const user = userEvent.setup();
    await render();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Add assignment' }));
    await user.selectOptions(screen.getByLabelText('Variable (assignment 4)'), 'gRegistroSel');
    await user.selectOptions(screen.getByLabelText('Screen (assignment 4)'), 'Inicio');
    await replaceText(
      user,
      screen.getByLabelText('Used in (assignment 4)'),
      'galClientes.OnSelect',
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const variable = await screen.findByLabelText('Variable (assignment 4)');
    await waitFor(() => {
      expect(variable).toHaveAccessibleDescription(
        'Assignment has repeated values. Each one must be unique.',
      );
    });
    expect(screen.getByLabelText('Variable (assignment 1)')).not.toHaveAttribute('aria-invalid');
  });

  it('puts SCOPE_MISMATCH on the function of its row', async () => {
    const user = userEvent.setup();
    await render();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Add assignment' }));
    await user.selectOptions(screen.getByLabelText('Variable (assignment 4)'), 'gUsuario');
    await user.selectOptions(screen.getByLabelText('Function (assignment 4)'), 'UPDATE_CONTEXT');
    await user.selectOptions(screen.getByLabelText('Screen (assignment 4)'), 'Inicio');
    await replaceText(user, screen.getByLabelText('Used in (assignment 4)'), 'OnVisible');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const fn = await screen.findByLabelText('Function (assignment 4)');
    await waitFor(() => {
      expect(fn).toHaveAccessibleDescription(
        'Set applies to global variables and UpdateContext to context variables.',
      );
    });
    expect(fn).toHaveFocus();
    expect(screen.getByLabelText('Function (assignment 2)')).not.toHaveAttribute('aria-invalid');
  });

  it('puts CONTEXT_SCREEN_MISMATCH on the screen of its row (a variable with an origin screen)', async () => {
    const user = userEvent.setup();
    await render();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Add assignment' }));
    await user.selectOptions(screen.getByLabelText('Variable (assignment 4)'), 'locOrden');
    await user.selectOptions(screen.getByLabelText('Screen (assignment 4)'), 'Detalle');
    await replaceText(user, screen.getByLabelText('Used in (assignment 4)'), 'OnVisible');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const screenField = await screen.findByLabelText('Screen (assignment 4)');
    await waitFor(() => {
      expect(screenField).toHaveAccessibleDescription(
        'locOrden belongs to Inicio. From here you can only write it with Navigate.',
      );
    });
  });

  it('puts CONTEXT_SCREEN_MISMATCH of a variable without origin screen on the screen of its row', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    await ready();

    await saveWith(
      user,
      api,
      new ApiError({
        status: 422,
        code: 'CONTEXT_SCREEN_MISMATCH',
        details: {
          variableId: 4,
          variable: 'locMostrarDetalle',
          originScreenId: null,
          field: 'variableAssignments[1].screenId',
        },
      }),
    );

    const screenField = await screen.findByLabelText('Screen (assignment 2)');
    await waitFor(() => {
      expect(screenField).toHaveAccessibleDescription(
        'locMostrarDetalle has no origin screen. Set its origin screen before linking it.',
      );
    });
  });

  it('puts CROSS_APPLICATION on the variable, on the screen or on the derivation it points to', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    await ready();

    await saveWith(
      user,
      api,
      new ApiError({
        status: 422,
        code: 'CROSS_APPLICATION',
        details: { field: 'variableAssignments[2].variableId' },
      }),
    );
    const variable = await screen.findByLabelText('Variable (assignment 3)');
    await waitFor(() => {
      expect(variable).toHaveAccessibleDescription(
        'You can only link elements of the same application.',
      );
    });

    await saveWith(
      user,
      api,
      new ApiError({
        status: 422,
        code: 'CROSS_APPLICATION',
        details: { field: 'derivedFrom[0]' },
      }),
    );
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'colActivos' })).toHaveAccessibleDescription(
        'You can only link elements of the same application.',
      );
    });
    // The error of the first save was replaced.
    expect(screen.getByLabelText('Variable (assignment 3)')).not.toHaveAttribute('aria-invalid');
  });

  it('puts the 404 of a nested id on its row, with the catalog text', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    await ready();

    await saveWith(
      user,
      api,
      new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        details: { element: 'collection field', id: 112, field: 'fields[2].id' },
      }),
    );

    const row = await screen.findByLabelText('Name of field 3');
    await waitFor(() => {
      expect(row).toHaveAccessibleDescription(
        "This collection field doesn't exist. It may have been deleted.",
      );
    });

    await saveWith(
      user,
      api,
      new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        details: {
          element: 'variable assignment',
          id: 121,
          field: 'variableAssignments[1].id',
        },
      }),
    );
    const assignment = await screen.findByLabelText('Variable (assignment 2)');
    await waitFor(() => {
      expect(assignment).toHaveAccessibleDescription(
        "This variable assignment doesn't exist. It may have been deleted.",
      );
    });
  });

  it('puts the 404 of a reference that does not exist on the cell it points to', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    await ready();

    await saveWith(
      user,
      api,
      new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        details: { element: 'screen', id: 12, field: 'variableAssignments[1].screenId' },
      }),
    );

    const screenField = await screen.findByLabelText('Screen (assignment 2)');
    await waitFor(() => {
      expect(screenField).toHaveAccessibleDescription(
        "This screen doesn't exist. It may have been deleted.",
      );
    });
  });

  it('puts the rules of derivedFrom (self and unique) and of an environment on their field', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    await ready();

    await saveWith(
      user,
      api,
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        details: {
          fields: [
            { field: 'derivedFrom[0]', rule: 'self', message: 'x' },
            { field: 'environments[1].environment', rule: 'unique', message: 'x' },
          ],
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Derived from can't point to itself.")).toBeInTheDocument();
    });
    expect(
      screen.getByText('Environment has repeated values. Each one must be unique.'),
    ).toBeInTheDocument();
  });

  it('puts an error that points to no field of the form in the form banner', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    await ready();

    await saveWith(user, api, new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' }));

    expect(
      await screen.findByText(
        "This application is archived, so its documentation can't be changed.",
      ),
    ).toBeInTheDocument();
  });
});

describe('edit collection: 412 (S-44)', () => {
  async function otherPersonSaves(api: Awaited<ReturnType<typeof render>>['api']) {
    await api.client.put('/collections/{id}', {
      path: { id: 11 },
      ifMatch: 'W/"1"',
      body: { ...UNTOUCHED_BODY, description: 'Their description' },
    });
  }

  it('keeps what the user edited, disables Save and offers Reload and Keep my changes visible', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { save } = await ready();
    await otherPersonSaves(api);

    await replaceText(user, screen.getByLabelText('Name of field 1'), 'NombreCompleto');
    await user.click(screen.getByRole('button', { name: 'Remove field 4' }));
    await user.click(save);

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(
      'Someone else saved changes to this collection after you opened it. Reload to see their version. Your changes will be lost, so copy anything you need first.',
    );
    expect(within(banner).getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    // Everything the user edited is still there: the new name and the removed row.
    expect(screen.getByLabelText('Name of field 1')).toHaveValue('NombreCompleto');
    expect(screen.queryByLabelText('Name of field 4')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await user.click(within(banner).getByRole('button', { name: 'Keep my changes visible' }));

    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name of field 1')).toHaveValue('NombreCompleto');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAccessibleDescription(
      'Someone else saved changes to this collection after you opened it. Reload to see their version.',
    );
  });

  it('loads the other version with Reload, discarding the edits, and saves with the new ETag', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { save } = await ready();
    await otherPersonSaves(api);

    await replaceText(user, screen.getByLabelText('Name of field 1'), 'NombreCompleto');
    await user.click(save);
    await user.click(await screen.findByRole('button', { name: 'Reload' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Description')).toHaveValue('Their description');
    });
    expect(screen.getByLabelText('Name of field 1')).toHaveValue('Nombre');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(putCalls(api)).toHaveLength(3);
    });
    // The first PUT is the other person's, the second the rejected one and the third carries the new ETag.
    expect(putCalls(api).at(-1)?.options.ifMatch).toBe('W/"2"');
  });
});

describe('edit collection: write blocks and roles', () => {
  it('disables saving with the reason when the application is archived', async () => {
    await render({ applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })] });
    await screen.findByRole('heading', { name: /^Edit/ });

    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription('Read-only: the application is archived.');
  });

  it('disables saving with the reason while the browser is offline', async () => {
    await render();
    await ready();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(
      "You're offline. Changes can't be saved until the connection is back.",
    );
  });

  it('shows "No access" to the Reader', async () => {
    await render({ role: 'READER' });

    expect(
      await screen.findByRole('heading', { name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it('selects the application of the collection when it is not the selected one (D-78)', async () => {
    const other = makeCollection(40, 'colOtra', {
      applicationId: 2,
      fields: [makeField(400, 'Campo', 0)],
    });
    await render({
      path: '/collections/40/edit',
      collections: [other],
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
    });

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
  });

  it('goes back to the list when the application is switched from the shell', async () => {
    const user = userEvent.setup();
    const { router } = await render({
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
    });
    await ready();

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/collections');
    });
  });
});
