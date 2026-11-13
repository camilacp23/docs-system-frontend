// Archive (S-09) and unarchive an application: the confirmation, the PUT that carries EVERY field with If-Match, the
// shell that follows without reloading the page (selector, application card, and the read-only strip of S-09b on the
// other pages when the selected application is archived), the refusals, and offline.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { renderApplications } from '../helpers/renderApplications';
import { setupSettledUser, type User } from '../helpers/setupUser';

afterEach(() => {
  vi.restoreAllMocks();
});

const STRIP = 'This application is archived.';

async function openMenu(user: User, rowName: string) {
  const row = (await screen.findByRole('rowheader', { name: rowName })).closest(
    'tr',
  ) as HTMLElement;
  await user.click(within(row).getByRole('button', { name: `Actions for ${rowName}` }));
}

async function openArchive(user: User, rowName: string) {
  await openMenu(user, rowName);
  await user.click(await screen.findByRole('menuitem', { name: 'Archive' }));
  return within(await screen.findByRole('dialog', { name: `Archive ${rowName}?` }));
}

const sidebar = () => within(screen.getByRole('complementary', { name: 'Sidebar' }));

async function selectInSidebar(user: User, name: string) {
  await user.click(await sidebar().findByRole('button', { name: 'Switch application' }));
  const list = within(await sidebar().findByRole('list', { name: 'Applications' }));
  await user.click(await list.findByRole('button', { name: new RegExp(name) }));
}

describe('Archive application', () => {
  it('asks first, with the text of the frame, and Cancel changes nothing', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    const dialog = await openArchive(user, 'SAR');

    expect(
      dialog.getByText(
        'Its documentation becomes read-only for everyone. Nothing is deleted, and you can unarchive it later.',
      ),
    ).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.callsTo('PUT /applications/{id}')).toHaveLength(0);
  });

  it('closes with Escape and returns the focus to the row menu button', async () => {
    const user = setupSettledUser();
    await renderApplications();
    await openArchive(user, 'SAR');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for SAR' })).toHaveFocus();
  });

  it('reads the application and sends EVERY field back with If-Match, changing only the status', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    const dialog = await openArchive(user, 'SAR');

    await user.click(dialog.getByRole('button', { name: 'Archive application' }));

    expect(await screen.findByText('SAR archived.')).toBeInTheDocument();
    expect(api.callsTo('GET /applications/{id}')[0]?.options.path).toEqual({ id: 1 });
    const put = api.callsTo('PUT /applications/{id}')[0];
    expect(put?.options.ifMatch).toBe('W/"1"');
    expect(put?.options.path).toEqual({ id: 1 });
    expect(put?.options.body).toEqual({
      name: 'SAR',
      platform: 'Power Apps',
      description: 'Sistema de Administración de Requerimientos',
      jiraProjectKey: null,
      status: 'ARCHIVED',
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows the application as archived in the list and in the counts', async () => {
    const user = setupSettledUser();
    await renderApplications();
    const dialog = await openArchive(user, 'SAR');

    await user.click(dialog.getByRole('button', { name: 'Archive application' }));

    await screen.findByText('SAR archived.');
    const row = (await screen.findByRole('rowheader', { name: 'SAR' })).closest(
      'tr',
    ) as HTMLElement;
    await waitFor(() => {
      expect(within(row).getByText('Archived')).toBeInTheDocument();
    });
    expect(await screen.findByText('3 applications · 2 archived')).toBeInTheDocument();
    await openMenu(user, 'SAR');
    expect(await screen.findByRole('menuitem', { name: 'Unarchive' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Archive' })).not.toBeInTheDocument();
  });

  it('archiving another application leaves the shell as it is', async () => {
    const user = setupSettledUser();
    await renderApplications();
    // Application B is the selected one.
    expect(await sidebar().findByText('Application B')).toBeInTheDocument();
    const dialog = await openArchive(user, 'SAR');

    await user.click(dialog.getByRole('button', { name: 'Archive application' }));
    await screen.findByText('SAR archived.');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.queryByText(STRIP)).not.toBeInTheDocument();
    expect(sidebar().queryByText('Archived · read-only')).not.toBeInTheDocument();
  });

  describe('the selected application', () => {
    it('shows the read-only strip and the chip at once, without reloading the page', async () => {
      const user = setupSettledUser();
      const { api } = await renderApplications();
      expect(await sidebar().findByText('Application B')).toBeInTheDocument();
      expect(screen.queryByText(STRIP)).not.toBeInTheDocument();
      const dialog = await openArchive(user, 'Application B');

      await user.click(dialog.getByRole('button', { name: 'Archive application' }));

      expect(await screen.findByText(STRIP)).toBeInTheDocument();
      expect(await sidebar().findByText('Archived · read-only')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument();
      // The shell read the list again; the name is still there (nothing flashed a loading state).
      expect(sidebar().getByText('Application B')).toBeInTheDocument();
      expect(api.callsTo('GET /applications').length).toBeGreaterThan(2);
    });

    it('the strip is there on the other pages too', async () => {
      const user = setupSettledUser();
      await renderApplications();
      expect(await sidebar().findByText('Application B')).toBeInTheDocument();
      const dialog = await openArchive(user, 'Application B');
      await user.click(dialog.getByRole('button', { name: 'Archive application' }));
      await screen.findByText(STRIP);

      await user.click(
        within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
          name: 'Variables',
        }),
      );

      expect(await screen.findByRole('heading', { name: 'Variables' })).toBeInTheDocument();
      expect(screen.getByText(STRIP)).toBeInTheDocument();
      expect(screen.getByText('Read-only: the application is archived.')).toBeInTheDocument();
    });

    it('Unarchive in the strip and in the row menu both lift it', async () => {
      const user = setupSettledUser();
      await renderApplications();
      expect(await sidebar().findByText('Application B')).toBeInTheDocument();
      const dialog = await openArchive(user, 'Application B');
      await user.click(dialog.getByRole('button', { name: 'Archive application' }));
      await screen.findByText(STRIP);

      await openMenu(user, 'Application B');
      await user.click(await screen.findByRole('menuitem', { name: 'Unarchive' }));

      expect(await screen.findByText('Application B unarchived.')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText(STRIP)).not.toBeInTheDocument();
      });
      expect(sidebar().queryByText('Archived · read-only')).not.toBeInTheDocument();
    });
  });

  it('shows the catalog text of a 412 in the modal and a new attempt reads the application again', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    api.failNext(
      'PUT /applications/{id}',
      new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }),
    );
    const dialog = await openArchive(user, 'SAR');

    await user.click(dialog.getByRole('button', { name: 'Archive application' }));

    expect(
      await dialog.findByText(
        'Someone else saved changes to this application after you opened it. Reload to see their version.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Archive application' }));
    expect(await screen.findByText('SAR archived.')).toBeInTheDocument();
    expect(api.callsTo('GET /applications/{id}')).toHaveLength(2);
  });

  it('shows NOT_FOUND in the modal when the application was removed meanwhile', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    api.failNext('GET /applications/{id}', new ApiError({ status: 404, code: 'NOT_FOUND' }));
    const dialog = await openArchive(user, 'SAR');

    await user.click(dialog.getByRole('button', { name: 'Archive application' }));

    expect(
      await dialog.findByText("This application doesn't exist. It may have been deleted."),
    ).toBeInTheDocument();
    expect(api.callsTo('PUT /applications/{id}')).toHaveLength(0);
  });

  it('disables archiving, with the reason, while offline', async () => {
    const user = setupSettledUser();
    await renderApplications();
    const dialog = await openArchive(user, 'SAR');

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(dialog.getByRole('button', { name: 'Archive application' })).toBeDisabled();
    });
    expect(dialog.getAllByText(/You're offline/).length).toBeGreaterThan(0);
  });

  it('disables every row action with the reason while offline', async () => {
    const user = setupSettledUser();
    await renderApplications();
    await screen.findByRole('rowheader', { name: 'SAR' });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await openMenu(user, 'SAR');
    for (const name of ['Edit', 'Archive']) {
      const item = await screen.findByRole('menuitem', { name });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveAttribute(
        'title',
        "You're offline. Changes can't be saved until the connection is back.",
      );
    }
  });
});

