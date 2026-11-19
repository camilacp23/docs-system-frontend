// Who can edit a screen and when: the route (S-41b for the Reader), the Edit button of the detail and the row menu with
// their reasons (SDD Table 56: review, archived application, no connection), the same reasons next to Save, the
// breadcrumb and D-78 on the edit page.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeScreenDetail } from '../helpers/fakeScreensApi';
import { makeApplication } from '../helpers/renderApp';
import { renderScreens, sampleScreens } from '../helpers/renderScreens';
import { openEdit } from '../helpers/screenEditHelpers';
import { setupUser } from '../helpers/setupUser';

const REVIEW_REASON =
  'This screen is in review. Edit it after the review, or withdraw it from review.';
const ARCHIVED_REASON = 'Read-only: the application is archived.';
const OFFLINE_REASON = "You're offline. Changes can't be saved until the connection is back.";

afterEach(() => {
  vi.restoreAllMocks();
});

function goOffline() {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
}

describe('screen edit: route and roles', () => {
  it('shows the page without access to the Reader', async () => {
    await renderScreens({ role: 'READER', path: '/screens/12/edit' });

    expect(await screen.findByText("You don't have access to this page")).toBeVisible();
    expect(screen.getByText(/Your role \(Reader\) doesn't include it/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it.each(['ADMINISTRATOR', 'DEVELOPER'] as const)('opens the form for the %s', async (role) => {
    await openEdit({ role });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('writes "<name> / Edit" in the breadcrumb', async () => {
    await openEdit();

    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    // The record name reaches the breadcrumb once the page has set it.
    expect(await crumbs.findByRole('link', { name: 'Detalle' })).toHaveAttribute(
      'href',
      '/screens/12',
    );
    expect(crumbs.getByRole('link', { name: 'Screens' })).toHaveAttribute('href', '/screens');
    expect(crumbs.getByText('Edit')).toBeVisible();
  });

  it('leaves the page with Cancel, back to the detail', async () => {
    const { user, router } = await openEdit();

    await user.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(router.state.location.pathname).toBe('/screens/12');
  });
});

describe('screen detail: the Edit button', () => {
  it.each(['ADMINISTRATOR', 'DEVELOPER'] as const)(
    'opens the edit page for the %s',
    async (role) => {
      const user = setupUser();
      const { router } = await renderScreens({
        role,
        path: '/screens/13',
      });
      await screen.findByRole('heading', { name: 'Busqueda', level: 1 });

      await user.click(screen.getByRole('button', { name: 'Edit' }));

      expect(router.state.location.pathname).toBe('/screens/13/edit');
      expect(await screen.findByRole('heading', { name: 'Edit Busqueda', level: 1 })).toBeVisible();
    },
  );

  it('is not drawn for the Reader', async () => {
    await renderScreens({ role: 'READER', path: '/screens/13' });
    await screen.findByRole('heading', { name: 'Busqueda', level: 1 });

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('is not drawn while the screen is in review (its way out is the workflow buttons)', async () => {
    await renderScreens({ path: '/screens/12' });
    await screen.findByRole('heading', { name: 'Detalle', level: 1 });

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw from review' })).toBeInTheDocument();
  });

  it('is disabled when the application is archived', async () => {
    await renderScreens({
      path: '/screens/13',
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });
    await screen.findByRole('heading', { name: 'Busqueda', level: 1 });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('title', ARCHIVED_REASON);
  });

  it('is disabled while the browser is offline', async () => {
    await renderScreens({ path: '/screens/13' });
    await screen.findByRole('heading', { name: 'Busqueda', level: 1 });

    goOffline();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('title', OFFLINE_REASON);
  });

  it('stays enabled for App (OnStart): only its name is protected', async () => {
    await renderScreens({ path: '/screens/10' });
    await screen.findByRole('heading', { name: 'App (OnStart)', level: 1 });

    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
  });
});

describe('screens list: the Edit item of the row menu', () => {
  it('opens the edit page', async () => {
    const user = setupUser();
    const { router } = await renderScreens({ path: '/screens' });

    await user.click(await screen.findByRole('button', { name: 'Actions for Busqueda' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(router.state.location.pathname).toBe('/screens/13/edit');
  });

  it('is disabled with the reason for a screen in review', async () => {
    const user = setupUser();
    await renderScreens({ path: '/screens' });

    await user.click(await screen.findByRole('button', { name: 'Actions for Detalle' }));

    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute('title', REVIEW_REASON);
  });
});

describe('screen edit: Save disabled with its reason', () => {
  it('shows the form of a screen in review but disables Save with the reason', async () => {
    await openEdit({ screens: sampleScreens() });

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Detalle');
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(REVIEW_REASON);
    // The reason is told twice: next to Save and in a banner above the form.
    expect(screen.getAllByText(REVIEW_REASON)).toHaveLength(2);
  });

  it('disables Save when the application is archived', async () => {
    await openEdit({ applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })] });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAccessibleDescription(
      ARCHIVED_REASON,
    );
  });

  it('disables Save while the browser is offline and enables it again when it is back', async () => {
    await openEdit();

    goOffline();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAccessibleDescription(
      OFFLINE_REASON,
    );

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });
  });
});

describe('D-78 on the screen edit page', () => {
  const APPLICATIONS = [
    makeApplication(1, { name: 'SAR' }),
    makeApplication(2, { name: 'Billing' }),
  ];
  const billingScreen = makeScreenDetail(70, 'Facturas', {
    applicationId: 2,
    documentationStatus: 'DRAFT',
  });

  it('goes back to the list when the user switches application from the shell', async () => {
    const { user, router } = await openEdit({ applications: APPLICATIONS });

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/screens');
    });
  });

  it('selects the application of a screen opened by link and stays on the page', async () => {
    const { router } = await openEdit({
      id: 70,
      applications: APPLICATIONS,
      screens: [...sampleScreens(), billingScreen],
    });

    expect(await screen.findByText('Switched to Billing.')).toBeVisible();
    expect(router.state.location.pathname).toBe('/screens/70/edit');
    expect(screen.getByRole('heading', { name: 'Edit Facturas', level: 1 })).toBeVisible();
  });
});
