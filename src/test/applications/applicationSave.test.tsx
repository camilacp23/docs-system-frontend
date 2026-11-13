// Register and edit an application (S-08, S-44): the modal and its focus, validation of the contract rules, the POST
// and the PUT bodies (only the declared fields, every one of them, with If-Match), DUPLICATE_NAME with
// "Documentación técnica" as the scope, the 412 that keeps what was typed, and the shell that follows the change
// without reloading the page (selector and application card).
import {
  act,
  screen,
  waitFor,
  within,
  type BoundFunctions,
  type queries,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { renderApplications } from '../helpers/renderApplications';
import { setupSettledUser, type User } from '../helpers/setupUser';

type Scope = BoundFunctions<typeof queries>;

afterEach(() => {
  vi.restoreAllMocks();
});

async function openRegister(user: User) {
  await screen.findByRole('rowheader', { name: 'SAR' });
  await user.click(screen.getByRole('button', { name: 'Register application' }));
  return within(await screen.findByRole('dialog', { name: 'Register application' }));
}

async function openEdit(user: User, rowName: string) {
  const row = (await screen.findByRole('rowheader', { name: rowName })).closest(
    'tr',
  ) as HTMLElement;
  await user.click(within(row).getByRole('button', { name: `Actions for ${rowName}` }));
  await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
  const dialog = within(await screen.findByRole('dialog', { name: 'Edit application' }));
  await waitFor(() => {
    expect(dialog.getByLabelText(/^Name/)).toBeEnabled();
  });
  return dialog;
}

async function fill(user: User, field: HTMLElement, text: string) {
  await user.click(field);
  await user.paste(text);
}

async function replace(user: User, field: HTMLElement, text: string) {
  await user.clear(field);
  await fill(user, field, text);
}

async function fillRegister(
  user: User,
  dialog: Scope,
  values: { name?: string; platform?: string; key?: string; description?: string } = {},
) {
  await fill(user, dialog.getByLabelText(/^Name/), values.name ?? 'Application D');
  await fill(user, dialog.getByLabelText(/^Platform/), values.platform ?? 'Power Apps');
  if (values.key) await fill(user, dialog.getByLabelText('Jira project key'), values.key);
  if (values.description)
    await fill(user, dialog.getByLabelText('Description'), values.description);
}

describe('Register application modal', () => {
  it('opens over the list with the name focused and the texts of the frame', async () => {
    const user = setupSettledUser();
    const { router } = await renderApplications();
    const dialog = await openRegister(user);

    expect(dialog.getByLabelText(/^Name/)).toHaveFocus();
    expect(router.state.location.search).toBe('?new=1');
    expect(dialog.getByText('Unique in the department.')).toBeInTheDocument();
    expect(dialog.getByText('0/120')).toBeInTheDocument();
    expect(dialog.getByText('0/60')).toBeInTheDocument();
    expect(dialog.getByText('e.g. Power Apps')).toBeInTheDocument();
    expect(dialog.getByLabelText('Description')).toHaveAttribute(
      'placeholder',
      'What the application does and who uses it',
    );
    expect(
      dialog.getByText('An App (OnStart) screen is created automatically for the new application.'),
    ).toBeInTheDocument();
    expect(
      dialog.getByText('Leave empty to use the default project (TECHEA).'),
    ).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('button', { name: 'Register application' })).toHaveFocus();
  });

  it('checks the form before sending, with the text of the frame for the Jira key', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    const dialog = await openRegister(user);
    await fill(user, dialog.getByLabelText('Jira project key'), 'app-d');

    await user.click(dialog.getByRole('button', { name: 'Register application' }));

    expect(await dialog.findByText('Name is required.')).toBeInTheDocument();
    expect(dialog.getByText('Platform is required.')).toBeInTheDocument();
    expect(
      dialog.getByText(
        'Use 2–20 uppercase letters, digits or _ starting with a letter, e.g. TECHEA.',
      ),
    ).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Name/)).toHaveFocus();
    expect(dialog.getByLabelText('Jira project key')).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo('POST /applications')).toHaveLength(0);
  });

  it('registers with only the declared fields, null for what was left empty, and says so', async () => {
    const user = setupSettledUser();
    const { api, router } = await renderApplications();
    const dialog = await openRegister(user);
    await fillRegister(user, dialog, { name: '  Application D ' });

    await user.click(dialog.getByRole('button', { name: 'Register application' }));

    expect(await screen.findByText('Application D created.')).toBeInTheDocument();
    expect(api.callsTo('POST /applications')[0]?.options.body).toEqual({
      name: 'Application D',
      platform: 'Power Apps',
      description: null,
      jiraProjectKey: null,
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.search).toBe('');
    expect(await screen.findByRole('rowheader', { name: 'Application D' })).toBeInTheDocument();
    expect(await screen.findByText('4 applications · 1 archived')).toBeInTheDocument();
  });

  it('registers with a Jira project key and a description', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    const dialog = await openRegister(user);
    await fillRegister(user, dialog, { key: 'APPD', description: 'Tracks requests' });

    await user.click(dialog.getByRole('button', { name: 'Register application' }));

    await screen.findByText('Application D created.');
    expect(api.callsTo('POST /applications')[0]?.options.body).toEqual({
      name: 'Application D',
      platform: 'Power Apps',
      description: 'Tracks requests',
      jiraProjectKey: 'APPD',
    });
    const row = (await screen.findByRole('rowheader', { name: 'Application D' })).closest(
      'tr',
    ) as HTMLElement;
    expect(within(row).getByText('APPD')).toBeInTheDocument();
  });

  it('the new application appears in the selector of the sidebar without reloading the page', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    const dialog = await openRegister(user);
    await fillRegister(user, dialog);

    await user.click(dialog.getByRole('button', { name: 'Register application' }));
    await screen.findByText('Application D created.');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    const sidebar = within(screen.getByRole('complementary', { name: 'Sidebar' }));
    await user.click(await sidebar.findByRole('button', { name: 'Switch application' }));
    const list = within(await sidebar.findByRole('list', { name: 'Applications' }));
    expect(await list.findByRole('button', { name: /Application D/ })).toBeInTheDocument();
    // The shell read the list again; nothing reloaded the page.
    expect(api.callsTo('GET /applications').length).toBeGreaterThan(2);
  });

  it('DUPLICATE_NAME goes under the name with "Documentación técnica" as the scope', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    const dialog = await openRegister(user);
    await fillRegister(user, dialog, { name: 'SAR' });

    await user.click(dialog.getByRole('button', { name: 'Register application' }));

    const text = 'An application named SAR already exists in Documentación técnica.';
    expect(await dialog.findByText(text)).toBeInTheDocument();
    const name = dialog.getByLabelText(/^Name/);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription(expect.stringContaining(text));
    expect(name).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Register application' })).toBeInTheDocument();
    expect(dialog.getByLabelText<HTMLInputElement>(/^Platform/).value).toBe('Power Apps');
    expect(api.callsTo('POST /applications')).toHaveLength(1);
  });

  it('VALIDATION_ERROR from the server marks each field it names, by rule', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    const dialog = await openRegister(user);
    await fillRegister(user, dialog);
    api.failNext(
      'POST /applications',
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        details: {
          fields: [
            { field: 'name', rule: 'maxLength', message: 'server text' },
            { field: 'jiraProjectKey', rule: 'pattern', message: 'server text' },
          ],
        },
      }),
    );

    await user.click(dialog.getByRole('button', { name: 'Register application' }));

    expect(await dialog.findByText('Name is too long.')).toBeInTheDocument();
    expect(
      dialog.getByText(
        'Use 2–20 uppercase letters, digits or _ starting with a letter, e.g. TECHEA.',
      ),
    ).toBeInTheDocument();
    expect(dialog.queryByText('server text')).not.toBeInTheDocument();
  });

  it('shows any other refusal in the banner of the form', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    const dialog = await openRegister(user);
    await fillRegister(user, dialog);
    api.failNext('POST /applications', new ApiError({ status: 403, code: 'FORBIDDEN' }));

    await user.click(dialog.getByRole('button', { name: 'Register application' }));

    expect(await dialog.findByText("Your role doesn't allow this action.")).toBeInTheDocument();
  });

  it('disables registering, with the reason, while offline', async () => {
    const user = setupSettledUser();
    await renderApplications();
    const dialog = await openRegister(user);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(dialog.getByRole('button', { name: 'Register application' })).toBeDisabled();
    });
    expect(dialog.getAllByText(/You're offline/).length).toBeGreaterThan(0);
  });
});

