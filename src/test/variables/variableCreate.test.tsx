// New variable modal (S-12a): opening and focus, validation of the contract rules, the complete POST, the success
// message, the CONTEXT / App (OnStart) rule, server errors on their exact field, archived application and offline.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeApplication } from '../helpers/renderApp';
import { renderVariables } from '../helpers/renderVariables';
import { setupUser, type User } from '../helpers/setupUser';

/** The page once the selected application is known (the list is rebuilt when it becomes known). */
async function appReady() {
  await screen.findAllByText(
    /Global and context variables of|Read-only: the application is archived/,
  );
}

async function openModal(user: User) {
  await appReady();
  await screen.findByText('gUsuario');
  await user.click(screen.getByRole('button', { name: 'New variable' }));
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

describe('New variable modal: where it is created (contract 0.5.0)', () => {
  it('keeps Used in off until an origin screen is chosen, then sends it with the POST', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    const dialog = await openModal(user);
    await user.click(dialog.getByRole('checkbox', { name: 'DEV' }));
    const usedIn = dialog.getByLabelText('Used in');
    expect(usedIn).toBeDisabled();
    expect(dialog.getByText('Choose the origin screen first, or leave this empty.')).toBeVisible();

    await fill(user, dialog.getByLabelText(/^Name/), 'locNueva');
    await user.selectOptions(dialog.getByLabelText('Origin screen'), 'Inicio');
    expect(usedIn).toBeEnabled();
    await fill(user, usedIn, 'btnGuardar.OnSelect');
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));

    await waitFor(() => {
      expect(api.callsTo('POST /variables')).toHaveLength(1);
    });
    expect(api.callsTo('POST /variables')[0]?.options.body).toMatchObject({
      originScreenId: 11,
      originUsedIn: 'btnGuardar.OnSelect',
    });
  });

  it('sends null when it is left empty', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    const dialog = await openModal(user);
    await user.click(dialog.getByRole('checkbox', { name: 'DEV' }));
    await fill(user, dialog.getByLabelText(/^Name/), 'locSola');
    await user.selectOptions(dialog.getByLabelText('Origin screen'), 'Inicio');
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));

    await waitFor(() => {
      expect(api.callsTo('POST /variables')).toHaveLength(1);
    });
    expect(api.callsTo('POST /variables')[0]?.options.body).toMatchObject({ originUsedIn: null });
  });
});

