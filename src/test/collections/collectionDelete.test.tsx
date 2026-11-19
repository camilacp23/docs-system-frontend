// Delete collection (S-17): the confirmation with the impact (fields, variable assignments and derivations of the
// collection, and its links to screens from GET /dependencies/collections/{id}?depth=1, D-103), Delete disabled until
// both reads are known, the failure of either one with its own retry, the server refusals in the modal, archived and
// offline, and the list after deleting.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { deleteImpact, impactSummary } from '../../modules/collections/deleteImpact';
import { AUDIT_NOTE_TEXT } from '../../modules/shared/DeleteImpactBody';
import { makeCollection, makeField } from '../helpers/fakeCollectionsApi';
import { makeApplication } from '../helpers/renderApp';
import { renderCollections } from '../helpers/renderCollections';
import { setupUser, type User } from '../helpers/setupUser';

async function openDelete(user: User, name: string) {
  await screen.findByRole('link', { name });
  await user.click(screen.getByRole('button', { name: `Actions for ${name}` }));
  await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
  return within(await screen.findByRole('dialog', { name: `Delete ${name}?` }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('impactSummary', () => {
  const impact = (fields: number, assignments: number, derivations: number, screens = 0) => ({
    fields,
    assignments,
    derivations,
    screens,
  });

  it('counts only what exists and never invents a number', () => {
    expect(impactSummary(impact(8, 3, 1))).toBe(
      'Its 8 fields, 3 variable assignments and 1 derivation are deleted too.',
    );
    expect(impactSummary(impact(2, 0, 0))).toBe('Its 2 fields are deleted too.');
    expect(impactSummary(impact(0, 1, 2))).toBe(
      'Its 1 variable assignment and 2 derivations are deleted too.',
    );
    expect(impactSummary(impact(1, 0, 0))).toBe('Its 1 field is deleted too.');
    expect(impactSummary(impact(0, 0, 0))).toBeNull();
  });

  it('adds the links to screens, counting screens and not links (D-103)', () => {
    expect(impactSummary(impact(8, 3, 0, 2))).toBe(
      'Its 8 fields, 3 variable assignments and its links to 2 screens are deleted too.',
    );
    expect(impactSummary(impact(8, 3, 1, 2))).toBe(
      'Its 8 fields, 3 variable assignments, 1 derivation and its links to 2 screens are deleted too.',
    );
    expect(impactSummary(impact(0, 0, 0, 3))).toBe('Its links to 3 screens are deleted too.');
    expect(impactSummary(impact(0, 0, 0, 1))).toBe('Its link to 1 screen is deleted too.');
    expect(impactSummary(impact(2, 0, 0, 1))).toBe(
      'Its 2 fields and its link to 1 screen are deleted too.',
    );
  });

  it('is computed from the collection itself', () => {
    expect(
      deleteImpact(
        makeCollection(1, 'colX', {
          fields: [makeField(1, 'A', 0), makeField(2, 'B', 1)],
          derivedFrom: [{ id: 2, name: 'colY' }],
        }),
        4,
      ),
    ).toEqual({ fields: 2, assignments: 0, derivations: 1, screens: 4 });
  });
});

describe('delete collection', () => {
  it('asks with the impact, deletes, says so and refreshes the list and the counts', async () => {
    const user = setupUser();
    const { api, router } = await renderCollections();

    const dialog = await openDelete(user, 'colClientes');
    expect(
      await dialog.findByText(
        'Its 4 fields, 3 variable assignments, 1 derivation and its links to 2 screens are deleted too.',
      ),
    ).toBeInTheDocument();
    expect(dialog.getByText(AUDIT_NOTE_TEXT)).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Delete collection' }));

    await waitFor(() => {
      expect(api.callsTo('DELETE /collections/{id}')).toHaveLength(1);
    });
    expect(api.callsTo('DELETE /collections/{id}')[0]?.options.path).toEqual({ id: 11 });
    expect(await screen.findByText('colClientes deleted.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'colClientes' })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Collection counts' })).toHaveTextContent(
        /3Collections/,
      );
    });
    expect(router.state.location.pathname).toBe('/collections');
  });

  it('says so when the collection has nothing attached', async () => {
    const user = setupUser();
    await renderCollections({ collections: [makeCollection(1, 'colVacia')] });

    const dialog = await openDelete(user, 'colVacia');

    const text = (await dialog.findByText(/has no fields or links/)).closest('p');
    expect(text).toHaveTextContent('colVacia has no fields or links.');
  });

  it('counts the screens once each when a screen uses the collection in several places', async () => {
    const user = setupUser();
    await renderCollections({
      usage: {
        11: [
          { screenId: 11, screenName: 'Inicio', accessMode: 'READ', usedIn: 'OnVisible' },
          { screenId: 11, screenName: 'Inicio', accessMode: 'WRITE', usedIn: 'btnA.OnSelect' },
          { screenId: 12, screenName: 'Detalle', accessMode: 'READ', usedIn: 'OnVisible' },
        ],
      },
    });

    const dialog = await openDelete(user, 'colClientes');

    expect(
      await dialog.findByText(/and its links to 2 screens are deleted too/),
    ).toBeInTheDocument();
  });

  it('keeps Delete disabled when the screens cannot be read, says so, and reads only that again', async () => {
    const user = setupUser();
    const { api } = await renderCollections({
      prepare: (fake) => {
        fake.failNext(
          'GET /dependencies/{type}/{id}',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });

    const dialog = await openDelete(user, 'colClientes');

    expect(
      await dialog.findByText("Couldn't check what depends on this collection."),
    ).toBeVisible();
    expect(dialog.getByRole('button', { name: 'Delete collection' })).toBeDisabled();
    expect(dialog.queryByText(/are deleted too/)).not.toBeInTheDocument();
    const collectionReads = api.callsTo('GET /collections/{id}').length;
    await user.click(dialog.getByRole('button', { name: 'Try again' }));
    await dialog.findByText(/and its links to 2 screens are deleted too/);
    expect(dialog.getByRole('button', { name: 'Delete collection' })).toBeEnabled();
    expect(api.callsTo('GET /collections/{id}')).toHaveLength(collectionReads);
    expect(api.callsTo('DELETE /collections/{id}')).toHaveLength(0);
  });

  it('keeps Delete disabled until the impact is known and offers to try again if it fails', async () => {
    const user = setupUser();
    await renderCollections({
      prepare: (api) => {
        api.failNext(
          'GET /collections/{id}',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });

    const dialog = await openDelete(user, 'colClientes');

    expect(
      await dialog.findByText("Couldn't check what depends on this collection."),
    ).toBeVisible();
    expect(dialog.getByRole('button', { name: 'Delete collection' })).toBeDisabled();
    await user.click(dialog.getByRole('button', { name: 'Try again' }));
    await dialog.findByText(/Its 4 fields/);
    expect(dialog.getByRole('button', { name: 'Delete collection' })).toBeEnabled();
  });

  it('cancels without deleting and returns the focus to the row menu', async () => {
    const user = setupUser();
    const { api } = await renderCollections();

    const dialog = await openDelete(user, 'colClientes');
    await dialog.findByText(/Its 4 fields/);
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.callsTo('DELETE /collections/{id}')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Actions for colClientes' })).toHaveFocus();
  });

  it('shows the catalog message of a server refusal inside the modal', async () => {
    const user = setupUser();
    const { api } = await renderCollections();

    const dialog = await openDelete(user, 'colClientes');
    await dialog.findByText(/Its 4 fields/);
    api.failNext('DELETE /collections/{id}', new ApiError({ status: 404, code: 'NOT_FOUND' }));
    await user.click(dialog.getByRole('button', { name: 'Delete collection' }));

    expect(
      await dialog.findByText("This collection doesn't exist. It may have been deleted."),
    ).toBeVisible();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('goes back one page when the last row of a page is deleted', async () => {
    const user = setupUser();
    const many = Array.from({ length: 21 }, (_, index) =>
      makeCollection(100 + index, `col${String(index).padStart(2, '0')}`),
    );
    const { router } = await renderCollections({
      path: '/collections?page=2',
      collections: many,
    });

    const dialog = await openDelete(user, 'col20');
    await dialog.findByText(/has no fields or links/);
    await user.click(dialog.getByRole('button', { name: 'Delete collection' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await screen.findByRole('link', { name: 'col00' })).toBeInTheDocument();
  });

  it('disables Delete with the reason while the browser is offline', async () => {
    const user = setupUser();
    await renderCollections();

    const dialog = await openDelete(user, 'colClientes');
    await dialog.findByText(/Its 4 fields/);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(dialog.getByRole('button', { name: 'Delete collection' })).toBeDisabled();
    expect(
      dialog.getByText("You're offline. Changes can't be saved until the connection is back."),
    ).toBeInTheDocument();
  });

  it('offers no delete when the application is archived', async () => {
    const user = setupUser();
    await renderCollections({
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });

    await screen.findByRole('link', { name: 'colClientes' });
    await user.click(screen.getByRole('button', { name: 'Actions for colClientes' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers no delete to the Reader', async () => {
    await renderCollections({ role: 'READER' });

    await screen.findByRole('link', { name: 'colClientes' });
    expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
  });
});
