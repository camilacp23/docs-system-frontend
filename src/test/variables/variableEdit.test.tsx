// Edit variable page (S-12b, S-44): the form loaded from the variable, the complete PUT with If-Match, 412 keeping
// what the user edited, the error of each rule on its exact field, SCOPE_CONFLICT with a fresh dependencies read,
// archived and offline, and the Reader.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { VariableDependencies } from '../../modules/variables/variableTypes';
import { makeVariable } from '../helpers/fakeVariablesApi';
import { makeApplication } from '../helpers/renderApp';
import {
  APP_SCREEN,
  SCREEN_DETALLE,
  sampleVariables,
  renderVariables,
  type RenderVariablesOptions,
} from '../helpers/renderVariables';

const SET_ASSIGNMENTS: VariableDependencies = {
  variable: { id: 1, name: 'gUsuario' },
  originScreen: { id: APP_SCREEN.id, name: 'App (OnStart)' },
  screens: [],
  components: [],
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
    {
      id: 2,
      variable: { id: 1, name: 'gUsuario' },
      collection: { id: 20, name: 'colUsuarios' },
      screen: { id: SCREEN_DETALLE.id, name: 'Detalle' },
      assignmentFunction: 'SET',
      tableFunction: null,
      usedIn: 'OnVisible',
    },
  ],
};

const render = (extra: Partial<RenderVariablesOptions> = {}) =>
  renderVariables({
    path: '/variables/1/edit',
    dependencies: { 1: SET_ASSIGNMENTS },
    ...extra,
  });

async function ready() {
  await screen.findByRole('heading', { name: /^Edit/ });
  return {
    name: screen.getByLabelText(/^Name/),
    description: screen.getByLabelText('Description'),
    save: screen.getByRole('button', { name: 'Save changes' }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('edit variable', () => {
  it('loads the complete form of the variable', async () => {
    await render();
    const { name, description } = await ready();

    expect(screen.getByRole('heading', { name: /Edit gUsuario/ })).toBeInTheDocument();
    expect(name).toHaveValue('gUsuario');
    expect(name).toHaveClass('font-mono');
    expect(screen.getByLabelText(/^Data type/)).toHaveValue('RECORD');
    expect(screen.getByRole('radio', { name: 'Global (Set)' })).toBeChecked();
    await waitFor(() => {
      expect(screen.getByLabelText('Origin screen')).toHaveValue('10');
    });
    expect(screen.getByRole('checkbox', { name: 'DEV' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'PROD' })).toBeChecked();
    expect(screen.getByLabelText('Notes for DEV')).toHaveValue('');
    expect(screen.getByLabelText('Notes for PROD')).toHaveValue(
      'Loaded from the production user list.',
    );
    expect(description).toHaveValue('Signed-in user record, loaded at start.');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(await within(breadcrumb).findByText('gUsuario / Edit')).toBeInTheDocument();
  });

  it('sends the COMPLETE representation with If-Match, says it was saved and shows the detail', async () => {
    const user = userEvent.setup();
    const { api, router } = await render();
    const { description, save } = await ready();
    await waitFor(() => {
      expect(screen.getByLabelText('Origin screen')).toHaveValue('10');
    });

    await user.clear(description);
    await user.click(description);
    await user.paste('New description');
    await user.click(save);

    await waitFor(() => {
      expect(api.callsTo('PUT /variables/{id}')).toHaveLength(1);
    });
    const call = api.callsTo('PUT /variables/{id}')[0];
    expect(call?.options.ifMatch).toBe('W/"1"');
    expect(call?.options.path).toEqual({ id: 1 });
    // Only the description changed, but every field travels.
    expect(call?.options.body).toEqual({
      name: 'gUsuario',
      dataType: 'RECORD',
      scope: 'GLOBAL',
      description: 'New description',
      originScreenId: 10,
      environments: [
        { environment: 'DEV', notes: null },
        { environment: 'PROD', notes: 'Loaded from the production user list.' },
      ],
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/variables/1');
    });
    expect(await screen.findByText('Variable saved.')).toBeInTheDocument();
    // Look in the Details card: the text of the edit form's textarea would match too, and it goes away.
    const details = await screen.findByRole('region', { name: 'Details' });
    expect(await within(details).findByText('New description')).toBeInTheDocument();
  });

  it('edits the notes per environment, the environments and the origin screen', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { save } = await ready();
    await waitFor(() => {
      expect(screen.getByLabelText('Origin screen')).toHaveValue('10');
    });

    await user.click(screen.getByLabelText('Notes for DEV'));
    await user.paste('Differs in DEV');
    await user.click(screen.getByRole('checkbox', { name: 'PROD' }));
    await user.selectOptions(screen.getByLabelText('Origin screen'), 'Inicio');
    await user.click(save);

    await waitFor(() => {
      expect(api.callsTo('PUT /variables/{id}')).toHaveLength(1);
    });
    expect(api.callsTo('PUT /variables/{id}')[0]?.options.body).toMatchObject({
      originScreenId: 11,
      environments: [{ environment: 'DEV', notes: 'Differs in DEV' }],
    });
  });

  it('checks the contract rules before sending', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { name, save } = await ready();

    await user.clear(name);
    await user.click(save);

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(name).toHaveFocus();
    expect(api.callsTo('PUT /variables/{id}')).toHaveLength(0);
  });

  it('drops App (OnStart) as the origin when the scope becomes Context', async () => {
    const user = userEvent.setup();
    await render();
    await ready();
    await waitFor(() => {
      expect(screen.getByLabelText('Origin screen')).toHaveValue('10');
    });

    await user.click(screen.getByRole('radio', { name: 'Context (UpdateContext)' }));

    expect(screen.getByLabelText('Origin screen')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'App (OnStart)' })).toBeDisabled();
  });

  it('goes back to the detail with Cancel', async () => {
    const user = userEvent.setup();
    const { router } = await render();
    await ready();

    await user.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(router.state.location.pathname).toBe('/variables/1');
  });
});

