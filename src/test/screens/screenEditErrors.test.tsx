// Errors of the screen update on the edit page: each one on its exact field, row and tab (the rules the fake API checks
// like the real server, the others armed with the details the server sends), the focus on the field, and the 412 of
// S-44 that keeps what the user edited.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { choose, openEdit, tab, type ScreensApi } from '../helpers/screenEditHelpers';

const PUT = 'PUT /screens/{id}';
const textbox = (name: string) => screen.getByRole('textbox', { name });
const save = () => screen.getByRole('button', { name: 'Save changes' });

const fieldsOf = (...fields: Array<{ field: string; rule: string }>) =>
  new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    details: { fields: fields.map((entry) => ({ ...entry, message: 'ignored' })) },
  });

/** The saved copy of Detalle in the fake API: an error must leave it untouched. */
const saved = (api: ScreensApi) => api.state.screens.find((s) => s.id === 12);

describe('screen edit: 400 on the exact field and row', () => {
  it('marks a repeated component name on its row, switches to its tab and focuses it', async () => {
    const { user, api } = await openEdit({ tab: 'components' });
    await user.clear(textbox('Name of component 2'));
    await user.type(textbox('Name of component 2'), 'btnGuardar');
    await user.click(tab('Template'));

    await user.click(save());

    expect(
      await screen.findByRole('tab', { name: 'Components & navigation', selected: true }),
    ).toBeVisible();
    const field = textbox('Name of component 2');
    await waitFor(() => {
      expect(field).toHaveFocus();
    });
    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription('Name has repeated values. Each one must be unique.');
    expect(textbox('Name of component 1')).not.toBeInvalid();
    expect(saved(api)?.components[1]?.name).toBe('lblNombre');
  });

  it('marks a repeated target of the uses of a component on the use that repeats it', async () => {
    const { user } = await openEdit({ tab: 'components' });
    await user.click(screen.getByRole('button', { name: 'Add use to component 1' }));
    await choose(user, 'Target of use 3 of component 1', /gRegistroSel/);

    await user.click(save());

    const target = screen.getByRole('combobox', { name: 'Target of use 3 of component 1' });
    await waitFor(() => {
      expect(target).toBeInvalid();
    });
    expect(target).toHaveAccessibleDescription(
      'Target has repeated values. Each one must be unique.',
    );
    expect(
      screen.getByRole('combobox', { name: 'Target of use 1 of component 1' }),
    ).not.toBeInvalid();
  });

  it('marks a repeated link on the "used in" of the row that repeats it', async () => {
    const { user } = await openEdit({ tab: 'links' });
    await user.click(screen.getByRole('button', { name: 'Add variable' }));
    await choose(user, 'Variable (link 2)', /gRegistroSel/);
    await user.type(textbox('Used in (variable link 2)'), 'btnGuardar.OnSelect');

    await user.click(save());

    await waitFor(() => {
      expect(textbox('Used in (variable link 2)')).toBeInvalid();
    });
    expect(textbox('Used in (variable link 2)')).toHaveFocus();
    expect(textbox('Used in (variable link 2)')).toHaveAccessibleDescription(
      'Used in has repeated values. Each one must be unique.',
    );
    expect(textbox('Used in (variable link 1)')).not.toBeInvalid();
  });

  it('marks a repeated navigation target on the second navigation', async () => {
    const { user } = await openEdit({ tab: 'components' });
    await user.click(screen.getByRole('button', { name: 'Add navigation' }));
    await choose(user, 'Target screen of navigation 2', /Inicio/);

    await user.click(save());

    const target = screen.getByRole('combobox', { name: 'Target screen of navigation 2' });
    await waitFor(() => {
      expect(target).toBeInvalid();
    });
    expect(target).toHaveAccessibleDescription(
      'Target screen has repeated values. Each one must be unique.',
    );
  });

  it('marks a navigation to the screen itself (rule self) on its target', async () => {
    const { user, api } = await openEdit({ tab: 'components' });
    api.failNext(PUT, fieldsOf({ field: 'navigations[0].targetScreenId', rule: 'self' }));

    await user.click(save());

    const target = screen.getByRole('combobox', { name: 'Target screen of navigation 1' });
    await waitFor(() => {
      expect(target).toBeInvalid();
    });
    expect(target).toHaveAccessibleDescription("Target screen can't point to itself.");
  });

  it('shows an error of a field the form does not have on the banner', async () => {
    const { user, api } = await openEdit();
    api.failNext(PUT, fieldsOf({ field: 'something.else', rule: 'type' }));

    await user.click(save());

    expect(await screen.findByText('Check the highlighted fields.')).toBeVisible();
  });
});

