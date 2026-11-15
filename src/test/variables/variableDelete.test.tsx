// Delete a variable (S-13): the impact comes from the dependencies, DELETE, the way back to the list, the
// failures, and the cases where deleting is not offered (Reader, archived application, offline).
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { deleteImpact, impactSummary } from '../../modules/variables/deleteImpact';
import { AUDIT_NOTE_TEXT } from '../../modules/shared/DeleteImpactBody';
import type { VariableDependencies } from '../../modules/variables/variableTypes';
import { makeVariable } from '../helpers/fakeVariablesApi';
import { makeApplication } from '../helpers/renderApp';
import {
  APP_SCREEN,
  SCREEN_DETALLE,
  SCREEN_INICIO,
  renderVariables,
  type RenderVariablesOptions,
} from '../helpers/renderVariables';
import { setupUser, type User } from '../helpers/setupUser';

const GUSUARIO_DEPENDENCIES: VariableDependencies = {
  variable: { id: 1, name: 'gUsuario' },
  originScreen: { id: APP_SCREEN.id, name: 'App (OnStart)' },
  screens: [
    { screen: { id: SCREEN_INICIO.id, name: 'Inicio' }, accessMode: 'READ', usedIn: 'OnVisible' },
    { screen: { id: SCREEN_DETALLE.id, name: 'Detalle' }, accessMode: 'READ', usedIn: 'x' },
  ],
  collections: [
    {
      id: 1,
      variable: { id: 1, name: 'gUsuario' },
      collection: { id: 20, name: 'colUsuarios' },
      screen: { id: APP_SCREEN.id, name: 'App (OnStart)' },
      assignmentFunction: 'SET',
      tableFunction: 'First',
      usedIn: 'OnStart',
    },
  ],
  components: [
    {
      component: { id: 30, name: 'btnGuardar' },
      screen: { id: SCREEN_DETALLE.id, name: 'Detalle' },
      description: null,
    },
  ],
};

const render = (extra: Partial<RenderVariablesOptions> = {}) =>
  renderVariables({ dependencies: { 1: GUSUARIO_DEPENDENCIES }, ...extra });

