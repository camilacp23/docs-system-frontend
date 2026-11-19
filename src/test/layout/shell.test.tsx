// Shell: sidebar items per role (12 / 10 / 8), active item, application card and selector, top bar, sign out,
// offline strip (S-46), no application registered, and the archived strip with Unarchive (S-09b).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { NO_APPLICATIONS_TEXT } from '../../layout/AppShell';
import { SIGN_OUT_FAILED_TEXT } from '../../layout/TopBar';
import { makeApplication, renderApp } from '../helpers/renderApp';
import { setupUser } from '../helpers/setupUser';

afterEach(() => {
  vi.restoreAllMocks();
});

async function navLinks() {
  const nav = await screen.findByRole('navigation', { name: 'Main' });
  return within(nav).getAllByRole('link');
}

describe('sidebar', () => {
  it.each([
    ['ADMINISTRATOR', 12],
    ['DEVELOPER', 10],
    ['READER', 8],
  ] as const)('%s sees %i items', async (role, count) => {
    await renderApp({ role });
    expect(await navLinks()).toHaveLength(count);
  });

  it('collapses to icons that keep their names, and expands again', async () => {
    const user = setupUser();
    window.localStorage.removeItem('sidebar-collapsed');
    await renderApp({ role: 'ADMINISTRATOR' });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByText('Dashboard')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(within(nav).queryByText('Dashboard')).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(nav).getAllByRole('link')).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(within(nav).getByText('Dashboard')).toBeInTheDocument();
    window.localStorage.removeItem('sidebar-collapsed');
  });

  it('starts a new page at the top: <main> keeps its scroll position when the route changes, so it is reset', async () => {
    const user = setupUser();
    await renderApp({ path: '/dashboard' });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const main = screen.getByRole('main');
    main.scrollTop = 300;

    await user.click(within(nav).getByRole('link', { name: 'Variables' }));

    await waitFor(() => {
      expect(main.scrollTop).toBe(0);
    });
  });

  it('lists the exact labels in order (Administrator)', async () => {
    await renderApp();
    const labels = (await navLinks()).map((link) => link.textContent);
    expect(labels).toEqual([
      'Dashboard',
      'Screens',
      'Variables',
      'Collections',
      'Dependency map',
      'Advanced search',
      'Reports',
      'Onboarding',
      'Review',
      'Audit log',
      'Users & roles',
      'Applications',
    ]);
  });

  it('Developer has no administration and Reader has no control group either', async () => {
    const { unmount } = await renderApp({ role: 'DEVELOPER' });
    await navLinks();
    expect(screen.getByText('Control')).toBeInTheDocument();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    unmount();
    await renderApp({ role: 'READER' });
    await navLinks();
    expect(screen.queryByText('Control')).not.toBeInTheDocument();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  it('marks the item of the current route (also on detail routes) ', async () => {
    await renderApp({ path: '/variables/3' });
    const links = await navLinks();
    const current = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Variables']);
  });

  it('does not render the items that depend on modules that do not exist yet', async () => {
    await renderApp();
    await navLinks();
    // The quick search (S-30) has its module now: its tests are in quickSearch.test.tsx.
    for (const text of ['Jira connected']) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Help' })).not.toBeInTheDocument();
  });
});

describe('breadcrumb', () => {
  it('links the application to the dashboard and the section to its list', async () => {
    await renderApp({ path: '/variables' });
    const breadcrumb = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByRole('link', { name: /SAR/ })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(within(breadcrumb).getByText('Variables')).toHaveAttribute('aria-current', 'page');
  });
});

describe('top bar and application card', () => {
  it('shows the application, the section in the breadcrumb and the user block', async () => {
    await renderApp({ path: '/screens/4', name: 'Camila Castillo' });
    const breadcrumb = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('SAR')).toBeInTheDocument();
    // Detail routes show only the section title.
    expect(within(breadcrumb).getByText('Screens')).toBeInTheDocument();
    expect(screen.getByText('Camila Castillo')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.getByText('Power Apps')).toBeInTheDocument();
  });

  it('switches application through the selector', async () => {
    const user = setupUser();
    const { apps } = await renderApp({
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
    });
    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('Billing')).toBeInTheDocument();
    expect(apps.get).toHaveBeenCalledWith('/applications', expect.anything());
    expect(localStorage.length).toBeGreaterThan(0); // only the selected id, never a token
  });

  it('the user block is a menu button and shows no chevron', async () => {
    const user = setupUser();
    await renderApp();
    const trigger = await screen.findByRole('button', { name: /Ana Mora/ });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger.querySelector('svg')).toBeNull();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('Sign out ends the session and goes to /login', async () => {
    const user = setupUser();
    const { router, backend, manager } = await renderApp();
    await user.click(await screen.findByRole('button', { name: /Ana Mora/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(backend.count('/auth/logout')).toBe(1);
    expect(manager.getSnapshot().status).toBe('anonymous');
    // An explicit sign out does not remember a destination.
    expect(router.state.location.state).toBeNull();
  });

  it('warns when the server could not be reached to sign out', async () => {
    const user = setupUser();
    const { manager } = await renderApp();
    vi.spyOn(manager, 'logout').mockRejectedValue(
      new ApiError({ status: 0, code: 'NETWORK_ERROR' }),
    );
    await user.click(await screen.findByRole('button', { name: /Ana Mora/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(await screen.findByText(SIGN_OUT_FAILED_TEXT)).toBeInTheDocument();
  });
});

describe('offline strip (S-46)', () => {
  it('appears when the browser goes offline and disappears when it is back', async () => {
    await renderApp();
    await navLinks();
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      fireEvent(window, new Event('offline'));
    });
    // The page behind (the dashboard over the minimal fake) may show an alert of its own: the strip is the one that
    // says the browser is offline.
    const strip = (await screen.findByText(/You're offline/)).closest('[role="alert"]');
    expect(strip).toHaveTextContent(
      "You're offline. Changes can't be saved until the connection is back.",
    );
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    act(() => {
      fireEvent(window, new Event('online'));
    });
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
  });
});

describe('no application registered', () => {
  it('shows the neutral empty state', async () => {
    await renderApp({ applications: [] });
    expect(await screen.findByRole('heading', { name: 'No applications yet' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'An administrator needs to register an application before documentation can start.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Register/)).not.toBeInTheDocument();
  });

  it('leaves /admin/applications reachable so the first one can be registered', async () => {
    await renderApp({ applications: [], path: '/admin/applications' });
    // The page of the module itself (not the empty state of the shell) invites to register the first one.
    expect(
      await screen.findByText('Register the first application to start documenting it.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(NO_APPLICATIONS_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Applications' })).toBeInTheDocument();
  });
});

describe('archived application (S-09b)', () => {
  const archived = makeApplication(1, {
    name: 'Application C',
    platform: 'Power Apps',
    description: 'Old app',
    jiraProjectKey: 'ABC',
    status: 'ARCHIVED',
  });

  it('shows the strip and the chip to every role, and Unarchive only to the Administrator', async () => {
    for (const [role, canUnarchive] of [
      ['ADMINISTRATOR', true],
      ['DEVELOPER', false],
      ['READER', false],
    ] as const) {
      const { unmount } = await renderApp({ role, applications: [archived], path: '/variables' });
      const strip = await screen.findByText('This application is archived.');
      expect(strip.closest('[role="alert"]')).toHaveTextContent('Its documentation is read-only.');
      expect(screen.getByText('Archived · read-only')).toBeInTheDocument();
      if (canUnarchive)
        expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument();
      else expect(screen.queryByRole('button', { name: 'Unarchive' })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('GETs the current representation and PUTs every field with If-Match, changing only the status', async () => {
    const user = setupUser();
    const { apps } = await renderApp({ applications: [archived] });
    await user.click(await screen.findByRole('button', { name: 'Unarchive' }));
    await waitFor(() => {
      expect(apps.put).toHaveBeenCalledTimes(1);
    });
    expect(apps.get).toHaveBeenCalledWith('/applications/{id}', { path: { id: 1 } });
    expect(apps.put.mock.calls[0]).toEqual([
      '/applications/{id}',
      {
        path: { id: 1 },
        ifMatch: 'W/"7"',
        body: {
          name: 'Application C',
          platform: 'Power Apps',
          description: 'Old app',
          jiraProjectKey: 'ABC',
          status: 'ACTIVE',
        },
      },
    ]);
    // The applications are reloaded and the strip goes away.
    await waitFor(() => {
      expect(screen.queryByText('This application is archived.')).not.toBeInTheDocument();
    });
  });

  it('on 412 reloads and shows the catalog message', async () => {
    const user = setupUser();
    const { apps } = await renderApp({ applications: [archived] });
    apps.state.putError = new ApiError({
      status: 412,
      code: 'PRECONDITION_FAILED',
      details: { element: 'application' },
    });
    await screen.findByRole('button', { name: 'Unarchive' });
    const listCallsBefore = apps.get.mock.calls.filter(([path]) => path === '/applications').length;
    await user.click(screen.getByRole('button', { name: 'Unarchive' }));
    expect(
      await screen.findByText(
        'Someone else saved changes to this application after you opened it. Reload to see their version.',
      ),
    ).toBeInTheDocument();
    const listCallsAfter = apps.get.mock.calls.filter(([path]) => path === '/applications').length;
    expect(listCallsAfter).toBe(listCallsBefore + 1);
  });
});