describe('edit variable: 412 (S-44)', () => {
  async function otherPersonSaves(api: Awaited<ReturnType<typeof render>>['api']) {
    await api.client.put('/variables/{id}', {
      path: { id: 1 },
      ifMatch: 'W/"1"',
      body: {
        name: 'gUsuario',
        dataType: 'RECORD',
        scope: 'GLOBAL',
        description: 'Their description',
        originScreenId: 10,
        environments: [{ environment: 'DEV', notes: null }],
      },
    });
  }

  it('keeps what the user edited, disables Save and offers Reload and Keep my changes visible', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { description, save } = await ready();
    await otherPersonSaves(api);

    await user.clear(description);
    await user.click(description);
    await user.paste('My description');
    await user.click(save);

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(
      'Someone else saved changes to this variable after you opened it. Reload to see their version. Your changes will be lost, so copy anything you need first.',
    );
    expect(within(banner).getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(description).toHaveValue('My description');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await user.click(within(banner).getByRole('button', { name: 'Keep my changes visible' }));

    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('My description');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(
      screen.getByText(
        /Someone else saved changes to this variable after you opened it\. Reload to see their version\.$/,
      ),
    ).toBeInTheDocument();
  });

  it('Reload brings the other version into the form and Save works again with the new ETag', async () => {
    const user = userEvent.setup();
    const { api, router } = await render();
    const { description, save } = await ready();
    await otherPersonSaves(api);
    await user.clear(description);
    await user.click(description);
    await user.paste('My description');
    await user.click(save);
    await user.click(await screen.findByRole('button', { name: 'Reload' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Description')).toHaveValue('Their description');
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/variables/1');
    });
    expect(api.callsTo('PUT /variables/{id}').at(-1)?.options.ifMatch).toBe('W/"2"');
  });
});

describe('edit variable: errors on their field', () => {
  async function saveWithError(error: ApiError, extra: Partial<RenderVariablesOptions> = {}) {
    const user = userEvent.setup();
    const view = await render(extra);
    view.api.failNext('PUT /variables/{id}', error);
    const { save } = await ready();
    await waitFor(() => {
      expect(screen.getByLabelText('Origin screen')).toHaveValue('10');
    });
    await user.click(save);
    return { user, ...view };
  }

  it('DUPLICATE_NAME goes on the name', async () => {
    await saveWithError(
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

    const message = await screen.findByText(
      'A global variable named gUsuario already exists in SAR.',
    );
    expect(screen.getByLabelText(/^Name/)).toHaveAccessibleDescription(
      expect.stringContaining(message.textContent ?? ''),
    );
    expect(screen.getByLabelText(/^Name/)).toHaveFocus();
  });

  it('INVALID_ORIGIN_SCREEN goes on the origin screen', async () => {
    await saveWithError(
      new ApiError({
        status: 422,
        code: 'INVALID_ORIGIN_SCREEN',
        details: { field: 'originScreenId' },
      }),
    );

    expect(
      await screen.findByText(
        'Context variables are created inside a screen, not in App (OnStart).',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Origin screen')).toHaveAttribute('aria-invalid', 'true');
  });

  it('CONTEXT_SCREEN_MISMATCH goes on the origin screen', async () => {
    await saveWithError(
      new ApiError({
        status: 422,
        code: 'CONTEXT_SCREEN_MISMATCH',
        details: { variable: 'gUsuario', originScreenId: 12, screen: 'Detalle' },
      }),
    );

    expect(
      await screen.findByText(
        'gUsuario belongs to Detalle. From here you can only write it with Navigate.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Origin screen')).toHaveAttribute('aria-invalid', 'true');
  });

  it('a repeated environment is marked on its own row', async () => {
    await saveWithError(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        details: {
          fields: [{ field: 'environments[1].environment', rule: 'unique', message: 'x' }],
        },
      }),
    );

    const message = await screen.findByText(
      'Environment has repeated values. Each one must be unique.',
    );
    expect(screen.getByLabelText('Notes for PROD')).toHaveAccessibleDescription(
      message.textContent ?? '',
    );
    expect(screen.getByLabelText('Notes for DEV')).not.toHaveAttribute('aria-invalid');
  });

  it('shows the message of APPLICATION_ARCHIVED sent by the server', async () => {
    await saveWithError(new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' }));

    expect(
      await screen.findByText(
        "This application is archived, so its documentation can't be changed.",
      ),
    ).toBeInTheDocument();
  });

  it('SCOPE_CONFLICT reads the dependencies again and names the collections', async () => {
    const view = await saveWithError(
      new ApiError({ status: 422, code: 'SCOPE_CONFLICT', details: { function: 'Set' } }),
    );
    // The page does not read the dependencies when it opens: the one read is the fresh one after the error.
    expect(view.api.callsTo('GET /variables/{id}/dependencies')).toHaveLength(1);

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(
      "You can't change the scope while collections assign this variable with Set. Update those assignments first.",
    );
    expect(within(banner).getByRole('link', { name: 'colUsuarios' })).toHaveAttribute(
      'href',
      '/collections/20',
    );
    expect(await screen.findByText('Scope conflicts with 2 Set assignments.')).toBeInTheDocument();
  });

  it('changing the scope to Context shows the banner with the collections, the field text and brings the banner into view', async () => {
    // The real case: the user changes the scope in the form and the (fake) server applies its own rule (D-71).
    const scrolled: Element[] = [];
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value(this: Element) {
        scrolled.push(this);
      },
    });
    try {
      const user = userEvent.setup();
      const { api } = await render();
      const { save } = await ready();
      await waitFor(() => {
        expect(screen.getByLabelText('Origin screen')).toHaveValue('10');
      });

      await user.click(screen.getByRole('radio', { name: 'Context (UpdateContext)' }));
      await user.click(save);

      // The fresh read after the 422 is the only read of the dependencies.
      await screen.findByText('Scope conflicts with 2 Set assignments.');
      expect(api.callsTo('PUT /variables/{id}')).toHaveLength(1);
      expect(api.callsTo('GET /variables/{id}/dependencies')).toHaveLength(1);

      const banner = screen.getByRole('alert');
      expect(banner).toHaveTextContent(
        "You can't change the scope while collections assign this variable with Set. Update those assignments first.",
      );
      const link = within(banner).getByRole('link', { name: 'colUsuarios' });
      expect(link).toHaveAttribute('href', '/collections/20');
      expect(link).toHaveClass('font-mono');
      // Both collections are one collection (colUsuarios) named once.
      expect(within(banner).getAllByRole('link')).toHaveLength(1);

      // The banner is above the form and the user is usually scrolled down at Save: it must be brought into view.
      expect(scrolled.some((element) => element.contains(banner))).toBe(true);
    } finally {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });

  it('SCOPE_CONFLICT uses the answer of the new read, not an older one', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { save } = await ready();
    await waitFor(() => {
      expect(screen.getByLabelText('Origin screen')).toHaveValue('10');
    });
    // Someone removes one assignment after the page was opened.
    api.state.dependencies[1] = {
      ...SET_ASSIGNMENTS,
      collections: SET_ASSIGNMENTS.collections.slice(0, 1),
    };
    api.failNext(
      'PUT /variables/{id}',
      new ApiError({ status: 422, code: 'SCOPE_CONFLICT', details: { function: 'Set' } }),
    );

    await user.click(save);

    expect(await screen.findByText('Scope conflicts with 1 Set assignment.')).toBeInTheDocument();
  });

  it('SCOPE_CONFLICT shows only the banner when the dependencies cannot be read', async () => {
    const user = userEvent.setup();
    const { api } = await render();
    const { save } = await ready();
    await waitFor(() => {
      expect(screen.getByLabelText('Origin screen')).toHaveValue('10');
    });
    api.failNext(
      'PUT /variables/{id}',
      new ApiError({ status: 422, code: 'SCOPE_CONFLICT', details: { function: 'Set' } }),
    );
    api.failNext(
      'GET /variables/{id}/dependencies',
      new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
    );

    await user.click(save);

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(
      "You can't change the scope while collections assign this variable with Set.",
    );
    expect(within(banner).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/Scope conflicts with/)).not.toBeInTheDocument();
  });
});