async function openDelete(user: User, name: string) {
  // A text query is far cheaper than a role query on this big page, so waiting does not slow the page down.
  await screen.findByText(name);
  await user.click(screen.getByRole('button', { name: `Actions for ${name}` }));
  await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
  return within(await screen.findByRole('dialog', { name: `Delete ${name}?` }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deleteImpact', () => {
  it('counts the origin screen as a screen and names each part', () => {
    const impact = deleteImpact(GUSUARIO_DEPENDENCIES);
    expect(impact).toEqual({ screens: 3, collections: 1, components: 1 });
    expect(impactSummary(impact)).toBe(
      'is used in 3 screens, fed from 1 collection and used by 1 component',
    );
  });

  it('leaves out what is zero and reads well with one or two parts', () => {
    expect(impactSummary({ screens: 1, collections: 0, components: 0 })).toBe(
      'is used in 1 screen',
    );
    expect(impactSummary({ screens: 2, collections: 0, components: 4 })).toBe(
      'is used in 2 screens and used by 4 components',
    );
    expect(impactSummary({ screens: 0, collections: 0, components: 0 })).toBeNull();
  });
});

describe('delete from the list', () => {
  it('shows the impact, deletes, and refreshes the list and the counters', async () => {
    const user = setupUser();
    const { api } = await render();
    const dialog = await openDelete(user, 'gUsuario');

    expect(
      await dialog.findByText(
        /is used in 3 screens, fed from 1 collection and used by 1 component\. Those links are deleted too\./,
      ),
    ).toBeInTheDocument();
    expect(dialog.getByText(AUDIT_NOTE_TEXT)).toBeInTheDocument();
    expect(dialog.getByText('gUsuario', { selector: 'span' })).toHaveClass('font-mono');

    await user.click(dialog.getByRole('button', { name: 'Delete variable' }));

    await waitFor(() => {
      expect(api.callsTo('DELETE /variables/{id}')).toHaveLength(1);
    });
    expect(api.callsTo('DELETE /variables/{id}')[0]?.options.path).toEqual({ id: 1 });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('gUsuario deleted.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'gUsuario' })).not.toBeInTheDocument();
    });
    const counts = screen.getByRole('region', { name: 'Variable counts' });
    await waitFor(() => {
      expect(within(counts).getByText('Variables').previousElementSibling).toHaveTextContent('4');
    });
  });

  it('says so when the variable is linked to nothing', async () => {
    const user = setupUser();
    await render();
    const dialog = await openDelete(user, 'gRegistroSel');

    expect(await dialog.findByText(/isn't linked to anything\./)).toBeInTheDocument();
  });

  it('keeps Delete disabled until the impact is known, then enables it', async () => {
    const user = setupUser();
    let gate: { release: () => void } | undefined;
    const { api } = await render({
      prepare: (fake) => {
        gate = fake.hold((call) => call.path === '/variables/{id}/dependencies');
      },
    });
    const dialog = await openDelete(user, 'gUsuario');

    expect(dialog.getByText('Checking what depends on this variable…')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Delete variable' })).toBeDisabled();

    gate?.release();
    await dialog.findByText(/is used in 3 screens/);
    expect(dialog.getByRole('button', { name: 'Delete variable' })).toBeEnabled();
    expect(api.callsTo('DELETE /variables/{id}')).toHaveLength(0);
  });

  it('offers to try again when the impact cannot be read and never deletes blindly', async () => {
    const user = setupUser();
    const { api } = await render({
      prepare: (fake) => {
        fake.failNext(
          'GET /variables/{id}/dependencies',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });
    const dialog = await openDelete(user, 'gUsuario');

    expect(
      await dialog.findByText("Couldn't check what depends on this variable."),
    ).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Delete variable' })).toBeDisabled();

    await user.click(dialog.getByRole('button', { name: 'Try again' }));
    await dialog.findByText(/is used in 3 screens/);
    expect(dialog.getByRole('button', { name: 'Delete variable' })).toBeEnabled();
    expect(api.callsTo('DELETE /variables/{id}')).toHaveLength(0);
  });

  it('cancels and returns the focus to the action button', async () => {
    const user = setupUser();
    const { api } = await render();
    const dialog = await openDelete(user, 'gUsuario');
    await dialog.findByText(/is used in 3 screens/);

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for gUsuario' })).toHaveFocus();
    expect(api.callsTo('DELETE /variables/{id}')).toHaveLength(0);
  });

  it("shows the server's refusal inside the modal and keeps it open", async () => {
    const user = setupUser();
    const { api } = await render();
    api.failNext(
      'DELETE /variables/{id}',
      new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' }),
    );
    const dialog = await openDelete(user, 'gUsuario');
    await dialog.findByText(/is used in 3 screens/);

    await user.click(dialog.getByRole('button', { name: 'Delete variable' }));

    expect(
      await dialog.findByText(
        "This application is archived, so its documentation can't be changed.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'gUsuario' })).toBeInTheDocument();
  });

  it('goes back one page when the last row of a page is deleted', async () => {
    const user = setupUser();
    const many = Array.from({ length: 21 }, (_, index) =>
      makeVariable(100 + index, `v${String(index).padStart(2, '0')}`),
    );
    const { router } = await render({ variables: many, path: '/variables?page=2' });
    const dialog = await openDelete(user, 'v20');
    await dialog.findByText(/isn't linked to anything/);

    await user.click(dialog.getByRole('button', { name: 'Delete variable' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await screen.findByText('Showing 1–20 of 20')).toBeInTheDocument();
  });

  it('disables Delete, with the reason, while the browser is offline', async () => {
    const user = setupUser();
    await render();
    const dialog = await openDelete(user, 'gUsuario');
    await dialog.findByText(/is used in 3 screens/);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(dialog.getByRole('button', { name: 'Delete variable' })).toBeDisabled();
    expect(
      dialog.getByText("You're offline. Changes can't be saved until the connection is back."),
    ).toBeInTheDocument();
  });

  it('disables Edit and Delete in the row menu, with the reason, on an archived application', async () => {
    const user = setupUser();
    await render({ applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })] });
    await screen.findByText('Read-only: the application is archived.');
    await screen.findByText('gUsuario');

    await user.click(screen.getByRole('button', { name: 'Actions for gUsuario' }));

    for (const name of ['Edit', 'Delete']) {
      const item = screen.getByRole('menuitem', { name });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveAttribute('title', 'Read-only: the application is archived.');
    }
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'View' })).toBeEnabled();
  });

  it('offers no actions to the Reader', async () => {
    await render({ role: 'READER' });

    await screen.findByText('gUsuario');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});

describe('delete from the detail', () => {
  it('deletes and goes back to the list', async () => {
    const user = setupUser();
    const { api, router } = await render({ path: '/variables/1' });
    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete gUsuario?' }));
    await dialog.findByText(/is used in 3 screens/);
    await user.click(dialog.getByRole('button', { name: 'Delete variable' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/variables');
    });
    expect(api.callsTo('DELETE /variables/{id}')).toHaveLength(1);
    expect(await screen.findByText('gUsuario deleted.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'gUsuario' })).not.toBeInTheDocument();
    });
  });

  it('disables Delete, with the reason, on an archived application', async () => {
    await render({
      path: '/variables/1',
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });
    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    });

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute(
      'title',
      'Read-only: the application is archived.',
    );
  });

  it('shows no Delete button to the Reader', async () => {
    await render({ path: '/variables/1', role: 'READER' });

    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
