// Screen detail (S-19, S-19r): header, the Miro link, the tabs in the URL, the template with its progress,
// components and navigation, variables and collections with their origin rows, loading and error states, the
// breadcrumb and the Reader view. Future to do has its own file (screenJiraTab) and Comments its own folder (src/test/comments).
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeScreenDetail } from '../helpers/fakeScreensApi';
import { renderScreens } from '../helpers/renderScreens';
import { setupUser } from '../helpers/setupUser';

/** The detail of Detalle once it is on screen. */
async function open(options: Parameters<typeof renderScreens>[0] = {}) {
  const view = await renderScreens({ path: '/screens/12', ...options });
  await screen.findByRole('heading', { name: 'Detalle', level: 1 });
  return view;
}

describe('screen detail: header', () => {
  it('shows the name, the status, the author and the last update', async () => {
    await open();

    const heading = screen.getByRole('heading', { name: 'Detalle', level: 1 });
    expect(heading).toBeVisible();
    expect(screen.getAllByText('In review').length).toBeGreaterThan(0);
    expect(screen.getByText(/Author Sample Developer A · Updated 2026-10-04 16:02/)).toBeVisible();
    expect(screen.queryByText('Reserved')).not.toBeInTheDocument();
  });

  it('marks App (OnStart) as Reserved', async () => {
    await renderScreens({ path: '/screens/10' });

    expect(await screen.findByRole('heading', { name: 'App (OnStart)', level: 1 })).toBeVisible();
    expect(screen.getByText('Reserved')).toBeInTheDocument();
    expect(screen.getByText(/Author Camila Castillo/)).toBeInTheDocument();
  });

  it('opens the Miro diagram in another tab without leaking the opener', async () => {
    await open();

    const links = screen.getAllByRole('link', { name: /Open/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('href', 'https://miro.com/app/board/uXjVDetalle=/');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(screen.getByRole('link', { name: /Open in Miro/ })).toBeInTheDocument();
  });

  it('draws no link when the screen has no Miro diagram', async () => {
    await renderScreens({ path: '/screens/11' });
    await screen.findByRole('heading', { name: 'Inicio', level: 1 });

    expect(screen.queryByRole('link', { name: /Open/ })).not.toBeInTheDocument();
    expect(screen.getByText('Miro diagram').nextElementSibling).toHaveTextContent('—');
  });

  it('never makes a link of a stored address that is not https', async () => {
    await renderScreens({
      path: '/screens/30',
      screens: [
        makeScreenDetail(10, 'App (OnStart)', { isAppContext: true }),
        makeScreenDetail(30, 'Raro', { miroLink: 'javascript:alert(1)' }),
      ],
    });
    await screen.findByRole('heading', { name: 'Raro', level: 1 });

    expect(screen.queryByRole('link', { name: /Open/ })).not.toBeInTheDocument();
  });

  it('shows the breadcrumb "Screens / <name>" with a link back to the list', async () => {
    await open();

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(await within(breadcrumb).findByText('Detalle')).toHaveAttribute('aria-current', 'page');
    expect(within(breadcrumb).getByRole('link', { name: 'Screens' })).toHaveAttribute(
      'href',
      '/screens',
    );
  });

  it('draws Future to do with the pending count, and Comments as the last tab with its count', async () => {
    await open();

    expect(screen.getByRole('tab', { name: /^Future to do\s*3$/ })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.at(-1)).toHaveAccessibleName(/^Comments\s*2$/);
  });

  it('leaves the count out of the Future to do tab when nothing is pending', async () => {
    await renderScreens({ path: '/screens/13' });
    await screen.findByRole('heading', { name: 'Busqueda', level: 1 });

    expect(screen.getByRole('tab', { name: 'Future to do' })).toBeInTheDocument();
    expect(screen.getByText('Pending to-dos').nextElementSibling).toHaveTextContent('—');
  });

  it('shows the pending to-dos in the side card', async () => {
    await open();
    expect(screen.getByText('Pending to-dos').nextElementSibling).toHaveTextContent('3 in Jira');
  });
});

describe('screen detail: tabs in the URL', () => {
  it('starts on Template without a parameter and follows the tab in the URL', async () => {
    const user = setupUser();
    const { router } = await open();

    expect(screen.getByRole('tab', { name: 'Template', selected: true })).toBeInTheDocument();
    expect(router.state.location.search).toBe('');

    await user.click(screen.getByRole('tab', { name: 'Components & navigation' }));
    expect(router.state.location.search).toBe('?tab=components');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Components & navigation');

    await user.click(screen.getByRole('tab', { name: 'Variables & collections' }));
    expect(router.state.location.search).toBe('?tab=links');

    await user.click(screen.getByRole('tab', { name: 'Template' }));
    expect(router.state.location.search).toBe('');
  });

  it('opens the tab of the link', async () => {
    await renderScreens({ path: '/screens/12?tab=links' });

    expect(
      await screen.findByRole('tab', { name: 'Variables & collections', selected: true }),
    ).toBeVisible();
    expect(screen.getByRole('table', { name: 'Variable links' })).toBeVisible();
  });

  it('ignores a tab it does not know', async () => {
    await renderScreens({ path: '/screens/12?tab=jira' });

    expect(await screen.findByRole('tab', { name: 'Template', selected: true })).toBeVisible();
  });

  it('moves between tabs with the arrow keys and the Back button', async () => {
    const user = setupUser();
    const { router } = await open();

    screen.getByRole('tab', { name: 'Template' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(router.state.location.search).toBe('?tab=components');
    expect(screen.getByRole('tab', { name: 'Components & navigation' })).toHaveFocus();

    await router.navigate(-1);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Template', selected: true })).toBeInTheDocument();
    });
  });
});

describe('screen detail: Template tab', () => {
  it('lists the seven fields and the progress "n of 7"', async () => {
    await open();

    const list = within(screen.getByRole('region', { name: 'Template fields' }));
    expect(list.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'OnStart(done)',
      'Working process(done)',
      'Architecture(done)',
      'Data model(done)',
      'Requirements(done)',
      'Known issues(to write)',
      'Risks(to write)',
    ]);
    expect(screen.getByText('5 of 7')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Template progress' })).toHaveAttribute(
      'aria-valuenow',
      '5',
    );
    expect(
      screen.getByText('Known issues and Risks are needed to submit for review.'),
    ).toBeInTheDocument();
  });

  it('shows the text of each field, OnStart in monospace, and "Not documented yet." where there is none', async () => {
    await open();

    const onStart = screen.getByRole('region', { name: 'OnStart' });
    const code = within(onStart).getByText(/UpdateContext/);
    expect(code.tagName).toBe('PRE');
    expect(code).toHaveClass('font-mono');
    expect(code.textContent).toContain('Set(gRegistroSel, First(colClientes))');
    expect(
      within(screen.getByRole('region', { name: 'Working process' })).getByText(
        'The user reviews the selected record and saves changes with btnGuardar.',
      ),
    ).toBeInTheDocument();
    expect(within(onStart).getByText('Done')).toBeInTheDocument();
    const known = screen.getByRole('region', { name: 'Known issues' });
    expect(within(known).getByText('To write')).toBeInTheDocument();
    expect(within(known).getByText('Not documented yet.')).toBeInTheDocument();
  });

  it('counts a field with only spaces as not written, like the server (D-81)', async () => {
    await open();

    const risks = screen.getByRole('region', { name: 'Risks' });
    expect(within(risks).getByText('To write')).toBeInTheDocument();
    expect(within(risks).getByText('Not documented yet.')).toBeInTheDocument();
  });

  it('shows the status, the author and the linked elements of the screen', async () => {
    await open();

    const side = screen.getByRole('region', { name: 'Template progress' });
    expect(within(side).getByText('In review')).toBeInTheDocument();
    expect(within(side).getByText('Sample Developer A')).toBeInTheDocument();
    expect(within(side).getByText(/2 variables/)).toBeInTheDocument();
    expect(within(side).getByText(/locMostrarDetalle, gRegistroSel/)).toBeInTheDocument();
    expect(within(side).getByText(/1 collection/)).toBeInTheDocument();
    expect(within(side).getByText(/3 components/)).toBeInTheDocument();
    expect(within(side).getByText(/btnGuardar, lblNombre, galClientes/)).toBeInTheDocument();
  });

  it('shows 7 of 7 and no hint when every field has content', async () => {
    const full = makeScreenDetail(40, 'Completa', {
      template: {
        onStart: 'a',
        workingProcess: 'b',
        architecture: 'c',
        dataModel: 'd',
        requirements: 'e',
        knownIssues: 'f',
        risks: 'g',
      },
    });
    await renderScreens({
      path: '/screens/40',
      screens: [makeScreenDetail(10, 'App (OnStart)', { isAppContext: true }), full],
    });
    await screen.findByRole('heading', { name: 'Completa', level: 1 });

    expect(screen.getByText('7 of 7')).toBeInTheDocument();
    expect(screen.queryByText(/needed to submit for review/)).not.toBeInTheDocument();
    expect(screen.getByText('Nothing is linked yet.')).toBeInTheDocument();
  });

  it('says "n of 7" with zero fields written', async () => {
    await renderScreens({ path: '/screens/14' });
    await screen.findByRole('heading', { name: 'Reportes', level: 1 });

    expect(screen.getByText('0 of 7')).toBeInTheDocument();
    expect(screen.getAllByText('To write')).toHaveLength(7);
  });
});

describe('screen detail: Components & navigation tab', () => {
  async function openTab() {
    const view = await open({ path: '/screens/12?tab=components' });
    await screen.findByRole('region', { name: 'Components' });
    return view;
  }

  it('shows each component with its type, its OnSelect in monospace and what it uses', async () => {
    await openTab();

    const card = within(screen.getByRole('region', { name: 'Components' }));
    expect(card.getByRole('heading', { name: 'btnGuardar' })).toBeInTheDocument();
    expect(card.getByText('Button')).toBeInTheDocument();
    expect(card.getByText('Label')).toBeInTheDocument();
    expect(card.getByText('Gallery')).toBeInTheDocument();
    const onSelect = card.getByText('Patch(Clientes, gRegistroSel, frmDetalle.Updates)');
    expect(onSelect.tagName).toBe('PRE');
    expect(onSelect).toHaveClass('font-mono');
    const uses = within(card.getByRole('list', { name: 'Uses of btnGuardar' }));
    expect(uses.getByRole('link', { name: 'gRegistroSel' })).toHaveAttribute(
      'href',
      '/variables/3',
    );
    expect(uses.getByRole('link', { name: 'colClientes' })).toHaveAttribute(
      'href',
      '/collections/11',
    );
    expect(uses.getByText('· Reads the client list.')).toBeInTheDocument();
    // A component without OnSelect or uses draws neither.
    expect(card.queryByRole('list', { name: 'Uses of lblNombre' })).not.toBeInTheDocument();
    expect(card.getAllByText('OnSelect')).toHaveLength(1);
  });

  it('links each navigation to the page of its screen', async () => {
    await openTab();

    const card = within(screen.getByRole('region', { name: 'Navigation' }));
    expect(card.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/screens/11');
    expect(card.getByText('· After saving')).toBeInTheDocument();
  });

  it('follows a navigation to the other screen', async () => {
    const user = setupUser();
    const { router } = await openTab();

    await user.click(
      within(screen.getByRole('region', { name: 'Navigation' })).getByRole('link', {
        name: 'Inicio',
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/screens/11');
    });
    expect(await screen.findByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible();
  });

  it('says so when there are no components or navigations', async () => {
    await renderScreens({ path: '/screens/14?tab=components' });

    expect(await screen.findByText('No components yet.')).toBeInTheDocument();
    expect(screen.getByText('No navigations yet.')).toBeInTheDocument();
  });
});

describe('screen detail: Variables & collections tab', () => {
  async function openTab() {
    await open({ path: '/screens/12?tab=links' });
    return within(await screen.findByRole('table', { name: 'Variable links' }));
  }

  it('shows the variable links with their access mode and where they are used, linked to the variable', async () => {
    const table = await openTab();

    const link = table.getByRole('link', { name: 'gRegistroSel' });
    expect(link).toHaveAttribute('href', '/variables/3');
    const row = link.closest('tr') as HTMLElement;
    expect(within(row).getByText('Read/Write')).toBeInTheDocument();
    const usedIn = within(row).getByText('btnGuardar.OnSelect');
    expect(usedIn).toHaveClass('font-mono');
  });

  it('marks the origin row as such, without a place of use, and says it is read only', async () => {
    const table = await openTab();

    const row = table.getByRole('link', { name: 'locMostrarDetalle' }).closest('tr') as HTMLElement;
    expect(within(row).getByText('Origin')).toBeInTheDocument();
    expect(within(row).getByText('Write')).toBeInTheDocument();
    expect(within(row).queryByText('origin')).not.toBeInTheDocument();
    expect(table.getByRole('link', { name: 'locMostrarDetalle' })).toHaveAttribute(
      'href',
      '/variables/4',
    );
    expect(
      screen.getByText("Origin rows come from the variable and can't be edited here."),
    ).toBeInTheDocument();
    // Read only: no control in any row.
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    expect(within(row).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the collection links, linked to the collection', async () => {
    await openTab();

    const table = within(screen.getByRole('table', { name: 'Collection links' }));
    expect(table.getByRole('link', { name: 'colClientes' })).toHaveAttribute(
      'href',
      '/collections/11',
    );
    expect(table.getByText('Read')).toBeInTheDocument();
    expect(table.getByText('galClientes.Items')).toHaveClass('font-mono');
  });

  it('does not show the origin note when no row is an origin, and says so when nothing is linked', async () => {
    await renderScreens({ path: '/screens/14?tab=links' });

    expect(await screen.findByText('No variables linked yet.')).toBeInTheDocument();
    expect(screen.getByText('No collections linked yet.')).toBeInTheDocument();
    expect(screen.queryByText(/Origin rows come from the variable/)).not.toBeInTheDocument();
  });

  it('shows App (OnStart) origin rows like those of any other screen', async () => {
    await renderScreens({ path: '/screens/10?tab=links' });

    const table = within(await screen.findByRole('table', { name: 'Variable links' }));
    expect(table.getByRole('link', { name: 'gUsuario' })).toHaveAttribute('href', '/variables/1');
    expect(table.getByText('Origin')).toBeInTheDocument();
  });
});

describe('screen detail: states', () => {
  it('shows "This screen doesn\'t exist" for an unknown or malformed id, with a way back', async () => {
    const user = setupUser();
    const { router } = await renderScreens({ path: '/screens/999' });

    expect(await screen.findByText("This screen doesn't exist")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Screens' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/screens');
    });
  });

  it('does not ask the API for an id that cannot exist', async () => {
    const { api } = await renderScreens({ path: '/screens/abc' });

    expect(await screen.findByText("This screen doesn't exist")).toBeInTheDocument();
    expect(api.callsTo('GET /screens/{id}')).toHaveLength(0);
  });

  it('shows the server error state with a retry', async () => {
    const user = setupUser();
    await renderScreens({
      path: '/screens/12',
      prepare: (api) => {
        api.failNext('GET /screens/{id}', new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
      },
    });

    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Detalle', level: 1 })).toBeVisible();
  });

  it('shows a loading skeleton only after a wait, never a blank error', async () => {
    let release: () => void = () => undefined;
    await renderScreens({
      path: '/screens/12',
      prepare: (api) => {
        release = api.hold((call) => call.path === '/screens/{id}').release;
      },
    });

    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong on our side')).not.toBeInTheDocument();
    release();
    expect(await screen.findByRole('heading', { name: 'Detalle', level: 1 })).toBeVisible();
  });
});

describe('screen detail: roles', () => {
  it('gives the Reader the same read-only view (S-19r)', async () => {
    await renderScreens({ role: 'READER', path: '/screens/12' });

    expect(await screen.findByRole('heading', { name: 'Detalle', level: 1 })).toBeVisible();
    expect(screen.getByText('5 of 7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open in Miro/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete|Edit|Submit/ })).not.toBeInTheDocument();
  });
});
