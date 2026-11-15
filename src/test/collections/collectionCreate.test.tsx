// New collection modal (S-14n): opening and focus, validation of the contract rules, the complete POST (with the
// arrays that the form does not ask for), the success message, server errors on their exact field or row, archived
// application and offline.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeApplication } from '../helpers/renderApp';
import { renderCollections } from '../helpers/renderCollections';
import { setupUser, type User } from '../helpers/setupUser';

/** The page once the selected application is known (the list is rebuilt when it becomes known). */
async function appReady() {
  await screen.findAllByText(/collections? ·|Read-only: the application is archived/);
}

async function openModal(user: User) {
  await appReady();
  await screen.findByRole('link', { name: 'colActivos' });
  await user.click(screen.getByRole('button', { name: 'New collection' }));
  const dialog = await screen.findByRole('dialog');
  return within(dialog);
}

/** Puts a text in a field in one step: how fast it is typed does not matter in these tests. */
async function fill(user: User, field: HTMLElement, text: string) {
  await user.click(field);
  await user.paste(text);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('New collection modal', () => {
  it('opens over the list with the name focused and closes with Cancel returning the focus', async () => {
    const user = setupUser();
    const { router } = await renderCollections();
    await screen.findByRole('link', { name: 'colActivos' });
    const opener = await screen.findByRole('button', { name: 'New collection' });

    const dialog = await openModal(user);

    expect(screen.getByRole('dialog', { name: /New collection/ })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(dialog.getByLabelText(/^Name\b(?! of)/)).toHaveFocus();
    expect(router.state.location.search).toBe('?new=1');
    expect(dialog.getByText('Unique in SAR')).toBeInTheDocument();
    expect(dialog.getByText('0/150')).toBeInTheDocument();
    expect(dialog.getByText('Add them after creating, from Edit collection.')).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    expect(opener).toHaveFocus();
  });

  it('opens from a link with ?new=1', async () => {
    await renderCollections({ path: '/collections?new=1' });
    await appReady();

    expect(await screen.findByRole('dialog', { name: /New collection/ })).toBeInTheDocument();
  });

  it('checks only the rules of the contract and focuses the first error', async () => {
    const user = setupUser();
    const { api } = await renderCollections();
    const dialog = await openModal(user);
    const name = () => dialog.getByLabelText(/^Name\b(?! of)/);

    await user.click(dialog.getByRole('button', { name: 'Create collection' }));
    expect(await dialog.findByText('Name is required.')).toBeInTheDocument();
    expect(name()).toHaveFocus();
    expect(name()).toHaveAttribute('aria-invalid', 'true');

    await fill(user, name(), '9bad name');
    await user.click(dialog.getByRole('button', { name: 'Create collection' }));
    expect(await dialog.findByText("Name isn't in a valid format.")).toBeInTheDocument();

    await user.clear(name());
    await fill(user, name(), 'colOk');
    await user.click(dialog.getByRole('button', { name: 'Add field' }));
    await user.click(dialog.getByRole('button', { name: 'Create collection' }));
    expect(await dialog.findByText('Name is required.')).toBeInTheDocument();
    expect(dialog.getByLabelText('Name of field 1')).toHaveFocus();

    await user.click(dialog.getByRole('button', { name: 'Remove field 1' }));
    await user.click(dialog.getByRole('checkbox', { name: 'DEV' }));
    await user.click(dialog.getByRole('button', { name: 'Create collection' }));
    expect(await dialog.findByText('Add at least one item to Environments.')).toBeInTheDocument();
    expect(api.callsTo('POST /collections')).toHaveLength(0);
  });

  // The only test of this form that types key by key (the others paste: how fast a text is typed is not their subject).
  it('follows the name key by key: the counter changes with each key and the format error is gone once it is typed right', async () => {
    const user = setupUser();
    const { api } = await renderCollections();
    const dialog = await openModal(user);
    const name = () => dialog.getByLabelText(/^Name\b(?! of)/);

    await user.type(name(), '9bad');
    expect(dialog.getByText('4/150')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Create collection' }));
    expect(await dialog.findByText("Name isn't in a valid format.")).toBeInTheDocument();
    expect(name()).toHaveAttribute('aria-invalid', 'true');

    await user.clear(name());
    await user.type(name(), 'colEscrita');
    expect(dialog.getByText('10/150')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Create collection' }));

    await waitFor(() => {
      expect(api.callsTo('POST /collections')).toHaveLength(1);
    });
    expect(api.callsTo('POST /collections')[0]?.options.body).toMatchObject({ name: 'colEscrita' });
  });

  it('sends the complete POST, says it was created and refreshes the list and the counts', async () => {
    const user = setupUser();
    const { api, router } = await renderCollections();
    const dialog = await openModal(user);

    await fill(user, dialog.getByLabelText(/^Name\b(?! of)/), 'colPedidos');
    expect(dialog.getByText('10/150')).toBeInTheDocument();
    await fill(user, dialog.getByLabelText('Description'), 'Open orders');
    await fill(
      user,
      dialog.getByLabelText('Creation condition'),
      'ClearCollect(colPedidos, Filter(Pedidos, Estado = "Abierto"))',
    );
    await user.click(dialog.getByRole('checkbox', { name: 'PROD' }));
    await user.click(dialog.getByLabelText('Notes for PROD'));
    await user.paste('Only open orders');
    await user.click(dialog.getByRole('button', { name: 'Add field' }));
    await fill(user, dialog.getByLabelText('Name of field 1'), 'Numero');
    await user.selectOptions(dialog.getByLabelText('Data type of field 1'), 'NUMBER');
    await user.click(dialog.getByRole('button', { name: 'Add field' }));
    await fill(user, dialog.getByLabelText('Name of field 2'), 'Cliente');
    await user.click(dialog.getByRole('button', { name: 'Create collection' }));

    await waitFor(() => {
      expect(api.callsTo('POST /collections')).toHaveLength(1);
    });
    // The three arrays travel, also the ones the modal does not ask for; no field carries an id.
    expect(api.callsTo('POST /collections')[0]?.options.body).toEqual({
      applicationId: 1,
      name: 'colPedidos',
      description: 'Open orders',
      creationCondition: 'ClearCollect(colPedidos, Filter(Pedidos, Estado = "Abierto"))',
      environments: [
        { environment: 'DEV', notes: null },
        { environment: 'PROD', notes: 'Only open orders' },
      ],
      fields: [
        { name: 'Numero', dataType: 'NUMBER', description: null, position: 0 },
        { name: 'Cliente', dataType: 'TEXT', description: null, position: 1 },
      ],
      variableAssignments: [],
      derivedFrom: [],
    });
    expect(await screen.findByText('colPedidos created.')).toBeInTheDocument();
    // The modal closes through the URL (?new=1), which the router applies a moment after the toast is drawn.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.search).toBe('');
    expect(await screen.findByRole('link', { name: 'colPedidos' })).toBeInTheDocument();
    expect(await screen.findByText(/5 collections/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/collections\/\d+$/);
    });
  });

  it('puts DUPLICATE_NAME on the name', async () => {
    const user = setupUser();
    await renderCollections();
    const dialog = await openModal(user);

    await fill(user, dialog.getByLabelText(/^Name\b(?! of)/), 'colClientes');
    await user.click(dialog.getByRole('button', { name: 'Create collection' }));

    expect(
      await dialog.findByText('A collection named colClientes already exists in SAR.'),
    ).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Name\b(?! of)/)).toHaveAttribute('aria-invalid', 'true');
    expect(dialog.getByLabelText(/^Name\b(?! of)/)).toHaveFocus();
  });

  it('puts a repeated field name on its row', async () => {
    const user = setupUser();
    await renderCollections();
    const dialog = await openModal(user);

    await fill(user, dialog.getByLabelText(/^Name\b(?! of)/), 'colNueva');
    for (const [number, text] of [
      [1, 'Id'],
      [2, 'Otro'],
      [3, 'Id'],
    ] as const) {
      await user.click(dialog.getByRole('button', { name: 'Add field' }));
      await fill(user, dialog.getByLabelText(`Name of field ${number}`), text);
    }
    await user.click(dialog.getByRole('button', { name: 'Create collection' }));

    const repeated = await dialog.findByLabelText('Name of field 3');
    await waitFor(() => {
      expect(repeated).toHaveAttribute('aria-invalid', 'true');
    });
    expect(repeated).toHaveAccessibleDescription(
      'Name has repeated values. Each one must be unique.',
    );
    expect(dialog.getByLabelText('Name of field 1')).not.toHaveAttribute('aria-invalid');
    expect(repeated).toHaveFocus();
  });

  it('puts the catalog text of an error that points to no field in the form banner', async () => {
    const user = setupUser();
    const { api } = await renderCollections();
    const dialog = await openModal(user);
    api.failNext('POST /collections', new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' }));

    await fill(user, dialog.getByLabelText(/^Name\b(?! of)/), 'colNueva');
    await user.click(dialog.getByRole('button', { name: 'Create collection' }));

    expect(
      await dialog.findByText(
        "This application is archived, so its documentation can't be changed.",
      ),
    ).toBeInTheDocument();
  });

  it('disables creating, with the reason, when the application is archived', async () => {
    await renderCollections({
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
      path: '/collections?new=1',
    });
    await appReady();
    const dialog = within(await screen.findByRole('dialog'));

    const save = dialog.getByRole('button', { name: 'Create collection' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription('Read-only: the application is archived.');
  });

  it('disables creating, with the reason, while the browser is offline', async () => {
    const user = setupUser();
    await renderCollections();
    const dialog = await openModal(user);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const save = dialog.getByRole('button', { name: 'Create collection' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(
      "You're offline. Changes can't be saved until the connection is back.",
    );
  });
});