describe('Unarchive application', () => {
  it('reads the application and sends EVERY field back with If-Match, with no confirmation', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    await openMenu(user, 'Application C');

    await user.click(await screen.findByRole('menuitem', { name: 'Unarchive' }));

    expect(await screen.findByText('Application C unarchived.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const put = api.callsTo('PUT /applications/{id}')[0];
    expect(put?.options.ifMatch).toBe('W/"1"');
    expect(put?.options.body).toEqual({
      name: 'Application C',
      platform: 'Power Apps',
      description: 'Sample description',
      jiraProjectKey: null,
      status: 'ACTIVE',
    });
    expect(api.callsTo('GET /applications/{id}')).toHaveLength(1);
    const row = (await screen.findByRole('rowheader', { name: 'Application C' })).closest(
      'tr',
    ) as HTMLElement;
    await waitFor(() => {
      expect(within(row).getByText('Active')).toBeInTheDocument();
    });
    expect(await screen.findByText('3 applications')).toBeInTheDocument();
  });

  it('shows the catalog text in a warning toast when it fails and reads the list again', async () => {
    const user = setupSettledUser();
    const { api } = await renderApplications();
    api.failNext(
      'PUT /applications/{id}',
      new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }),
    );
    const before = api.callsTo('GET /applications').length;
    await openMenu(user, 'Application C');

    await user.click(await screen.findByRole('menuitem', { name: 'Unarchive' }));

    expect(
      await screen.findByText(
        'Someone else saved changes to this application after you opened it. Reload to see their version.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(api.callsTo('GET /applications').length).toBeGreaterThan(before);
    });
  });

  it('the selected archived application leaves read-only mode on every page', async () => {
    const user = setupSettledUser();
    await renderApplications();
    await selectInSidebar(user, 'Application C');
    expect(await screen.findByText(STRIP)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unarchive' }));

    await waitFor(() => {
      expect(screen.queryByText(STRIP)).not.toBeInTheDocument();
    });
    expect(sidebar().queryByText('Archived · read-only')).not.toBeInTheDocument();
  });
});
