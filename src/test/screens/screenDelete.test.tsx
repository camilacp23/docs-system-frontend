// Delete a screen (S-26): who gets the action, the impact the API allows to know, the disabled cases with their
// reason (App (OnStart), in review, archived, offline), the API as the authority when the state changed, the
// loading and failure of the impact, and where each page goes afterwards.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeScreenDetail } from '../helpers/fakeScreensApi';
import { makeVariable } from '../helpers/fakeVariablesApi';
import { makeApplication } from '../helpers/renderApp';
import { renderScreens, sampleScreens } from '../helpers/renderScreens';

const APP_REASON = "The App (OnStart) screen can't be deleted.";
const REVIEW_REASON =
  'This screen is in review. Edit it after the review, or withdraw it from review.';

afterEach(() => {
  vi.restoreAllMocks();
});

/** A deletable screen with content: two components, three links (one is an origin row) and one navigation. */
const AJUSTES = makeScreenDetail(60, 'Ajustes', {
  documentationStatus: 'DRAFT',
  components: [
    { id: 1, name: 'btnA', type: 'Button', onSelect: null, description: null, uses: [] },
    { id: 2, name: 'btnB', type: 'Button', onSelect: null, description: null, uses: [] },
  ],
  variableLinks: [
    {
      id: 11,
      variable: { id: 8, name: 'locAjuste' },
      accessMode: 'WRITE',
      usedIn: 'origin',
      isOrigin: true,
    },
    {
      id: 12,
      variable: { id: 3, name: 'gRegistroSel' },
      accessMode: 'READ',
      usedIn: 'btnA.OnSelect',
      isOrigin: false,
    },
  ],
  collectionLinks: [
    {
      id: 21,
      collection: { id: 11, name: 'colClientes' },
      accessMode: 'READ',
      usedIn: 'galA.Items',
    },
  ],
  navigations: [{ id: 31, targetScreen: { id: 11, name: 'Inicio' }, description: null }],
});
const ORPHAN = makeVariable(8, 'locAjuste', {
  scope: 'CONTEXT',
  originScreen: { id: 60, name: 'Ajustes' },
  fullTraceability: true,
});
const ORPHAN_TWO = makeVariable(9, 'locOtro', {
  scope: 'CONTEXT',
  originScreen: { id: 60, name: 'Ajustes' },
  fullTraceability: true,
});

const screensWithAjustes = () => [...sampleScreens(), AJUSTES];

async function listReady(options: Parameters<typeof renderScreens>[0] = {}) {
  const view = await renderScreens(options);
  await screen.findByRole('link', { name: 'Detalle' });
  return view;
}

async function openDeleteFromList(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
  return within(await screen.findByRole('dialog'));
}