describe('edit variable: access and state', () => {
  it('shows "No access" to the Reader', async () => {
    await render({ role: 'READER' });

    expect(
      await screen.findByRole('heading', { name: "You don't have access to this page" }),
    ).toBeInTheDocument();
  });

  it('disables Save, with the reason, when the application is archived', async () => {
    await render({ applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })] });
    await ready();

    const save = screen.getByRole('button', { name: 'Save changes' });
    await waitFor(() => {
      expect(save).toBeDisabled();
    });
    expect(save).toHaveAccessibleDescription('Read-only: the application is archived.');
  });

  it('disables Save, with the reason, while the browser is offline', async () => {
    await render();
    const { save } = await ready();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(
      "You're offline. Changes can't be saved until the connection is back.",
    );
  });

  it('says the variable does not exist', async () => {
    await render({ path: '/variables/999/edit' });

    expect(
      await screen.findByRole('heading', { name: "This variable doesn't exist" }),
    ).toBeInTheDocument();
  });

  it('selects the application of the variable and says so (D-78)', async () => {
    await render({
      path: '/variables/7/edit',
      variables: [...sampleVariables(), makeVariable(7, 'bFactura', { applicationId: 2 })],
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
      expect(router.state.location.pathname).toBe('/variables');
    });
  });
});