describe('screen edit: 404 of a nested id', () => {
  it('marks the use whose id does not exist (D-75)', async () => {
    const { user, api } = await openEdit({ tab: 'components' });
    api.failNext(
      PUT,
      new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        details: { element: 'component use', id: 402, field: 'components[0].uses[1].id' },
      }),
    );

    await user.click(save());

    const target = screen.getByRole('combobox', { name: 'Target of use 2 of component 1' });
    await waitFor(() => {
      expect(target).toBeInvalid();
    });
    expect(target).toHaveAccessibleDescription(
      "This component use doesn't exist. It may have been deleted.",
    );
    expect(
      screen.getByRole('combobox', { name: 'Target of use 1 of component 1' }),
    ).not.toBeInvalid();
  });

  it('marks the link whose id does not exist on the other tab', async () => {
    const { user, api } = await openEdit();
    api.failNext(
      PUT,
      new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        details: { element: 'collection link', id: 601, field: 'collectionLinks[0].id' },
      }),
    );

    await user.click(save());

    expect(
      await screen.findByRole('tab', { name: 'Variables & collections', selected: true }),
    ).toBeVisible();
    const element = await screen.findByRole('combobox', { name: 'Collection (link 1)' });
    await waitFor(() => {
      expect(element).toBeInvalid();
    });
    expect(element).toHaveAccessibleDescription(
      "This collection link doesn't exist. It may have been deleted.",
    );
  });

  it('marks the variable a link points at when it no longer exists', async () => {
    const { user, api } = await openEdit({ tab: 'links' });
    api.failNext(
      PUT,
      new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        details: { element: 'variable', id: 3, field: 'variableLinks[0].variableId' },
      }),
    );

    await user.click(save());

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Variable (link 1)' })).toBeInvalid();
    });
    expect(
      screen.getByText("This variable doesn't exist. It may have been deleted."),
    ).toBeVisible();
  });
});

describe('screen edit: 422 rules', () => {
  it('marks CROSS_APPLICATION on the use, the navigation and the link it points at', async () => {
    const { user, api } = await openEdit({ tab: 'components' });
    const cross = (field: string) =>
      new ApiError({ status: 422, code: 'CROSS_APPLICATION', details: { field } });
    api.failNext(PUT, cross('components[0].uses[1].targetId'));

    await user.click(save());
    const use = screen.getByRole('combobox', { name: 'Target of use 2 of component 1' });
    await waitFor(() => {
      expect(use).toBeInvalid();
    });
    expect(use).toHaveAccessibleDescription('You can only link elements of the same application.');

    api.failNext(PUT, cross('navigations[0].targetScreenId'));
    await user.click(save());
    const navigation = screen.getByRole('combobox', { name: 'Target screen of navigation 1' });
    await waitFor(() => {
      expect(navigation).toBeInvalid();
    });
    expect(navigation).toHaveAccessibleDescription(
      'You can only link elements of the same application.',
    );
    // The error of the first attempt is gone: each save starts clean.
    expect(use).not.toBeInvalid();

    api.failNext(PUT, cross('variableLinks[0].variableId'));
    await user.click(save());
    expect(
      await screen.findByRole('tab', { name: 'Variables & collections', selected: true }),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Variable (link 1)' })).toBeInvalid();
    });
  });

  it('marks CONTEXT_SCREEN_MISMATCH of a variable that belongs to another screen', async () => {
    const { user, api } = await openEdit({ tab: 'links' });
    api.failNext(
      PUT,
      new ApiError({
        status: 422,
        code: 'CONTEXT_SCREEN_MISMATCH',
        details: {
          field: 'variableLinks[0].variableId',
          variableId: 5,
          variable: 'locOrden',
          originScreenId: 11,
          screen: 'Inicio',
          screenId: 12,
          targetScreen: 'Detalle',
        },
      }),
    );

    await user.click(save());

    const element = screen.getByRole('combobox', { name: 'Variable (link 1)' });
    await waitFor(() => {
      expect(element).toBeInvalid();
    });
    expect(element).toHaveAccessibleDescription(
      'locOrden belongs to Inicio. From here you can only write it with Navigate.',
    );
  });

  it('marks CONTEXT_SCREEN_MISMATCH of a variable without origin screen', async () => {
    const { user, api } = await openEdit({ tab: 'links' });
    api.failNext(
      PUT,
      new ApiError({
        status: 422,
        code: 'CONTEXT_SCREEN_MISMATCH',
        details: {
          field: 'variableLinks[0].variableId',
          variableId: 6,
          variable: 'locSinOrigen',
          originScreenId: null,
          screenId: 12,
          targetScreen: 'Detalle',
        },
      }),
    );

    await user.click(save());

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Variable (link 1)' })).toBeInvalid();
    });
    expect(
      screen.getByText(
        'locSinOrigen has no origin screen. Set its origin screen before linking it.',
      ),
    ).toBeVisible();
  });

  it('marks DUPLICATE_NAME on the name when another screen has it', async () => {
    const { user, api } = await openEdit({ tab: 'components' });
    await user.click(tab('Template'));
    await user.clear(textbox('Name'));
    await user.type(textbox('Name'), 'Inicio');
    await user.click(tab('Components & navigation'));

    await user.click(save());

    expect(await screen.findByRole('tab', { name: 'Template', selected: true })).toBeVisible();
    await waitFor(() => {
      expect(textbox('Name')).toHaveFocus();
    });
    // The description is the help ("Unique in SAR") followed by the error.
    expect(textbox('Name')).toHaveAccessibleDescription(
      /A screen named Inicio already exists in SAR\./,
    );
    expect(saved(api)?.name).toBe('Detalle');
  });

  it('marks APP_CONTEXT_PROTECTED on the name of App (OnStart)', async () => {
    const { user, api } = await openEdit({ id: 10 });
    api.failNext(PUT, new ApiError({ status: 422, code: 'APP_CONTEXT_PROTECTED' }));

    await user.click(save());

    expect(await screen.findByText("The App (OnStart) screen can't be renamed.")).toBeVisible();
    expect(textbox('Name')).toBeInvalid();
  });

  it('says on the banner that the screen was sent to review while it was edited', async () => {
    const { user, api } = await openEdit();
    api.state.screens = api.state.screens.map((s) =>
      s.id === 12 ? { ...s, documentationStatus: 'IN_REVIEW' } : s,
    );

    await user.click(save());

    expect(
      await screen.findByText(
        'This screen is in review. Edit it after the review, or withdraw it from review.',
      ),
    ).toBeVisible();
    expect(saved(api)?.template.knownIssues).toBeNull();
  });

  it('says on the banner that the application was archived while it was edited', async () => {
    const { user, api } = await openEdit();
    api.failNext(PUT, new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' }));

    await user.click(save());

    expect(
      await screen.findByText(
        "This application is archived, so its documentation can't be changed.",
      ),
    ).toBeVisible();
  });

  it('shows a server error with its reference and keeps the form as it is', async () => {
    const { user, api } = await openEdit();
    await user.clear(textbox('Risks'));
    await user.type(textbox('Risks'), 'Mine');
    api.failNext(PUT, new ApiError({ status: 500, code: 'INTERNAL_ERROR', requestId: 'req-77' }));

    await user.click(save());

    expect(
      await screen.findByText(
        'Something went wrong on our side. Try again in a moment. Reference: req-77.',
      ),
    ).toBeVisible();
    expect(textbox('Risks')).toHaveValue('Mine');
    expect(save()).toBeEnabled();
  });
});