describe('delete screen: who gets it', () => {
  it('offers the row menu with View and Delete to the Developer and the Administrator', async () => {
    const user = userEvent.setup();
    for (const role of ['DEVELOPER', 'ADMINISTRATOR'] as const) {
      const { unmount } = await listReady({ role });
      await user.click(await screen.findByRole('button', { name: 'Actions for Inicio' }));
      expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      );
      unmount();
    }
  });

  it('gives the Reader neither the menu nor the Delete button of the detail', async () => {
    await renderScreens({ role: 'READER', path: '/screens/13' });
    await screen.findByRole('heading', { name: 'Busqueda', level: 1 });

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('opens a screen from the View item', async () => {
    const user = userEvent.setup();
    const { router } = await listReady();

    await user.click(await screen.findByRole('button', { name: 'Actions for Inicio' }));
    await user.click(screen.getByRole('menuitem', { name: 'View' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/screens/11');
    });
  });
});

describe('delete screen: the impact', () => {
  it('counts the components and links of the detail and the variables left without origin', async () => {
    const user = userEvent.setup();
    const { api } = await listReady({
      screens: screensWithAjustes(),
      variables: [ORPHAN, ORPHAN_TWO],
    });

    const dialog = await openDeleteFromList(user, 'Ajustes');

    expect(dialog.getByText('Delete Ajustes?')).toBeInTheDocument();
    expect(
      await dialog.findByText(
        'Its 2 components and 3 links are deleted too. 2 variables created in it stay without an origin screen. The Jira issues stay in Jira.',
      ),
    ).toBeInTheDocument();
    expect(
      dialog.getByText('The audit log keeps a record of everything deleted.'),
    ).toBeInTheDocument();
    expect(
      api.collectionsApi.variablesApi.callsTo('GET /variables').at(-1)?.options.query,
    ).toMatchObject({
      applicationId: 1,
      originScreenId: 60,
      pageSize: 1,
    });
  });

  it('counts the comments and the pending to-do records that the detail gives, and only those', async () => {
    const user = userEvent.setup();
    const { api } = await listReady({
      screens: [
        ...sampleScreens(),
        makeScreenDetail(61, 'Revisada', {
          documentationStatus: 'DRAFT',
          commentCount: 2,
          pendingSubtasks: 3,
          components: AJUSTES.components,
        }),
      ],
    });

    const dialog = await openDeleteFromList(user, 'Revisada');

    expect(
      await dialog.findByText(
        'Its 2 components, 2 comments and 3 pending to-do records are deleted too. The Jira issues stay in Jira.',
      ),
    ).toBeInTheDocument();
    // Nothing is calculated: the numbers are the ones of GET /screens/{id}.
    expect(api.callsTo('GET /screens/{id}').at(-1)?.options.path).toEqual({ id: 61 });
  });

  it('uses the singular for one comment and one pending to-do record, and leaves out zeros', async () => {
    const user = userEvent.setup();
    await listReady({
      screens: [
        ...sampleScreens(),
        makeScreenDetail(62, 'Comentada', { commentCount: 1, pendingSubtasks: 1 }),
        makeScreenDetail(63, 'Sola', { commentCount: 1 }),
      ],
    });

    const first = await openDeleteFromList(user, 'Comentada');
    expect(
      await first.findByText(
        'Its 1 comment and 1 pending to-do record are deleted too. The Jira issues stay in Jira.',
      ),
    ).toBeInTheDocument();
    await user.click(first.getByRole('button', { name: 'Cancel' }));

    const second = await openDeleteFromList(user, 'Sola');
    expect(
      await second.findByText('Its 1 comment is deleted too. The Jira issues stay in Jira.'),
    ).toBeInTheDocument();
  });

  it('says "1 variable ... stays" and uses the singular', async () => {
    const user = userEvent.setup();
    await listReady({ screens: screensWithAjustes(), variables: [ORPHAN] });

    const dialog = await openDeleteFromList(user, 'Ajustes');

    expect(
      await dialog.findByText(/1 variable created in it stays without an origin screen\./),
    ).toBeInTheDocument();
  });

  it('says there is nothing to delete with it when the screen has no components, links or variables', async () => {
    const user = userEvent.setup();
    await listReady();

    const dialog = await openDeleteFromList(user, 'Busqueda');

    expect(
      await dialog.findByText('Busqueda has no components or links. The Jira issues stay in Jira.'),
    ).toBeInTheDocument();
  });

  it('keeps Delete disabled while the impact loads and says it is checking', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    await listReady({
      prepare: (api) => {
        api.client.get = ((read) => (path: string, options?: unknown) => {
          if (path === '/screens/{id}') {
            return new Promise((resolve) => {
              release = () => {
                resolve(read(path as never, options as never));
              };
            });
          }
          return read(path as never, options as never);
        })(api.client.get.bind(api.client));
      },
    });

    // The first call of GET /screens/{id} is made by the dialog: the detail page is not open.
    const dialog = await openDeleteFromList(user, 'Busqueda');
    expect(await dialog.findByText('Checking what depends on this screen…')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Delete screen' })).toBeDisabled();

    await act(async () => {
      release();
      await Promise.resolve();
    });
    expect(await dialog.findByText(/Busqueda has no components or links/)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Delete screen' })).toBeEnabled();
  });

  it('keeps Delete disabled, with a retry, when the screen cannot be read', async () => {
    const user = userEvent.setup();
    const { api } = await listReady({
      prepare: (fake) => {
        fake.failNext('GET /screens/{id}', new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
      },
    });

    const dialog = await openDeleteFromList(user, 'Busqueda');

    expect(
      await dialog.findByText("Couldn't check what depends on this screen."),
    ).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Delete screen' })).toBeDisabled();
    await user.click(dialog.getByRole('button', { name: 'Try again' }));
    expect(await dialog.findByText(/Busqueda has no components or links/)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Delete screen' })).toBeEnabled();
    expect(api.callsTo('DELETE /screens/{id}')).toHaveLength(0);
  });

  it('keeps Delete disabled when the variables without origin cannot be counted', async () => {
    const user = userEvent.setup();
    let failing = true;
    const { api } = await listReady({
      prepare: (fake) => {
        const read = fake.client.get.bind(fake.client);
        fake.client.get = (path: string, options?: unknown) => {
          if (failing && path === '/variables') {
            return Promise.reject(new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
          }
          return read(path as never, options as never);
        };
      },
    });

    const dialog = await openDeleteFromList(user, 'Busqueda');

    expect(
      await dialog.findByText("Couldn't check what depends on this screen."),
    ).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Delete screen' })).toBeDisabled();
    failing = false;
    await user.click(dialog.getByRole('button', { name: 'Try again' }));
    expect(await dialog.findByText(/Busqueda has no components or links/)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Delete screen' })).toBeEnabled();
    expect(api.callsTo('DELETE /screens/{id}')).toHaveLength(0);
  });

  it('closes with Cancel without deleting anything', async () => {
    const user = userEvent.setup();
    const { api } = await listReady();

    const dialog = await openDeleteFromList(user, 'Busqueda');
    await dialog.findByText(/Busqueda has no components or links/);
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.callsTo('DELETE /screens/{id}')).toHaveLength(0);
  });
});

describe('delete screen: from the list', () => {
  it('deletes, says so, reads the list and the counts again and leaves the variables without origin', async () => {
    const user = userEvent.setup();
    const { api } = await listReady({
      screens: screensWithAjustes(),
      variables: [ORPHAN],
    });
    await screen.findByText(/6 screens · 1 approved/);

    const dialog = await openDeleteFromList(user, 'Ajustes');
    await dialog.findByText(/Its 2 components/);
    await user.click(dialog.getByRole('button', { name: 'Delete screen' }));

    expect(await screen.findByText('Ajustes deleted.')).toBeInTheDocument();
    expect(
      screen.getAllByText('The audit log keeps a record of everything deleted.').length,
    ).toBeGreaterThan(0);
    expect(api.callsTo('DELETE /screens/{id}')[0]?.options.path).toEqual({ id: 60 });
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Ajustes' })).not.toBeInTheDocument();
    });
    expect(await screen.findByText(/5 screens · 1 approved/)).toBeInTheDocument();
    expect(api.collectionsApi.variablesApi.state.variables[0]?.originScreen).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('goes back one page when the last row of a page is deleted', async () => {
    const user = userEvent.setup();
    const many = [
      makeScreenDetail(10, 'App (OnStart)', { isAppContext: true }),
      ...Array.from({ length: 20 }, (_, index) =>
        makeScreenDetail(100 + index, `scr${String(index).padStart(2, '0')}`),
      ),
    ];
    const { router } = await renderScreens({ screens: many, path: '/screens?page=2' });
    await screen.findByText('Showing 21–21 of 21');

    const dialog = await openDeleteFromList(user, 'scr19');
    await dialog.findByText(/has no components or links/);
    await user.click(dialog.getByRole('button', { name: 'Delete screen' }));

    await screen.findByText('Showing 1–20 of 20');
    expect(router.state.location.search).toBe('');
  });
});

describe('delete screen: from the detail', () => {
  it('deletes and goes back to the list', async () => {
    const user = userEvent.setup();
    const { router, api } = await renderScreens({ path: '/screens/13' });
    await screen.findByRole('heading', { name: 'Busqueda', level: 1 });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByText(/Busqueda has no components or links/);
    await user.click(dialog.getByRole('button', { name: 'Delete screen' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/screens');
    });
    expect(await screen.findByText('Busqueda deleted.')).toBeInTheDocument();
    expect(api.state.screens.some((s) => s.id === 13)).toBe(false);
    expect(await screen.findByRole('link', { name: 'Detalle' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Busqueda' })).not.toBeInTheDocument();
  });
});

describe('delete screen: disabled with the reason (Table 56)', () => {
  it('disables Delete for App (OnStart) in the menu and in the detail, with the catalog text', async () => {
    const user = userEvent.setup();
    await listReady();
    await user.click(await screen.findByRole('button', { name: 'Actions for App (OnStart)' }));
    const item = screen.getByRole('menuitem', { name: 'Delete' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAttribute('title', APP_REASON);
    await user.click(item);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables the Delete button of the App (OnStart) detail with the reason', async () => {
    await renderScreens({ path: '/screens/10' });
    await screen.findByRole('heading', { name: 'App (OnStart)', level: 1 });

    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', APP_REASON);
    expect(button).toHaveAccessibleDescription(APP_REASON);
  });

  it('disables Delete for a screen in review, in the menu and in the detail', async () => {
    const user = userEvent.setup();
    await listReady();
    await user.click(await screen.findByRole('button', { name: 'Actions for Detalle' }));
    const item = screen.getByRole('menuitem', { name: 'Delete' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAttribute('title', REVIEW_REASON);
    await user.click(item);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables the Delete button of the detail of a screen in review with the reason', async () => {
    await renderScreens({ path: '/screens/12' });
    await screen.findByRole('heading', { name: 'Detalle', level: 1 });

    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(REVIEW_REASON);
  });

  it('disables Delete with the archived reason, before the reason of the screen', async () => {
    const user = userEvent.setup();
    await listReady({ applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })] });
    await user.click(await screen.findByRole('button', { name: 'Actions for App (OnStart)' }));

    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
      'title',
      'Read-only: the application is archived.',
    );
  });

  it('disables the Delete button of the detail when the application is archived', async () => {
    await renderScreens({
      path: '/screens/13',
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });
    await screen.findByRole('heading', { name: 'Busqueda', level: 1 });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute(
      'title',
      'Read-only: the application is archived.',
    );
  });

  it('disables Delete, with the reason, while the browser is offline', async () => {
    const user = userEvent.setup();
    await listReady();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await user.click(await screen.findByRole('button', { name: 'Actions for Busqueda' }));

    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
      'title',
      "You're offline. Changes can't be saved until the connection is back.",
    );
  });

  it('disables Delete in the open confirmation when the connection is lost', async () => {
    const user = userEvent.setup();
    await listReady();
    const dialog = await openDeleteFromList(user, 'Busqueda');
    await dialog.findByText(/Busqueda has no components or links/);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(dialog.getByRole('button', { name: 'Delete screen' })).toBeDisabled();
    expect(
      dialog.getByText("You're offline. Changes can't be saved until the connection is back."),
    ).toBeInTheDocument();
  });
});

describe('delete screen: the API is the authority', () => {
  it('shows SCREEN_IN_REVIEW when the screen was sent to review after the list was read', async () => {
    const user = userEvent.setup();
    const { api } = await listReady();
    const dialog = await openDeleteFromList(user, 'Busqueda');
    await dialog.findByText(/Busqueda has no components or links/);

    api.state.screens = api.state.screens.map((s) =>
      s.id === 13 ? { ...s, documentationStatus: 'IN_REVIEW' } : s,
    );
    await user.click(dialog.getByRole('button', { name: 'Delete screen' }));

    expect(await dialog.findByText(REVIEW_REASON)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(api.state.screens.some((s) => s.id === 13)).toBe(true);
    expect(dialog.getByRole('button', { name: 'Delete screen' })).toBeEnabled();
  });

  it('shows APP_CONTEXT_PROTECTED as the server says it', async () => {
    const user = userEvent.setup();
    await listReady({
      prepare: (api) => {
        api.failNext(
          'DELETE /screens/{id}',
          new ApiError({ status: 422, code: 'APP_CONTEXT_PROTECTED' }),
        );
      },
    });
    const dialog = await openDeleteFromList(user, 'Busqueda');
    await dialog.findByText(/Busqueda has no components or links/);

    await user.click(dialog.getByRole('button', { name: 'Delete screen' }));

    expect(await dialog.findByText(APP_REASON)).toBeInTheDocument();
  });

  it('shows APPLICATION_ARCHIVED when the application was archived meanwhile', async () => {
    const user = userEvent.setup();
    const { apps } = await listReady();
    const dialog = await openDeleteFromList(user, 'Busqueda');
    await dialog.findByText(/Busqueda has no components or links/);

    apps.state.applications = apps.state.applications.map((a) => ({
      ...a,
      status: 'ARCHIVED' as const,
    }));
    await user.click(dialog.getByRole('button', { name: 'Delete screen' }));

    expect(
      await dialog.findByText(
        "This application is archived, so its documentation can't be changed.",
      ),
    ).toBeInTheDocument();
  });

  it('shows "This screen doesn\'t exist" when it was deleted by someone else', async () => {
    const user = userEvent.setup();
    const { api } = await listReady();
    const dialog = await openDeleteFromList(user, 'Busqueda');
    await dialog.findByText(/Busqueda has no components or links/);

    api.state.screens = api.state.screens.filter((s) => s.id !== 13);
    await user.click(dialog.getByRole('button', { name: 'Delete screen' }));

    expect(
      await dialog.findByText("This screen doesn't exist. It may have been deleted."),
    ).toBeInTheDocument();
  });
});