describe('New variable modal', () => {
  it('opens over the list with the name focused and closes with Cancel returning the focus', async () => {
    const user = setupUser();
    const { router } = await renderVariables();
    await appReady();
    const opener = await screen.findByRole('button', { name: 'New variable' });

    const dialog = await openModal(user);

    expect(screen.getByRole('dialog', { name: /New variable/ })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(dialog.getByLabelText(/^Name/)).toHaveFocus();
    expect(router.state.location.search).toBe('?new=1');
    expect(dialog.getByText('Unique in SAR')).toBeInTheDocument();
    expect(dialog.getByText('0/150')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'gUsuario' })).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    expect(opener).toHaveFocus();
  });

  it('traps the focus and closes with Escape', async () => {
    const user = setupUser();
    await renderVariables();
    const dialog = await openModal(user);
    const last = dialog.getByRole('button', { name: 'Create variable' });
    const first = dialog.getByRole('button', { name: 'Close' });

    // Tab from the last control wraps to the first, Shift+Tab from the first wraps to the last.
    last.focus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens from a link with ?new=1', async () => {
    await renderVariables({ path: '/variables?new=1' });
    await appReady();

    expect(await screen.findByRole('dialog', { name: /New variable/ })).toBeInTheDocument();
  });

  it('checks only the rules of the contract and focuses the first error', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    const dialog = await openModal(user);

    await user.click(dialog.getByRole('button', { name: 'Create variable' }));
    expect(await dialog.findByText('Name is required.')).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Name/)).toHaveFocus();
    expect(dialog.getByLabelText(/^Name/)).toHaveAttribute('aria-invalid', 'true');

    await fill(user, dialog.getByLabelText(/^Name/), '9bad name');
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));
    expect(await dialog.findByText("Name isn't in a valid format.")).toBeInTheDocument();

    // No help text about letters or digits: only what the contract declares.
    expect(dialog.queryByText(/digit/i)).not.toBeInTheDocument();

    await user.clear(dialog.getByLabelText(/^Name/));
    await fill(user, dialog.getByLabelText(/^Name/), 'gOk');
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));
    expect(await dialog.findByText('Add at least one item to Environments.')).toBeInTheDocument();
    expect(api.callsTo('POST /variables')).toHaveLength(0);
  });

  // The only test of this form that types key by key (the others paste: how fast a text is typed is not their subject).
  it('follows the name key by key: the counter changes with each key and the format error is gone once it is typed right', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    const dialog = await openModal(user);

    await user.type(dialog.getByLabelText(/^Name/), '9bad');
    expect(dialog.getByText('4/150')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));
    expect(await dialog.findByText("Name isn't in a valid format.")).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Name/)).toHaveAttribute('aria-invalid', 'true');

    await user.clear(dialog.getByLabelText(/^Name/));
    await user.type(dialog.getByLabelText(/^Name/), 'gEscrita');
    expect(dialog.getByText('8/150')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));

    // The name is accepted now: the next rule that fails is another field's.
    expect(await dialog.findByText('Add at least one item to Environments.')).toBeInTheDocument();
    expect(dialog.queryByText("Name isn't in a valid format.")).not.toBeInTheDocument();
    expect(api.callsTo('POST /variables')).toHaveLength(0);
  });

  it('sends the complete POST, says it was created and refreshes the list and the counters', async () => {
    const user = setupUser();
    const { api, router } = await renderVariables();
    const dialog = await openModal(user);
    await user.click(dialog.getByRole('checkbox', { name: 'DEV' }));

    await fill(user, dialog.getByLabelText(/^Name/), 'gFechaFiltro');
    expect(dialog.getByText('12/150')).toBeInTheDocument();
    await user.selectOptions(dialog.getByLabelText(/^Data type/), 'DATE');
    await user.selectOptions(dialog.getByLabelText('Origin screen'), 'Inicio');
    await user.click(dialog.getByRole('checkbox', { name: 'PROD' }));
    await user.click(dialog.getByLabelText('Notes for PROD'));
    await user.paste('Loaded from the production list.');
    await user.click(dialog.getByLabelText('Description'));
    await user.paste('Filter date');
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));

    await waitFor(() => {
      expect(api.callsTo('POST /variables')).toHaveLength(1);
    });
    expect(api.callsTo('POST /variables')[0]?.options.body).toEqual({
      applicationId: 1,
      name: 'gFechaFiltro',
      dataType: 'DATE',
      scope: 'GLOBAL',
      description: 'Filter date',
      originScreenId: 11,
      originUsedIn: null,
      environments: [
        { environment: 'DEV', notes: null },
        { environment: 'PROD', notes: 'Loaded from the production list.' },
      ],
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('gFechaFiltro created.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'gFechaFiltro' })).toBeInTheDocument();
    const counts = screen.getByRole('region', { name: 'Variable counts' });
    await waitFor(() => {
      expect(within(counts).getByText('Variables').previousElementSibling).toHaveTextContent('6');
    });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(router.state.location.pathname).toBe('/variables/1000');
  });

  it('sends null for empty description, no origin and notes', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    const dialog = await openModal(user);
    await user.click(dialog.getByRole('checkbox', { name: 'DEV' }));

    await fill(user, dialog.getByLabelText(/^Name/), 'gSimple');
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));

    await waitFor(() => {
      expect(api.callsTo('POST /variables')).toHaveLength(1);
    });
    expect(api.callsTo('POST /variables')[0]?.options.body).toMatchObject({
      description: null,
      originScreenId: null,
      environments: [{ environment: 'DEV', notes: null }],
    });
  });

  it('does not let a context variable use App (OnStart) and says why', async () => {
    const user = setupUser();
    await renderVariables();
    const dialog = await openModal(user);
    const origin = dialog.getByLabelText('Origin screen');

    await user.selectOptions(origin, 'App (OnStart)');
    expect(origin).toHaveValue('10');
    await user.click(dialog.getByRole('radio', { name: 'Context (UpdateContext)' }));

    // The App (OnStart) choice is dropped and the option is disabled with the explanation.
    expect(origin).toHaveValue('');
    expect(dialog.getByRole('option', { name: 'App (OnStart)' })).toBeDisabled();
    expect(
      dialog.getByText(/Context variables can't originate in App \(OnStart\)\./),
    ).toBeInTheDocument();
    expect(
      dialog.getByText('Context variables exist only in the screen where they are created.'),
    ).toBeInTheDocument();

    await user.click(dialog.getByRole('radio', { name: 'Global (Set)' }));
    expect(dialog.getByRole('option', { name: 'App (OnStart)' })).toBeEnabled();
  });

  it('shows DUPLICATE_NAME on the name field and keeps what was typed', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    const dialog = await openModal(user);
    await user.click(dialog.getByRole('checkbox', { name: 'DEV' }));
    api.failNext(
      'POST /variables',
      new ApiError({
        status: 409,
        code: 'DUPLICATE_NAME',
        details: {
          field: 'name',
          type: 'global variable',
          name: 'gUsuario',
          application: 'SAR',
          container: 'application',
        },
      }),
    );

    await fill(user, dialog.getByLabelText(/^Name/), 'gUsuario');
    await fill(user, dialog.getByLabelText('Description'), 'Keep me');
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));

    const message = await dialog.findByText(
      'A global variable named gUsuario already exists in SAR.',
    );
    expect(dialog.getByLabelText(/^Name/)).toHaveAccessibleDescription(
      expect.stringContaining(message.textContent ?? ''),
    );
    expect(dialog.getByLabelText(/^Name/)).toHaveFocus();
    expect(dialog.getByLabelText('Description')).toHaveValue('Keep me');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows INVALID_ORIGIN_SCREEN on the origin screen field', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    const dialog = await openModal(user);
    await user.click(dialog.getByRole('checkbox', { name: 'DEV' }));
    api.failNext(
      'POST /variables',
      new ApiError({
        status: 422,
        code: 'INVALID_ORIGIN_SCREEN',
        details: { field: 'originScreenId', screen: 'Ajena', application: 'SAR' },
      }),
    );

    await fill(user, dialog.getByLabelText(/^Name/), 'gNueva');
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));

    expect(
      await dialog.findByText('Ajena belongs to another application. Choose a screen of SAR.'),
    ).toBeInTheDocument();
    expect(dialog.getByLabelText('Origin screen')).toHaveAttribute('aria-invalid', 'true');
  });

  it('marks the row of a repeated environment from the position the server reports', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    const dialog = await openModal(user);
    await user.click(dialog.getByRole('checkbox', { name: 'DEV' }));
    api.failNext(
      'POST /variables',
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        details: {
          fields: [
            { field: 'environments[1].environment', rule: 'unique', message: 'server text' },
          ],
        },
      }),
    );

    await fill(user, dialog.getByLabelText(/^Name/), 'gNueva');
    await user.click(dialog.getByRole('checkbox', { name: 'PROD' }));
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));

    const message = await dialog.findByText(
      'Environment has repeated values. Each one must be unique.',
    );
    expect(dialog.getByLabelText('Notes for PROD')).toHaveAccessibleDescription(
      message.textContent ?? '',
    );
  });

  it('shows the field messages of a VALIDATION_ERROR by rule, never the server text', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    const dialog = await openModal(user);
    await user.click(dialog.getByRole('checkbox', { name: 'DEV' }));
    api.failNext(
      'POST /variables',
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        details: { fields: [{ field: 'description', rule: 'maxLength', message: 'server text' }] },
      }),
    );

    await fill(user, dialog.getByLabelText(/^Name/), 'gNueva');
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));

    expect(await dialog.findByText('Description is too long.')).toBeInTheDocument();
    expect(screen.queryByText('server text')).not.toBeInTheDocument();
  });

  it('shows the message of APPLICATION_ARCHIVED when the server refuses', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    const dialog = await openModal(user);
    await user.click(dialog.getByRole('checkbox', { name: 'DEV' }));
    api.failNext('POST /variables', new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' }));

    await fill(user, dialog.getByLabelText(/^Name/), 'gNueva');
    await user.click(dialog.getByRole('button', { name: 'Create variable' }));

    expect(
      await dialog.findByText(
        "This application is archived, so its documentation can't be changed.",
      ),
    ).toBeInTheDocument();
  });

  it('disables creating, with the reason, when the application is archived', async () => {
    await renderVariables({
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });

    await appReady();
    const button = await screen.findByRole('button', { name: 'New variable' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Read-only: the application is archived.');
  });

  it('disables saving, with the reason, when a link opens the modal on an archived application', async () => {
    await renderVariables({
      path: '/variables?new=1',
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });

    await appReady();
    const dialog = within(await screen.findByRole('dialog'));
    const save = dialog.getByRole('button', { name: 'Create variable' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription('Read-only: the application is archived.');
  });

  it('disables saving, with the reason, while the browser is offline', async () => {
    const user = setupUser();
    await renderVariables();
    const dialog = await openModal(user);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const save = dialog.getByRole('button', { name: 'Create variable' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(
      "You're offline. Changes can't be saved until the connection is back.",
    );
  });

  it('offers no creation to the Reader, not even through the link', async () => {
    await renderVariables({ role: 'READER', path: '/variables?new=1' });

    await screen.findByText('gUsuario');
    expect(screen.queryByRole('button', { name: 'New variable' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
