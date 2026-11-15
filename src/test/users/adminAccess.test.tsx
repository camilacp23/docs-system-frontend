// Access to the administration routes (SDD Table 56): only the Administrator opens /admin/users and
// /admin/applications; the Developer and the Reader get S-41b ("You don't have access to this page") and the sidebar
// hides both items. This is usability only: the API decides (NFR-03), and the pages make no request when denied.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderUsers } from '../helpers/renderUsers';

const ROUTES = ['/admin/users', '/admin/applications'] as const;

describe('administration routes', () => {
  it.each([
    ['DEVELOPER', 'Developer', '/admin/users'],
    ['DEVELOPER', 'Developer', '/admin/applications'],
    ['READER', 'Reader', '/admin/users'],
    ['READER', 'Reader', '/admin/applications'],
  ] as const)(
    '%s on %s shows S-41b and makes no request to the page',
    async (role, label, path) => {
      const { api } = await renderUsers({ role, path });

      expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
      expect(
        screen.getByText(
          `Your role (${label}) doesn't include it. Ask an administrator if you need it.`,
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument();
      expect(api.callsTo('GET /users')).toHaveLength(0);
      expect(screen.queryByRole('link', { name: 'Users & roles' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Applications' })).not.toBeInTheDocument();
    },
  );

  it.each(ROUTES)('the Administrator opens %s', async (path) => {
    await renderUsers({ path });
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("You don't have access to this page")).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: /main|primary|sidebar/i });
    expect(within(nav).getByRole('link', { name: 'Users & roles' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Applications' })).toBeInTheDocument();
  });
});
