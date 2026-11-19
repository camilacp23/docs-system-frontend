// Screen edit page (S-20 to S-22): the form loads with every list, saving sends the complete representation with the ids
// kept and the origin rows left out, new and removed rows, swapping the names of two components, the client checks and
// the tab that holds an error, the status after saving (D-81, D-71) and App (OnStart) with its name locked (D-87).
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeVariable } from '../helpers/fakeVariablesApi';
import { renderScreens } from '../helpers/renderScreens';
import { sampleVariables } from '../helpers/renderVariables';
import { choose, lastPut, openEdit, replaceText, tab } from '../helpers/screenEditHelpers';
import { setupUser, type User } from '../helpers/setupUser';

const textbox = (name: string) => screen.getByRole('textbox', { name });
const pickerValue = (name: string) =>
  screen.getByRole<HTMLInputElement>('combobox', { name }).value;

/** Detalle's detail once the page went back to it. */
async function backAtDetail(name = 'Detalle') {
  expect(await screen.findByRole('heading', { name, level: 1 })).toBeVisible();
}

describe('screen edit: loading', () => {
  it('loads the template with its seven fields, the name and the Miro link', async () => {
    await openEdit();

    expect(screen.getByRole('heading', { name: 'Edit Detalle', level: 1 })).toBeVisible();
    expect(textbox('Name')).toHaveValue('Detalle');
    expect(textbox('Miro link')).toHaveValue('https://miro.com/app/board/uXjVDetalle=/');
    expect(textbox('OnStart')).toHaveValue(
      'UpdateContext({locMostrarDetalle: false});\nSet(gRegistroSel, First(colClientes))',
    );
    expect(textbox('Working process')).toHaveValue(
      'The user reviews the selected record and saves changes with btnGuardar.',
    );
    expect(textbox('Known issues')).toHaveValue('');
    expect(screen.getByText('5 of 7 template fields completed')).toBeVisible();
    expect(screen.getByRole('link', { name: /^Open/ })).toHaveAttribute(
      'href',
      'https://miro.com/app/board/uXjVDetalle=/',
    );
    expect(screen.getByRole('tab', { name: 'Template', selected: true })).toBeVisible();
  });

  it('loads the components with their uses and the navigations', async () => {
    const { user } = await openEdit({ tab: 'components' });

    expect(
      screen.getByRole('tab', { name: 'Components & navigation', selected: true }),
    ).toBeVisible();
    expect(textbox('Name of component 1')).toHaveValue('btnGuardar');
    expect(textbox('Type of component 1')).toHaveValue('Button');
    expect(textbox('OnSelect of component 1')).toHaveValue(
      'Patch(Clientes, gRegistroSel, frmDetalle.Updates)',
    );
    expect(textbox('Description of component 1')).toHaveValue('Saves the record.');
    expect(textbox('Name of component 3')).toHaveValue('galClientes');
    expect(screen.getByRole('combobox', { name: 'Type of use 1 of component 1' })).toHaveValue(
      'VARIABLE',
    );
    expect(pickerValue('Target of use 1 of component 1')).toBe('gRegistroSel');
    expect(screen.getByRole('combobox', { name: 'Type of use 2 of component 1' })).toHaveValue(
      'COLLECTION',
    );
    expect(pickerValue('Target of use 2 of component 1')).toBe('colClientes');
    expect(textbox('Description of use 2 of component 1')).toHaveValue('Reads the client list.');
    expect(pickerValue('Target screen of navigation 1')).toBe('Inicio');
    expect(textbox('Description of navigation 1')).toHaveValue('After saving');
    // The screen itself is never offered as a navigation target.
    await user.click(screen.getByRole('combobox', { name: 'Target screen of navigation 1' }));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).not.toContain('Detalle');
    expect(options.map((option) => option.textContent)).toContain('Busqueda');
  });

  it('loads the links, with the origin row apart: its tag and mode are read only and its Used in is a field', async () => {
    await openEdit({ tab: 'links' });

    expect(pickerValue('Variable (link 1)')).toBe('gRegistroSel');
    expect(
      within(screen.getByRole('radiogroup', { name: 'Access (variable link 1)' })).getByRole(
        'radio',
        {
          name: 'Read/Write',
        },
      ),
    ).toBeChecked();
    expect(textbox('Used in (variable link 1)')).toHaveValue('btnGuardar.OnSelect');
    expect(pickerValue('Collection (link 1)')).toBe('colClientes');
    expect(textbox('Used in (collection link 1)')).toHaveValue('galClientes.Items');
    // The origin row is not a link of the screen: no second picker, no Remove; only its Used in is a field.
    expect(screen.queryByRole('combobox', { name: 'Variable (link 2)' })).not.toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Variable links' });
    expect(within(table).getByRole('link', { name: 'locMostrarDetalle' })).toBeVisible();
    expect(within(table).getByText('Saved on the variable')).toBeVisible();
    expect(within(table).getByText('Origin')).toBeVisible();
    expect(textbox('Used in (origin locMostrarDetalle)')).toHaveValue('');
    expect(
      screen.getByText(
        'The Origin row marks where a variable is created. Its Used in is saved on the variable.',
      ),
    ).toBeVisible();
  });

  it('keeps the tab in the URL', async () => {
    const { user, router } = await openEdit();

    await user.click(tab('Variables & collections'));
    expect(router.state.location.search).toBe('?tab=links');
    await user.click(tab('Template'));
    expect(router.state.location.search).toBe('');
  });
});

