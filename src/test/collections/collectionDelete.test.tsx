// Delete collection (S-17): the confirmation with the impact computed from the collection (fields, variable
// assignments, derivations; the API gives no screen links, D-79), Delete disabled until the impact is known, the
// server refusals in the modal, archived and offline, and the list after deleting.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { deleteImpact, impactSummary } from '../../modules/collections/deleteImpact';
import { makeCollection, makeField } from '../helpers/fakeCollectionsApi';
import { makeApplication } from '../helpers/renderApp';
import { renderCollections } from '../helpers/renderCollections';

type User = ReturnType<typeof userEvent.setup>;

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
  const impact = (fields: number, assignments: number, derivations: number) => ({
    fields,
    assignments,
    derivations,
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

  it('is computed from the collection itself', () => {
    expect(
      deleteImpact(
        makeCollection(1, 'colX', {
          fields: [makeField(1, 'A', 0), makeField(2, 'B', 1)],
          derivedFrom: [{ id: 2, name: 'colY' }],
        }),
      ),
    ).toEqual({ fields: 2, assignments: 0, derivations: 1 });
  });
});

describe('delete collection', () => {
  it('asks with the impact, deletes, says so and refreshes the list and the counts', async () => {
    const user = userEvent.setup();
    const { api, router } = await renderCollections();

    const dialog = await openDelete(user, 'colClientes');
    expect(
      await dialog.findByText(
        'Its 4 fields, 3 variable assignments and 1 derivation are deleted too. The audit log keeps a record of everything deleted.',
      ),
    ).toBeInTheDocument();
    expect(dialog.queryByText(/screen/)).not.toBeInTheDocument();
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
    expect(await screen.findByText(/3 collections/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/collections');
  });

  it('says so when the collection has nothing attached', async () => {
    const user = userEvent.setup();
    await renderCollections({ collections: [makeCollection(1, 'colVacia')] });

    const dialog = await openDelete(user, 'colVacia');

    const text = (await dialog.findByText(/has no fields or links/)).closest('p');
    expect(text).toHaveTextContent(
      'colVacia has no fields or links. The audit log keeps a record of everything deleted.',
    );
  });

  it('keeps Delete disabled until the impact is known and offers to try again if it fails', async () => {
    const user = userEvent.setup();
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
    const user = userEvent.setup();
    const { api } = await renderCollections();

    const dialog = await openDelete(user, 'colClientes');
    await dialog.findByText(/Its 4 fields/);
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.callsTo('DELETE /collections/{id}')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Actions for colClientes' })).toHaveFocus();
  });

  it('shows the catalog message of a server refusal inside the modal', async () => {
    const user = userEvent.setup();
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
    const user = userEvent.setup();
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
    const user = userEvent.setup();
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
    const user = userEvent.setup();
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
