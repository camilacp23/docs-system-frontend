// Route guards: access by role (SDD Table 56), redirect to /login remembering the destination, no redirect while
// the session is being recovered, /login with a session, and the "not found" page.
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { readDestination } from '../../app/router/destination';
import { APP_ROUTES, type Role } from '../../app/router/routes';
import { renderApp } from '../helpers/renderApp';

const NO_ACCESS = "You don't have access to this page";

const FORBIDDEN: Record<Role, string[]> = {
  ADMINISTRATOR: [],
  DEVELOPER: ['/admin/users', '/admin/applications'],
  READER: ['/review', '/audit', '/admin/users', '/admin/applications', '/variables/5/edit'],
};

/** Modules that already have their own pages: the placeholder text no longer applies to them. */
const hasOwnPage = (path: string) => path.startsWith('/variables');

const PROTECTED_PATHS = APP_ROUTES.map((route) => route.path.replace(':id', '5'));

describe('role guard', () => {
  for (const role of ['ADMINISTRATOR', 'DEVELOPER', 'READER'] as const) {
    it(`${role}: opens what its role allows and gets "No access" (S-41b) on the rest`, async () => {
      for (const path of PROTECTED_PATHS) {
        const { unmount } = await renderApp({ role, path });
        if (FORBIDDEN[role].includes(path)) {
          expect(await screen.findByRole('heading', { name: NO_ACCESS })).toBeInTheDocument();
          expect(screen.getByText(/Your role \(/)).toBeInTheDocument();
          // The shell stays around the page.
          expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
        } else if (hasOwnPage(path)) {
          expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
          expect(screen.queryByRole('heading', { name: NO_ACCESS })).not.toBeInTheDocument();
        } else {
          expect(await screen.findByText('This module is not available yet.')).toBeInTheDocument();
          expect(screen.queryByRole('heading', { name: NO_ACCESS })).not.toBeInTheDocument();
        }
        unmount();
      }
    });
  }

  it('shows the role in the S-41b text', async () => {
    await renderApp({ role: 'READER', path: '/review' });
    expect(
      await screen.findByText(
        "Your role (Reader) doesn't include it. Ask an administrator if you need it.",
      ),
    ).toBeInTheDocument();
  });

  it('Go to Dashboard leaves the no-access page', async () => {
    const { router } = await renderApp({ role: 'READER', path: '/audit' });
    (await screen.findByRole('button', { name: 'Go to Dashboard' })).click();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard');
    });
  });
});

describe('authentication guard', () => {
  it('does not redirect while the session is being recovered, then goes to /login remembering the page', async () => {
    const { router } = await renderApp({ signedIn: false, path: '/screens/9?x=1' });
    // The refresh is still in flight: the destination must not be lost.
    expect(router.state.location.pathname).toBe('/screens/9');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(router.state.location.state).toEqual({ from: '/screens/9?x=1' });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('sends /login to the dashboard when there is a session', async () => {
    const { router } = await renderApp({ path: '/login' });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard');
    });
  });

  it('sends "/" to /dashboard', async () => {
    const { router } = await renderApp({ path: '/' });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard');
    });
  });

  it('shows "not found" (S-41a) inside the shell for an unknown path', async () => {
    await renderApp({ path: '/nope' });
    expect(
      await screen.findByRole('heading', { name: "This page doesn't exist" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});

describe('readDestination', () => {
  it('accepts internal paths and rejects anything else', () => {
    expect(readDestination({ from: '/screens/3?tab=x#y' })).toBe('/screens/3?tab=x#y');
    expect(readDestination({ from: '//evil.example.com' })).toBeNull();
    expect(readDestination({ from: 'https://evil.example.com' })).toBeNull();
    expect(readDestination({ from: '/login' })).toBeNull();
    expect(readDestination(null)).toBeNull();
    expect(readDestination({ from: 5 })).toBeNull();
  });
});