describe('screen edit: saving', () => {
  it('sends the complete representation with the ids and without the origin rows, then shows the detail', async () => {
    const { user, api } = await openEdit();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await backAtDetail();
    expect(await screen.findByText('Screen saved.')).toBeVisible();
    const { body, ifMatch } = lastPut(api);
    expect(ifMatch).toBe('W/"1"');
    expect(body.name).toBe('Detalle');
    expect(body.miroLink).toBe('https://miro.com/app/board/uXjVDetalle=/');
    expect(body.template.knownIssues).toBeNull();
    expect(body.components.map((c) => c.id)).toEqual([301, 302, 303]);
    expect(body.components[0]?.uses).toEqual([
      { id: 401, targetType: 'VARIABLE', targetId: 3, description: null },
      { id: 402, targetType: 'COLLECTION', targetId: 11, description: 'Reads the client list.' },
    ]);
    expect(body.components[1]).not.toHaveProperty('uses');
    // The origin row (id 501) is never sent, only the editable link.
    expect(body.variableLinks).toEqual([
      { id: 502, variableId: 3, accessMode: 'READ_WRITE', usedIn: 'btnGuardar.OnSelect' },
    ]);
    expect(body.collectionLinks).toEqual([
      { id: 601, collectionId: 11, accessMode: 'READ', usedIn: 'galClientes.Items' },
    ]);
    expect(body.navigations).toEqual([
      { id: 701, targetScreenId: 11, description: 'After saving' },
    ]);
  });

  it('never shows a status change for an update that changes nothing (D-71)', async () => {
    const { user, api } = await openEdit();
    const before = api.etagOf(12);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await backAtDetail();
    expect(await screen.findByText('Screen saved.')).toBeVisible();
    expect(screen.queryByText(/Its status is now/)).not.toBeInTheDocument();
    expect(api.etagOf(12)).toBe(before);
  });

  it('adds a component with a use and a navigation without id and moves the focus to each new row', async () => {
    const { user, api } = await openEdit({ tab: 'components' });

    await user.click(screen.getByRole('button', { name: 'Add component' }));
    expect(textbox('Name of component 4')).toHaveFocus();
    await replaceText(user, textbox('Name of component 4'), 'btnNuevo');
    await replaceText(user, textbox('Type of component 4'), 'Button');
    await replaceText(user, textbox('OnSelect of component 4'), 'Navigate(Inicio)');
    await user.click(screen.getByRole('button', { name: 'Add use to component 4' }));
    expect(screen.getByRole('combobox', { name: 'Type of use 1 of component 4' })).toHaveFocus();
    await choose(user, 'Target of use 1 of component 4', /gUsuario/);
    await replaceText(user, textbox('Description of use 1 of component 4'), 'Reads the user');
    await user.click(screen.getByRole('button', { name: 'Add navigation' }));
    expect(screen.getByRole('combobox', { name: 'Target screen of navigation 2' })).toHaveFocus();
    await choose(user, 'Target screen of navigation 2', /Busqueda/);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await backAtDetail();

    const { body } = lastPut(api);
    expect(body.components[3]).toEqual({
      name: 'btnNuevo',
      type: 'Button',
      onSelect: 'Navigate(Inicio)',
      description: null,
      uses: [{ targetType: 'VARIABLE', targetId: 1, description: 'Reads the user' }],
    });
    expect(body.navigations[1]).toEqual({ targetScreenId: 13, description: null });
    // The new rows reached the server: the detail shows them.
    expect(api.state.screens.find((s) => s.id === 12)?.components.map((c) => c.name)).toContain(
      'btnNuevo',
    );
  });

  it('adds a variable link and a collection link without id and moves the focus to each new row', async () => {
    const { user, api } = await openEdit({ tab: 'links' });

    await user.click(screen.getByRole('button', { name: 'Add variable' }));
    expect(screen.getByRole('combobox', { name: 'Variable (link 2)' })).toHaveFocus();
    await choose(user, 'Variable (link 2)', /gFiltroActivo/);
    await replaceText(user, textbox('Used in (variable link 2)'), 'OnVisible');
    await user.click(screen.getByRole('button', { name: 'Add collection' }));
    await choose(user, 'Collection (link 2)', /colActivos/);
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Access (collection link 2)' })).getByRole(
        'radio',
        {
          name: 'Write',
        },
      ),
    );
    await replaceText(user, textbox('Used in (collection link 2)'), 'galNueva.Items');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await backAtDetail();

    const { body } = lastPut(api);
    expect(body.variableLinks[1]).toEqual({
      variableId: 2,
      accessMode: 'READ',
      usedIn: 'OnVisible',
    });
    expect(body.collectionLinks[1]).toEqual({
      collectionId: 10,
      accessMode: 'WRITE',
      usedIn: 'galNueva.Items',
    });
  });

  it('does not send a removed row and removes the uses when none is left', async () => {
    const { user, api } = await openEdit({ tab: 'components' });

    await user.click(screen.getByRole('button', { name: 'Remove component 2' }));
    expect(screen.getByRole('button', { name: 'Add component' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove use 1 of component 1' }));
    await user.click(screen.getByRole('button', { name: 'Remove use 1 of component 1' }));
    await user.click(screen.getByRole('button', { name: 'Remove navigation 1' }));

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await backAtDetail();

    const { body } = lastPut(api);
    expect(body.components.map((c) => c.id)).toEqual([301, 303]);
    expect(body.components[0]).not.toHaveProperty('uses');
    expect(body.navigations).toEqual([]);
    expect(api.state.screens.find((s) => s.id === 12)?.navigations).toEqual([]);
  });

  it('swaps the names of two components keeping their ids', async () => {
    const { user, api } = await openEdit({ tab: 'components' });

    await user.clear(textbox('Name of component 1'));
    await user.type(textbox('Name of component 1'), 'lblNombre');
    await user.clear(textbox('Name of component 2'));
    await user.type(textbox('Name of component 2'), 'btnGuardar');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await backAtDetail();

    const { body } = lastPut(api);
    expect(body.components.slice(0, 2).map((c) => [c.id, c.name])).toEqual([
      [301, 'lblNombre'],
      [302, 'btnGuardar'],
    ]);
    const saved = api.state.screens.find((s) => s.id === 12);
    expect(saved?.components.slice(0, 2).map((c) => [c.id, c.name])).toEqual([
      [301, 'lblNombre'],
      [302, 'btnGuardar'],
    ]);
  });

  it('keeps the edited tabs together: one save sends the changes of every tab', async () => {
    const { user, api } = await openEdit();

    await user.click(textbox('Known issues'));
    await user.paste('The save is slow.');
    await user.click(tab('Components & navigation'));
    await user.click(textbox('Description of navigation 1'));
    await user.paste(' the list');
    await user.click(tab('Variables & collections'));
    await replaceText(user, textbox('Used in (collection link 1)'), 'galClientes.Selected');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await backAtDetail();

    const { body } = lastPut(api);
    expect(body.template.knownIssues).toBe('The save is slow.');
    expect(body.navigations[0]?.description).toBe('After saving the list');
    expect(body.collectionLinks[0]?.usedIn).toBe('galClientes.Selected');
  });
});

/** Presses Tab until the button called `name` has the focus: the keyboard way to reach it, no .focus() shortcut. */
async function tabTo(user: User, name: string) {
  const button = screen.getByRole('button', { name });
  for (let presses = 0; presses < 150 && document.activeElement !== button; presses++) {
    await user.tab();
  }
  expect(button).toHaveFocus();
}

describe('screen edit: keyboard', () => {
  // The focus after "Add" must not depend on how the button was pressed: Tab to it, Enter, and the first control of
  // the new row has the focus (the same through the mouse, see the tests of saving).
  it.each([
    ['components', 'Add component', 'Name of component 4'],
    ['components', 'Add use to component 1', 'Type of use 3 of component 1'],
    ['components', 'Add navigation', 'Target screen of navigation 2'],
    ['links', 'Add variable', 'Variable (link 2)'],
    ['links', 'Add collection', 'Collection (link 2)'],
  ])('on %s, Tab to "%s" and Enter puts the focus on "%s"', async (tabName, add, first) => {
    const user = setupUser();
    await openEdit({ tab: tabName });

    await tabTo(user, add);
    await user.keyboard('{Enter}');

    expect(screen.getByLabelText(first)).toHaveFocus();
  });

  // Regression: React can flush the effects of the render that just painted the page right after the key that asks for
  // the focus and before the render that adds the row. The request must survive that run: a button reached and pressed
  // at once (here, with no Tab between the render and Enter) used to leave the focus on "Add".
  it.each([
    ['components', 'Add component', 'Name of component 4'],
    ['components', 'Add use to component 1', 'Type of use 3 of component 1'],
    ['components', 'Add navigation', 'Target screen of navigation 2'],
    ['links', 'Add variable', 'Variable (link 2)'],
    ['links', 'Add collection', 'Collection (link 2)'],
  ])(
    'on %s, Enter on "%s" right after the page rendered focuses "%s"',
    async (tabName, add, first) => {
      // The default pause of user-event (not setupUser) is what lets the effects of the render flush between the
      // focus and the key, which is the case this test guards; without it the race does not always happen.
      const user = setupUser();
      await openEdit({ tab: tabName });

      screen.getByRole('button', { name: add }).focus();
      await user.keyboard('{Enter}');

      expect(screen.getByLabelText(first)).toHaveFocus();
    },
  );

  it('puts the focus on the new row also when the button is pressed with Space', async () => {
    const user = setupUser();
    await openEdit({ tab: 'components' });

    await tabTo(user, 'Add navigation');
    await user.keyboard(' ');

    expect(screen.getByLabelText('Target screen of navigation 2')).toHaveFocus();
  });

  it('adds, fills, moves between the controls of a row and removes it without the mouse', async () => {
    const user = setupUser();
    const { api } = await openEdit({ tab: 'components' });

    await tabTo(user, 'Add navigation');
    await user.keyboard('{Enter}');
    const target = screen.getByRole('combobox', { name: 'Target screen of navigation 2' });
    expect(target).toHaveFocus();

    // Search, choose with the arrow keys and Enter (which must not submit the form), then Tab to the next control.
    await user.keyboard('Busq{ArrowDown}{Enter}');
    expect(target).toHaveValue('Busqueda');
    expect(api.callsTo('PUT /screens/{id}')).toHaveLength(0);
    await user.tab();
    expect(textbox('Description of navigation 2')).toHaveFocus();
    await user.keyboard('From the list');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Remove navigation 2' })).toHaveFocus();
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(target).toHaveFocus();

    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('combobox', { name: 'Target screen of navigation 2' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add navigation' })).toHaveFocus();
  });

  it('goes through the tabs with the arrow keys', async () => {
    const { user, router } = await openEdit();

    tab('Template').focus();
    await user.keyboard('{ArrowRight}');

    expect(tab('Components & navigation')).toHaveFocus();
    expect(router.state.location.search).toBe('?tab=components');
  });
});

describe('screen edit: variable access rules', () => {
  it('only allows Write for a context variable of another screen, and shows why', async () => {
    const { user } = await openEdit({ tab: 'links' });

    await user.click(screen.getByRole('button', { name: 'Add variable' }));
    await choose(user, 'Variable (link 2)', /locOrden/);

    const group = screen.getByRole('radiogroup', { name: 'Access (variable link 2)' });
    expect(within(group).getByRole('radio', { name: 'Write' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Read' })).toBeDisabled();
    expect(within(group).getByRole('radio', { name: 'Read/Write' })).toBeDisabled();
    expect(group).toHaveAccessibleDescription('Other screens can only set it through Navigate.');
  });

  it('offers a context variable without origin screen disabled, with the reason, and never chooses it', async () => {
    const { user } = await openEdit({
      tab: 'links',
      variables: [
        ...sampleVariables(),
        makeVariable(6, 'locSinOrigen', {
          scope: 'CONTEXT',
          originScreen: null,
          fullTraceability: false,
        }),
      ],
    });
    await user.click(screen.getByRole('button', { name: 'Add variable' }));
    await user.click(screen.getByRole('combobox', { name: 'Variable (link 2)' }));

    const list = await screen.findByRole('listbox');
    const unavailable = within(list).getByRole('option', { name: /locSinOrigen/ });
    expect(unavailable).toHaveAttribute('aria-disabled', 'true');
    expect(unavailable).toHaveAttribute('title', 'Context · set its origin screen first');
    expect(within(list).getByRole('option', { name: /locOrden/ })).toHaveTextContent(
      'Context · Inicio · write only',
    );
    expect(within(list).getByRole('option', { name: /gUsuario/ })).toHaveTextContent(
      'Global · App (OnStart)',
    );
    await user.click(unavailable);
    expect(pickerValue('Variable (link 2)')).toBe('');
  });
});

describe('screen edit: client checks', () => {
  it('rejects a Miro link that is not https without sending anything', async () => {
    const { user, api } = await openEdit();

    await user.clear(textbox('Miro link'));
    await user.type(textbox('Miro link'), 'http://miro.com/board');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText("Miro link isn't in a valid format.")).toBeVisible();
    expect(textbox('Miro link')).toHaveFocus();
    expect(textbox('Miro link')).toBeInvalid();
    expect(api.callsTo('PUT /screens/{id}')).toHaveLength(0);
    expect(screen.getByText('1 field needs attention.')).toBeVisible();
  });

  it('checks the required fields and patterns of a row, switches to its tab and focuses the field', async () => {
    const { user, api } = await openEdit({ tab: 'components' });
    await user.click(screen.getByRole('button', { name: 'Add component' }));
    await user.type(textbox('Name of component 4'), '9bad');
    await user.click(screen.getByRole('button', { name: 'Add use to component 4' }));
    await user.click(tab('Template'));

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByRole('tab', { name: 'Components & navigation', selected: true }),
    ).toBeVisible();
    expect(await screen.findByText("Name isn't in a valid format.")).toBeVisible();
    await waitFor(() => {
      expect(textbox('Name of component 4')).toHaveFocus();
    });
    expect(screen.getByText('Type is required.')).toBeVisible();
    expect(screen.getByText('Target is required.')).toBeVisible();
    expect(textbox('Type of component 4')).toBeInvalid();
    expect(textbox('Name of component 4')).toHaveAccessibleDescription(
      "Name isn't in a valid format.",
    );
    expect(screen.getByText('3 fields need attention.')).toBeVisible();
    expect(api.callsTo('PUT /screens/{id}')).toHaveLength(0);
  });

  it('checks the links: element, and where it happens without the reserved word origin', async () => {
    const { user, api } = await openEdit({ tab: 'links' });
    await user.click(screen.getByRole('button', { name: 'Add variable' }));
    await user.type(textbox('Used in (variable link 2)'), 'origin');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Variable is required.')).toBeVisible();
    expect(screen.getByText("Used in isn't in a valid format.")).toBeVisible();
    expect(api.callsTo('PUT /screens/{id}')).toHaveLength(0);
  });

  it('limits the length of the long texts', async () => {
    const { user, api } = await openEdit();

    // pasting is faster than typing 20 001 characters
    await user.click(textbox('Risks'));
    await user.paste('x'.repeat(20001));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Risks is too long.')).toBeVisible();
    expect(api.callsTo('PUT /screens/{id}')).toHaveLength(0);
  });
});

describe('screen edit: the status after saving (D-81)', () => {
  it('warns before saving that editing an approved screen returns it to In progress', async () => {
    const { user, api } = await openEdit({ id: 11 });

    expect(screen.getByText('This screen is approved.')).toBeVisible();
    expect(screen.getByText('Saving changes returns it to In progress.')).toBeVisible();

    await user.type(textbox('Working process'), 'Shows the home.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await backAtDetail('Inicio');
    expect(await screen.findByText('Screen saved. Its status is now In progress.')).toBeVisible();
    expect(api.state.screens.find((s) => s.id === 11)?.documentationStatus).toBe('IN_PROGRESS');
    expect(screen.getAllByText('In progress').length).toBeGreaterThan(0);
  });

  it('does not warn for a screen that is not approved', async () => {
    await openEdit();
    expect(screen.queryByText('This screen is approved.')).not.toBeInTheDocument();
  });

  it('keeps an approved screen approved when the update changes nothing', async () => {
    const { user, api } = await openEdit({ id: 11 });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await backAtDetail('Inicio');
    expect(await screen.findByText('Screen saved.')).toBeVisible();
    expect(screen.queryByText(/Its status is now/)).not.toBeInTheDocument();
    expect(api.state.screens.find((s) => s.id === 11)?.documentationStatus).toBe('APPROVED');
  });

  it('says that an undocumented screen became a draft when its first content is saved', async () => {
    const { user, api } = await openEdit({ id: 14 });

    await user.type(textbox('Architecture'), 'One form.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await backAtDetail('Reportes');
    expect(await screen.findByText('Screen saved. Its status is now Draft.')).toBeVisible();
    expect(api.state.screens.find((s) => s.id === 14)?.documentationStatus).toBe('DRAFT');
  });

  it('keeps the status of a draft that is edited', async () => {
    const { user } = await openEdit({ id: 13 });

    await user.type(textbox('Risks'), 'None.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await backAtDetail('Busqueda');
    expect(await screen.findByText('Screen saved.')).toBeVisible();
    expect(screen.queryByText(/Its status is now/)).not.toBeInTheDocument();
  });
});

describe('screen edit: App (OnStart)', () => {
  it('shows the name but does not let it change, and edits the rest', async () => {
    const { user, api } = await openEdit({ id: 10 });

    const name = textbox('Name');
    expect(name).toHaveValue('App (OnStart)');
    expect(name).toBeDisabled();
    expect(screen.getByText("The name of App (OnStart) can't be changed.")).toBeVisible();

    await user.type(textbox('Risks'), 'Slow start.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await backAtDetail('App (OnStart)');
    expect(lastPut(api).body.name).toBe('App (OnStart)');
    expect(api.state.screens.find((s) => s.id === 10)?.template.risks).toBe('Slow start.');
    // Its origin row (gUsuario) was not touched.
    expect(api.state.screens.find((s) => s.id === 10)?.variableLinks).toHaveLength(1);
  });
});

describe('screen edit: unknown screen', () => {
  it('shows "This screen doesn\'t exist" for an id that is not there', async () => {
    await renderScreens({ path: '/screens/999/edit' });
    expect(await screen.findByText("This screen doesn't exist")).toBeVisible();
  });
});

describe('screen edit: the ETag of the contract 0.5.1', () => {
  // The tag of a screen is W/"<updatedAt ms>-<pendingSubtasks>-<commentCount>-<fingerprint>" (four segments, the last one
  // 8 lowercase hexadecimal digits). The page keeps it as an opaque text: whatever the read answered is what If-Match sends.
  const FULL_ETAG = 'W/"1760000000000-3-2-9f3a1c7e"';

  it('sends in If-Match exactly the ETag it received, without reading its parts', async () => {
    expect(FULL_ETAG).toMatch(/^W\/"\d+-\d+-\d+-[0-9a-f]{8}"$/);
    const { user, api } = await openEdit({
      prepare: (fake) => {
        const read = fake.client.get.bind(fake.client);
        fake.client.get = (path, options) =>
          read(path, options).then((answer) =>
            path === '/screens/{id}' ? { ...answer, etag: FULL_ETAG } : answer,
          );
      },
    });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(api.callsTo('PUT /screens/{id}')).toHaveLength(1);
    });
    expect(lastPut(api).ifMatch).toBe(FULL_ETAG);
  });
});