describe('Edit application modal', () => {
  it('reads the application and shows its values', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    const dialog = await openEdit(user, 'Application B');

    expect(api.callsTo('GET /applications/{id}')[0]?.options.path).toEqual({ id: 2 });
    expect(dialog.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('Application B');
    expect(dialog.getByLabelText<HTMLInputElement>(/^Platform/).value).toBe('Power Apps');
    expect(dialog.getByLabelText<HTMLInputElement>('Jira project key').value).toBe('APPB');
    expect(dialog.getByLabelText(/^Name/)).toHaveFocus();
    expect(screen.getByText('Last updated 2026-10-02 09:40')).toBeInTheDocument();
    expect(dialog.queryByText(/created automatically/)).not.toBeInTheDocument();
  });

  it('saves the whole representation with If-Match and no property the contract does not declare', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    const dialog = await openEdit(user, 'Application B');
    await replace(user, dialog.getByLabelText(/^Name/), 'Application Beta');

    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Application Beta saved.')).toBeInTheDocument();
    const put = api.callsTo('PUT /applications/{id}')[0];
    expect(put?.options.ifMatch).toBe('W/"1"');
    expect(put?.options.path).toEqual({ id: 2 });
    expect(put?.options.body).toEqual({
      name: 'Application Beta',
      platform: 'Power Apps',
      description: 'Sample description',
      jiraProjectKey: 'APPB',
      status: 'ACTIVE',
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('keeps the status as it is: editing an archived application does not unarchive it', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    const dialog = await openEdit(user, 'Application C');
    await replace(user, dialog.getByLabelText(/^Platform/), 'Power Platform');

    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    await screen.findByText('Application C saved.');
    expect(api.callsTo('PUT /applications/{id}')[0]?.options.body).toMatchObject({
      platform: 'Power Platform',
      status: 'ARCHIVED',
    });
  });

  it('clearing the key sends null, which is the default project', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    const dialog = await openEdit(user, 'Application B');
    await user.clear(dialog.getByLabelText('Jira project key'));

    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    await screen.findByText('Application B saved.');
    expect(api.callsTo('PUT /applications/{id}')[0]?.options.body).toMatchObject({
      jiraProjectKey: null,
    });
    const row = (await screen.findByRole('rowheader', { name: 'Application B' })).closest(
      'tr',
    ) as HTMLElement;
    await waitFor(() => {
      expect(within(row).getByText('TECHEA (default)')).toBeInTheDocument();
    });
  });

  it('DUPLICATE_NAME on a rename goes under the name', async () => {
    const user = setupSettledUser();
    await renderApplications();
    const dialog = await openEdit(user, 'Application B');
    await replace(user, dialog.getByLabelText(/^Name/), 'SAR');

    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    expect(
      await dialog.findByText('An application named SAR already exists in Documentación técnica.'),
    ).toBeInTheDocument();
  });

  it('the selected application changes its name in the sidebar card without reloading the page', async () => {
    const user = setupSettledUser();
    await renderApplications();
    const sidebar = within(screen.getByRole('complementary', { name: 'Sidebar' }));
    // The shell picks the first active application by name: Application B.
    expect(await sidebar.findByText('Application B')).toBeInTheDocument();
    const dialog = await openEdit(user, 'Application B');
    await replace(user, dialog.getByLabelText(/^Name/), 'Application Beta');

    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    await screen.findByText('Application Beta saved.');
    expect(await sidebar.findByText('Application Beta')).toBeInTheDocument();
    expect(sidebar.queryByText('Application B')).not.toBeInTheDocument();
  });

  describe('412 (S-44)', () => {
    async function conflict() {
      const user = setupSettledUser();
      const view = await renderApplications();
      const dialog = await openEdit(user, 'Application B');
      await replace(user, dialog.getByLabelText(/^Name/), 'My version');
      // Someone else saves meanwhile: the ETag of the application moves.
      view.api.state.versions.set(2, 9);
      view.api.state.applications = view.api.state.applications.map((a) =>
        a.id === 2 ? { ...a, name: 'Their version' } : a,
      );
      await user.click(dialog.getByRole('button', { name: 'Save changes' }));
      await dialog.findByRole('button', { name: 'Reload' });
      return { user, dialog, ...view };
    }

    it('keeps what was typed, disables Save and offers to reload', async () => {
      const { dialog } = await conflict();

      expect(
        dialog.getByText(
          'Someone else saved changes to this application after you opened it. Reload to see their version. Your changes will be lost, so copy anything you need first.',
        ),
      ).toBeInTheDocument();
      expect(dialog.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('My version');
      expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled();
      expect(dialog.getByRole('button', { name: 'Keep my changes visible' })).toBeInTheDocument();
    });

    it('"Keep my changes visible" hides the banner and keeps Save disabled with the sentence', async () => {
      const { user, dialog } = await conflict();

      await user.click(dialog.getByRole('button', { name: 'Keep my changes visible' }));

      expect(dialog.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
      expect(dialog.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('My version');
      expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled();
      expect(dialog.getByRole('button', { name: 'Save changes' })).toHaveAccessibleDescription(
        'Someone else saved changes to this application after you opened it. Reload to see their version.',
      );
    });

    it('"Reload" reads the other version and Save works again with the new ETag', async () => {
      const { user, dialog, api } = await conflict();

      await user.click(dialog.getByRole('button', { name: 'Reload' }));

      const modal = () => within(screen.getByRole('dialog', { name: 'Edit application' }));
      await waitFor(() => {
        expect(modal().getByLabelText<HTMLInputElement>(/^Name/).value).toBe('Their version');
      });
      expect(modal().getByRole('button', { name: 'Save changes' })).toBeEnabled();
      await user.click(modal().getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByText('Their version saved.')).toBeInTheDocument();
      expect(api.callsTo('PUT /applications/{id}').at(-1)?.options.ifMatch).toBe('W/"9"');
    });
  });

  it('shows the catalog text with a retry when the application cannot be read', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    await screen.findByRole('rowheader', { name: 'SAR' });
    api.failNext('GET /applications/{id}', new ApiError({ status: 404, code: 'NOT_FOUND' }));
    const row = screen.getByRole('rowheader', { name: 'SAR' }).closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Actions for SAR' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));

    const dialog = within(await screen.findByRole('dialog', { name: 'Edit application' }));
    expect(
      await dialog.findByText("This application doesn't exist. It may have been deleted."),
    ).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText(/^Name/)).toBeInTheDocument();
  });

  it('closes with Escape and returns the focus to the row menu button', async () => {
    const user = setupSettledUser();
    await renderApplications();
    await openEdit(user, 'SAR');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for SAR' })).toHaveFocus();
  });
});
