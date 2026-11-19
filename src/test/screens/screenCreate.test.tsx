// New screen modal (P-03): opening and focus, who sees it, validation of the contract rules, the complete POST
// (template and lists empty), the success message and the navigation to the detail, server errors on their exact
// field, archived application and offline.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeApplication } from '../helpers/renderApp';
import { renderScreens } from '../helpers/renderScreens';
import { setupUser, type User } from '../helpers/setupUser';

/** The page once the selected application is known (the list is rebuilt when it becomes known). */
async function appReady() {
  await screen.findAllByText(
    /their template and the variables and collections they use|Read-only: the application is archived/,
  );
}

async function openModal(user: User) {
  await appReady();
  await screen.findByRole('link', { name: 'Detalle' });
  await user.click(screen.getByRole('button', { name: 'New screen' }));
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

describe('New screen modal', () => {
  it('opens over the list with the name focused and closes with Cancel returning the focus', async () => {
    const user = setupUser();
    const { router } = await renderScreens();
    await screen.findByRole('link', { name: 'Detalle' });
    const opener = await screen.findByRole('button', { name: 'New screen' });

    const dialog = await openModal(user);

    expect(screen.getByRole('dialog', { name: /New screen/ })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(dialog.getByLabelText(/^Name\b/)).toHaveFocus();
    expect(router.state.location.search).toBe('?new=1');
    expect(dialog.getByText('Unique in SAR')).toBeInTheDocument();
    expect(dialog.getByText('0/150')).toBeInTheDocument();
    expect(dialog.getByText('Optional · https only')).toBeInTheDocument();
    expect(dialog.getByText('Status after creating: Undocumented')).toBeInTheDocument();
    const fields = within(dialog.getByRole('list', { name: 'Template fields' }));
    expect(fields.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'OnStart',
      'Working process',
      'Architecture',
      'Data model',
      'Requirements',
      'Known issues',
      'Risks',
    ]);

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    expect(opener).toHaveFocus();
  });

  it('opens from a link with ?new=1 and closes with Escape', async () => {
    const user = setupUser();
    const { router } = await renderScreens({ path: '/screens?new=1' });
    await appReady();

    expect(await screen.findByRole('dialog', { name: /New screen/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.search).toBe('');
  });

  it('is not offered to the Reader, not even with ?new=1', async () => {
    await renderScreens({ role: 'READER', path: '/screens?new=1' });
    await appReady();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New screen' })).not.toBeInTheDocument();
  });

  it('is offered to the Administrator and to the Developer', async () => {
    for (const role of ['ADMINISTRATOR', 'DEVELOPER'] as const) {
      const { unmount } = await renderScreens({ role });
      expect(await screen.findByRole('button', { name: 'New screen' })).toBeEnabled();
      unmount();
    }
  });

  it('checks the name and the https-only link before sending anything', async () => {
    const user = setupUser();
    const { api } = await renderScreens();
    const dialog = await openModal(user);

    await user.click(dialog.getByRole('button', { name: 'Create screen' }));
    expect(dialog.getByText('Name is required.')).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Name\b/)).toHaveFocus();

    await fill(user, dialog.getByLabelText(/^Name\b/), '   ');
    await user.click(dialog.getByRole('button', { name: 'Create screen' }));
    expect(dialog.getByText('Name is required.')).toBeInTheDocument();

    await fill(user, dialog.getByLabelText(/^Name\b/), 'Busqueda2');
    await fill(user, dialog.getByLabelText('Miro link'), 'http://miro.com/app/board/x');
    await user.click(dialog.getByRole('button', { name: 'Create screen' }));
    expect(dialog.getByText("Miro link isn't in a valid format.")).toBeInTheDocument();
    expect(dialog.getByLabelText('Miro link')).toHaveFocus();
    expect(api.callsTo('POST /screens')).toHaveLength(0);
  });

  it('sends the complete POST, goes to the new screen and says it was created', async () => {
    const user = setupUser();
    const { api, router } = await renderScreens();
    const dialog = await openModal(user);

    await fill(user, dialog.getByLabelText(/^Name\b/), '  Ajustes ');
    await fill(user, dialog.getByLabelText('Miro link'), 'https://miro.com/app/board/uX=/');
    expect(dialog.getByText('10/150')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Create screen' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/screens\/\d+$/);
    });
    expect(api.callsTo('POST /screens')[0]?.options.body).toEqual({
      applicationId: 1,
      name: 'Ajustes',
      miroLink: 'https://miro.com/app/board/uX=/',
      template: {
        onStart: null,
        workingProcess: null,
        architecture: null,
        dataModel: null,
        requirements: null,
        knownIssues: null,
        risks: null,
      },
      components: [],
      variableLinks: [],
      collectionLinks: [],
      navigations: [],
    });
    expect(await screen.findByText('Ajustes created.')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('sends a null link when it is left empty', async () => {
    const user = setupUser();
    const { api, router } = await renderScreens();
    const dialog = await openModal(user);

    await fill(user, dialog.getByLabelText(/^Name\b/), 'Ajustes');
    await user.click(dialog.getByRole('button', { name: 'Create screen' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/screens\/\d+$/);
    });
    expect(api.callsTo('POST /screens')[0]?.options.body).toMatchObject({ miroLink: null });
  });

  it('marks the name with the catalog text when it already exists in the application', async () => {
    const user = setupUser();
    const { router } = await renderScreens();
    const dialog = await openModal(user);

    await fill(user, dialog.getByLabelText(/^Name\b/), 'Detalle');
    await user.click(dialog.getByRole('button', { name: 'Create screen' }));

    expect(
      await dialog.findByText('A screen named Detalle already exists in SAR.'),
    ).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Name\b/)).toHaveAttribute('aria-invalid', 'true');
    expect(dialog.getByLabelText(/^Name\b/)).toHaveFocus();
    expect(router.state.location.pathname).toBe('/screens');
  });

  it('does not allow taking the reserved name of App (OnStart)', async () => {
    const user = setupUser();
    await renderScreens();
    const dialog = await openModal(user);

    await fill(user, dialog.getByLabelText(/^Name\b/), 'App (OnStart)');
    await user.click(dialog.getByRole('button', { name: 'Create screen' }));

    expect(
      await dialog.findByText('A screen named App (OnStart) already exists in SAR.'),
    ).toBeInTheDocument();
  });

  it('marks the link when the server rejects its format', async () => {
    const user = setupUser();
    await renderScreens({
      prepare: (api) => {
        api.failNext(
          'POST /screens',
          new ApiError({
            status: 400,
            code: 'VALIDATION_ERROR',
            details: { fields: [{ field: 'miroLink', rule: 'pattern', message: 'server text' }] },
          }),
        );
      },
    });
    const dialog = await openModal(user);

    await fill(user, dialog.getByLabelText(/^Name\b/), 'Ajustes');
    await user.click(dialog.getByRole('button', { name: 'Create screen' }));

    expect(await dialog.findByText("Miro link isn't in a valid format.")).toBeInTheDocument();
    expect(dialog.getByLabelText('Miro link')).toHaveAttribute('aria-invalid', 'true');
    expect(dialog.queryByText('server text')).not.toBeInTheDocument();
  });

  it('shows a refusal that belongs to no field in the form', async () => {
    const user = setupUser();
    await renderScreens({
      prepare: (api) => {
        api.failNext('POST /screens', new ApiError({ status: 403, code: 'FORBIDDEN' }));
      },
    });
    const dialog = await openModal(user);

    await fill(user, dialog.getByLabelText(/^Name\b/), 'Ajustes');
    await user.click(dialog.getByRole('button', { name: 'Create screen' }));

    expect(await dialog.findByText("Your role doesn't allow this action.")).toBeInTheDocument();
  });

  it('keeps the modal and the typed values while the request fails, so it can be sent again', async () => {
    const user = setupUser();
    const { router } = await renderScreens({
      prepare: (api) => {
        api.failNext('POST /screens', new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
      },
    });
    const dialog = await openModal(user);

    await fill(user, dialog.getByLabelText(/^Name\b/), 'Ajustes');
    await user.click(dialog.getByRole('button', { name: 'Create screen' }));
    expect(
      await dialog.findByText('Something went wrong on our side. Try again in a moment.'),
    ).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Name\b/)).toHaveValue('Ajustes');

    await user.click(dialog.getByRole('button', { name: 'Create screen' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/screens\/\d+$/);
    });
  });

  it('disables the button and the modal save, with the reason, when the application is archived', async () => {
    const user = setupUser();
    await renderScreens({
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });
    await appReady();

    const create = screen.getByRole('button', { name: 'New screen' });
    expect(create).toBeDisabled();
    expect(create).toHaveAttribute('title', 'Read-only: the application is archived.');
    expect(user).toBeDefined();
  });

  it('shows the archived reason next to a disabled save when the modal was opened by link', async () => {
    const { api } = await renderScreens({
      path: '/screens?new=1',
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });
    await appReady();
    const dialog = within(await screen.findByRole('dialog'));

    const save = dialog.getByRole('button', { name: 'Create screen' });
    await waitFor(() => {
      expect(save).toBeDisabled();
    });
    expect(save).toHaveAccessibleDescription('Read-only: the application is archived.');
    expect(api.callsTo('POST /screens')).toHaveLength(0);
  });

  it('disables creating, with the reason, while the browser is offline', async () => {
    const user = setupUser();
    await renderScreens();
    const dialog = await openModal(user);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const save = dialog.getByRole('button', { name: 'Create screen' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(
      "You're offline. Changes can't be saved until the connection is back.",
    );
    expect(screen.getByRole('button', { name: 'New screen' })).toBeDisabled();
  });
});
