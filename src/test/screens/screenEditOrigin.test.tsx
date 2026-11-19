// Screen edit page, the origin row (contract 0.5.0): the variable that is created in the screen keeps its "Origin" tag and its Write
// mode, and its "Used in" (`originUsedIn`) is a field. It is NOT part of the PUT of the screen: saving makes two independent calls, the
// PUT /screens/{id} and, for each origin row whose Used in changed, a read of the variable and its own PUT /variables/{id} with its ETag.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { sampleVariables } from '../helpers/renderVariables';
import { openEdit, lastPut } from '../helpers/screenEditHelpers';

const field = () =>
  screen.getByRole<HTMLInputElement>('textbox', { name: 'Used in (origin locMostrarDetalle)' });
const save = () => screen.getByRole('button', { name: 'Save changes' });

async function type(user: Awaited<ReturnType<typeof openEdit>>['user'], text: string) {
  await user.clear(field());
  if (text !== '') {
    await user.click(field());
    await user.paste(text);
  }
}

const variablePuts = (api: Awaited<ReturnType<typeof openEdit>>['api']) =>
  api.collectionsApi.variablesApi.callsTo('PUT /variables/{id}');

describe('screen edit: the Used in of the origin row', () => {
  it('never sends the origin row with the screen: the PUT of the screen has no link to the variable that is created there', async () => {
    const { user, api } = await openEdit({ tab: 'links' });
    await type(user, 'OnVisible');
    await user.click(save());

    await waitFor(() => {
      expect(variablePuts(api)).toHaveLength(1);
    });
    const { body } = lastPut(api);
    // The origin row (id 501) and its variable are not in the variable links of the screen.
    expect(
      body.variableLinks.some((link) => link.variableId === 4 && link.usedIn === 'origin'),
    ).toBe(false);
    expect(JSON.stringify(body)).not.toContain('"origin"');
  });

  it('saves the screen and then the variable: its own PUT with the ETag and the complete variable', async () => {
    const { user, api } = await openEdit({ tab: 'links' });
    expect(field()).toHaveValue('');

    await type(user, 'btnGuardar.OnSelect');
    await user.click(save());

    await waitFor(() => {
      expect(variablePuts(api)).toHaveLength(1);
    });
    expect(api.callsTo('PUT /screens/{id}')).toHaveLength(1);
    const put = variablePuts(api)[0];
    expect(put?.options.path).toEqual({ id: 4 });
    expect(put?.options.ifMatch).toMatch(/^W\//);
    expect(put?.options.body).toMatchObject({
      name: 'locMostrarDetalle',
      scope: 'CONTEXT',
      originScreenId: 12,
      originUsedIn: 'btnGuardar.OnSelect',
    });
    expect(await screen.findByText('Screen saved.')).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Detalle', level: 1 })).toBeVisible();
    // The variable holds it now: the detail of the screen shows it on the origin row.
    expect(
      api.collectionsApi.variablesApi.state.variables.find((v) => v.id === 4)?.originUsedIn,
    ).toBe('btnGuardar.OnSelect');
  });

  it('does not touch the variable when the Used in did not change', async () => {
    const { user, api } = await openEdit({ tab: 'links' });
    await user.click(save());

    await waitFor(() => {
      expect(api.callsTo('PUT /screens/{id}')).toHaveLength(1);
    });
    expect(variablePuts(api)).toHaveLength(0);
  });

  it('sends null when the field is emptied', async () => {
    const { user, api } = await openEdit({
      tab: 'links',
      variables: sampleVariables().map((v) =>
        v.id === 4 ? { ...v, originUsedIn: 'OnVisible' } : v,
      ),
    });
    expect(field()).toHaveValue('OnVisible');

    await type(user, '');
    await user.click(save());

    await waitFor(() => {
      expect(variablePuts(api)).toHaveLength(1);
    });
    expect(variablePuts(api)[0]?.options.body).toMatchObject({ originUsedIn: null });
  });

  it('checks the format of the Used in on the row before saving anything', async () => {
    const { user, api } = await openEdit({ tab: 'links' });

    await type(user, 'two words');
    await user.click(save());

    expect(await screen.findByText("Used in isn't in a valid format.")).toBeVisible();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo('PUT /screens/{id}')).toHaveLength(0);
    expect(variablePuts(api)).toHaveLength(0);
  });

  it('refuses the word origin, which is reserved for the row itself', async () => {
    const { user, api } = await openEdit({ tab: 'links' });

    await type(user, 'origin');
    await user.click(save());

    expect(await screen.findByText("Used in isn't in a valid format.")).toBeVisible();
    expect(api.callsTo('PUT /screens/{id}')).toHaveLength(0);
  });

  it('says it when the variable could not be saved: the screen is saved, the page stays and keeps what was typed', async () => {
    const { user, api } = await openEdit({
      tab: 'links',
      prepare: (fake) => {
        fake.collectionsApi.variablesApi.failNext(
          'PUT /variables/{id}',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });

    await type(user, 'OnVisible');
    await user.click(save());

    expect(
      await screen.findByText(
        'Screen saved, but the "Used in" of locMostrarDetalle could not be saved.',
      ),
    ).toBeVisible();
    const row = within(screen.getByRole('table', { name: 'Variable links' }));
    expect(row.getByText('Something went wrong on our side. Try again in a moment.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Edit Detalle', level: 1 })).toBeVisible();
    expect(field()).toHaveValue('OnVisible');
    expect(api.callsTo('PUT /screens/{id}')).toHaveLength(1);

    // A second try saves it (the screen is sent again, which changes nothing, and the variable is written).
    await user.click(save());
    await screen.findByRole('heading', { name: 'Detalle', level: 1 });
    expect(variablePuts(api)).toHaveLength(2);
  });

  it('takes the 412 of the variable as any refusal: with its catalog text on the row', async () => {
    const { user } = await openEdit({
      tab: 'links',
      prepare: (fake) => {
        fake.collectionsApi.variablesApi.failNext(
          'PUT /variables/{id}',
          new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }),
        );
      },
    });

    await type(user, 'OnVisible');
    await user.click(save());

    expect(
      await screen.findByText(
        'Screen saved, but the "Used in" of locMostrarDetalle could not be saved.',
      ),
    ).toBeVisible();
  });
});