describe('screen edit: 412, someone else saved first (S-44)', () => {
  const CONFLICT =
    'Someone else saved changes to this screen after you opened it. Reload to see their version.';
  const EXTRA = 'Your changes will be lost, so copy anything you need first.';

  /** The other person's save: a new version of Detalle with another risks text. */
  function otherPersonSaves(api: ScreensApi) {
    api.state.screens = api.state.screens.map((s) =>
      s.id === 12 ? { ...s, template: { ...s.template, risks: 'Their risk' } } : s,
    );
    api.state.versions.set(12, 7);
  }

  it('keeps what was edited, disables Save and offers to reload', async () => {
    const { user, api } = await openEdit();
    await user.type(textbox('Known issues'), 'Mine');
    otherPersonSaves(api);

    await user.click(save());

    expect(await screen.findByText(`${CONFLICT} ${EXTRA}`)).toBeVisible();
    expect(textbox('Known issues')).toHaveValue('Mine');
    expect(save()).toBeDisabled();
    expect(save()).toHaveAccessibleDescription(`${CONFLICT} ${EXTRA}`.replace(` ${EXTRA}`, ''));
    expect(screen.getByRole('button', { name: 'Reload' })).toBeVisible();
    expect(saved(api)?.template.knownIssues).toBeNull();
    expect(api.callsTo(PUT)).toHaveLength(1);
  });

  it('hides the banner with "Keep my changes visible" and keeps the reason next to Save', async () => {
    const { user, api } = await openEdit();
    await user.type(textbox('Known issues'), 'Mine');
    otherPersonSaves(api);
    await user.click(save());
    await screen.findByText(`${CONFLICT} ${EXTRA}`);

    await user.click(screen.getByRole('button', { name: 'Keep my changes visible' }));

    expect(screen.queryByText(`${CONFLICT} ${EXTRA}`)).not.toBeInTheDocument();
    expect(screen.getByText(CONFLICT)).toBeVisible();
    expect(save()).toBeDisabled();
    expect(textbox('Known issues')).toHaveValue('Mine');
  });

  it("loads the other person's version with Reload and discards the edit", async () => {
    const { user, api } = await openEdit();
    await user.type(textbox('Known issues'), 'Mine');
    otherPersonSaves(api);
    await user.click(save());
    await screen.findByText(`${CONFLICT} ${EXTRA}`);

    await user.click(screen.getByRole('button', { name: 'Reload' }));

    await waitFor(() => {
      expect(textbox('Risks')).toHaveValue('Their risk');
    });
    expect(textbox('Known issues')).toHaveValue('');
    expect(screen.queryByText(CONFLICT)).not.toBeInTheDocument();
    expect(save()).toBeEnabled();

    await user.click(save());
    expect(await screen.findByRole('heading', { name: 'Detalle', level: 1 })).toBeVisible();
    expect(within(document.body).queryByText(/Someone else saved/)).not.toBeInTheDocument();
  });
});
