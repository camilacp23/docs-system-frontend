// The five steps of /onboarding (FR-25, D-146), each drawn with data of the contract: what every step shows, the order the
// API sends (never re-sorted), `depth` null, fewer than 10 items, the empty lists of an application with only App (OnStart),
// the links (a component leads to the Components & navigation tab of its screen, D-102) and the column on the right.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeEmptySummary, makeSummary, SAMPLE_MIRO } from '../helpers/fakeOnboardingApi';
import { renderOnboarding } from '../helpers/renderOnboarding';
import { setupUser } from '../helpers/setupUser';

async function openStep(step: number, summary = makeSummary()) {
  return renderOnboarding({ path: `/onboarding?step=${step}`, summaries: { 1: summary } });
}

const stepRegion = (name: string) => screen.getByRole('region', { name });
const names = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');

describe('step 1: overview', () => {
  it('shows the figures of the summary and the approved share as the API sends it', async () => {
    await openStep(1);
    const card = await screen.findByRole('region', {
      name: 'What SAR is and how it is documented',
    });

    expect(within(card).getByText(/^SAR is a Power Apps application\./)).toBeVisible();
    const figures = within(card)
      .getAllByRole('definition')
      .map((item) => item.textContent);
    expect(figures).toEqual(['31', '47', '9', '123']);
    expect(within(card).getByText('screens')).toBeVisible();
    expect(within(card).getByText('components')).toBeVisible();
    expect(
      within(card).getByRole('heading', { name: 'Documentation progress', level: 3 }),
    ).toBeVisible();
    expect(within(card).getByText('41.7% approved')).toBeVisible();
    expect(within(card).getByText(/Approved screens are the official reference/)).toBeVisible();
  });

  it('writes a whole percentage with one decimal and an empty application as 0.0%', async () => {
    await openStep(1, makeSummary({ approvedPercent: 50 }));
    expect(await screen.findByText('50.0% approved')).toBeVisible();
  });

  it('uses the singular for a single element', async () => {
    await openStep(
      1,
      makeSummary({ counts: { screens: 1, variables: 1, collections: 1, components: 1 } }),
    );
    const card = await screen.findByRole('region', {
      name: 'What SAR is and how it is documented',
    });
    for (const word of ['screen', 'variable', 'collection', 'component']) {
      expect(within(card).getByText(word)).toBeVisible();
    }
  });

  it('keeps the two fixed tips of the frame', async () => {
    await openStep(1);
    const card = await screen.findByRole('region', {
      name: 'What SAR is and how it is documented',
    });
    const tips = within(card).getAllByRole('listitem');
    expect(tips).toHaveLength(2);
    expect(tips[0]).toHaveTextContent(
      'How to read a screenStart with Working process, then Data model. OnStart shows what runs when the screen opens.',
    );
    expect(tips[1]).toHaveTextContent(
      'Status tagsApproved = reviewed by an administrator. In progress or Draft = still being written.',
    );
  });
});

describe('step 2: how the app starts', () => {
  it('shows the seven template fields of App (OnStart) in the order of Table 28', async () => {
    await openStep(2);
    const card = await screen.findByRole('region', { name: 'How SAR starts' });

    const terms = within(card)
      .getAllByRole('term')
      .map((term) => term.textContent);
    expect(terms).toEqual([
      'OnStart',
      'Working process',
      'Architecture',
      'Data model',
      'Requirements',
      'Known issues',
      'Risks',
    ]);
    const definitions = within(card)
      .getAllByRole('definition')
      .map((definition) => definition.textContent);
    expect(definitions).toEqual([
      'Set(gUsuarioActual, User());\nClearCollect(colCatalogo, Catalogo)',
      'Loads the user, then the catalog.',
      'Not documented yet.',
      'Reads Catalogo.',
      'Not documented yet.',
      'Not documented yet.',
      'Not documented yet.',
    ]);
  });

  it('draws OnStart as code and the empty fields as plain muted text', async () => {
    await openStep(2);
    const card = await screen.findByRole('region', { name: 'How SAR starts' });
    const definitions = within(card).getAllByRole('definition');

    expect(definitions[0]).toHaveClass('font-mono');
    expect(definitions[1]).not.toHaveClass('font-mono');
    expect(definitions[2]).toHaveClass('text-ink-500');
  });

  it('lists the key screens App (OnStart) reaches directly, as links, and only those', async () => {
    await openStep(2);
    const card = await screen.findByRole('region', { name: 'How SAR starts' });

    const heading = within(card).getByRole('heading', {
      name: 'Key screens reached directly from App (OnStart)',
      level: 3,
    });
    const list = heading.parentElement?.querySelector('ul') as HTMLElement;
    expect(names(list)).toEqual(['Inicio', 'Detalle']);
    expect(within(list).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
      'href',
      '/screens/3',
    );
    expect(within(list).getByRole('link', { name: 'Detalle' })).toHaveAttribute(
      'href',
      '/screens/12',
    );
  });

  it('leaves the block out when no key screen has depth 1', async () => {
    const summary = makeSummary();
    await openStep(
      2,
      makeSummary({
        keyScreens: summary.keyScreens.filter((item) => item.depth !== 1),
      }),
    );
    const card = await screen.findByRole('region', { name: 'How SAR starts' });
    expect(within(card).getAllByRole('term')).toHaveLength(7);

    expect(
      within(card).queryByRole('heading', { name: /reached directly/, level: 3 }),
    ).not.toBeInTheDocument();
  });

  it('shows every field as not documented in an application with only App (OnStart)', async () => {
    await openStep(2, makeEmptySummary());
    const card = await screen.findByRole('region', { name: 'How SAR starts' });

    expect(within(card).getAllByText('Not documented yet.')).toHaveLength(7);
    expect(
      within(card).queryByRole('heading', { name: /reached directly/, level: 3 }),
    ).not.toBeInTheDocument();
  });
});

describe('step 3: key screens', () => {
  it('lists the screens in the order the API sends them, with status, depth and connections', async () => {
    await openStep(3);
    const list = await screen.findByRole('list', { name: 'Key screens in reading order' });

    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.querySelector('.font-mono')?.textContent)).toEqual([
      'Inicio',
      'Detalle',
      'Solicitudes',
      'Administración',
    ]);
    expect(rows[0]).toHaveTextContent('Reached directly from App (OnStart)');
    expect(rows[0]).toHaveTextContent('Approved');
    expect(rows[1]).toHaveTextContent('In review');
    expect(rows[2]).toHaveTextContent('2 steps from App (OnStart)');
    expect(rows[2]).toHaveTextContent('In progress');
    expect(rows[3]).toHaveTextContent('Draft');
  });

  it('says a screen with depth null is not reachable from App (OnStart)', async () => {
    await openStep(3);
    const list = await screen.findByRole('list', { name: 'Key screens in reading order' });
    const last = within(list).getAllByRole('listitem')[3] as HTMLElement;

    expect(last).toHaveTextContent('Administración');
    expect(last).toHaveTextContent('Not reachable from App (OnStart)');
  });

  it('keeps the order of the API even when it is not the order of any column', async () => {
    const summary = makeSummary();
    const [first, second, third, fourth] = summary.keyScreens;
    await openStep(3, makeSummary({ keyScreens: [fourth!, second!, first!, third!] }));
    const list = await screen.findByRole('list', { name: 'Key screens in reading order' });

    expect(
      within(list)
        .getAllByRole('listitem')
        .map((row) => row.querySelector('.font-mono')?.textContent),
    ).toEqual(['Administración', 'Detalle', 'Inicio', 'Solicitudes']);
  });

  it('does not list App (OnStart) as a key screen', async () => {
    await openStep(3);
    const list = await screen.findByRole('list', { name: 'Key screens in reading order' });

    expect(within(list).queryByText('App (OnStart)')).not.toBeInTheDocument();
  });

  it('draws the connections as a number and a bar relative to the largest of the list', async () => {
    await openStep(3);
    const list = await screen.findByRole('list', { name: 'Key screens in reading order' });
    const rows = within(list).getAllByRole('listitem');
    const widths = rows.map(
      (row) => (row.querySelector('[style*="width"]') as HTMLElement).style.width,
    );

    // 14, 9, 21 and 6 over the largest (21).
    expect(widths).toEqual(['67%', '43%', '100%', '29%']);
    expect(within(rows[0] as HTMLElement).getByText('14')).toBeVisible();
    expect(within(rows[0] as HTMLElement).getByText('connections')).toHaveClass('sr-only');
    // The bar is decoration: the number says it.
    expect(
      rows[0]?.querySelector('[style*="width"]')?.closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  it('links each screen to its page and the Miro diagram only when the screen has one', async () => {
    const user = setupUser();
    const { router } = await openStep(3);
    const list = await screen.findByRole('list', { name: 'Key screens in reading order' });

    expect(within(list).getByRole('link', { name: 'Open Inicio' })).toHaveAttribute(
      'href',
      '/screens/3',
    );
    const miro = within(list).getAllByRole('link', { name: /Miro diagram/ });
    expect(miro).toHaveLength(1);
    expect(miro[0]).toHaveAttribute('href', `${SAMPLE_MIRO}?moveToWidget=12`);
    expect(miro[0]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(miro[0]).toHaveAttribute('target', '_blank');

    await user.click(within(list).getByRole('link', { name: 'Open Solicitudes' }));
    expect(router.state.location.pathname).toBe('/screens/7');
  });

  it('shows fewer than ten screens as they are, with no claim about a top ten', async () => {
    await openStep(3);
    const card = await screen.findByRole('region', { name: 'Read these screens first' });

    expect(within(card).getAllByRole('listitem').length).toBeGreaterThanOrEqual(4);
    expect(card).not.toHaveTextContent(/top 10|10 most|ten /i);
  });

  it('shows ten screens, the most the API sends', async () => {
    const keyScreens = Array.from({ length: 10 }, (_, index) => ({
      screen: { id: 100 + index, name: `Pantalla${index + 1}` },
      documentationStatus: 'DRAFT' as const,
      connections: 10 - index,
      depth: index + 1,
      miroLink: null,
    }));
    await openStep(3, makeSummary({ keyScreens }));
    const list = await screen.findByRole('list', { name: 'Key screens in reading order' });

    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
  });

  it('says there are no key screens in an application with only App (OnStart)', async () => {
    await openStep(3, makeEmptySummary());

    expect(
      await screen.findByRole('heading', { name: 'No key screens yet', level: 2 }),
    ).toBeVisible();
    expect(
      screen.getByText('Screens appear here once they are documented and linked.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('list', { name: 'Key screens in reading order' }),
    ).not.toBeInTheDocument();
  });
});

describe('step 4: critical variables', () => {
  it('lists the global variables in the order the API sends them, with type, origin and use', async () => {
    await openStep(4);
    const list = await screen.findByRole('list', { name: 'Critical variables by use' });
    const rows = within(list).getAllByRole('listitem');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('gUsuarioActual');
    expect(rows[0]).toHaveTextContent('Record');
    expect(rows[0]).toHaveTextContent('Used by 18 screens');
    expect(rows[1]).toHaveTextContent('gFiltros');
    expect(rows[1]).toHaveTextContent('Table');
    expect(rows[1]).toHaveTextContent('Used by 1 screen');
  });

  it('says "No origin screen" for a variable without one and links the origin of the others', async () => {
    await openStep(4);
    const list = await screen.findByRole('list', { name: 'Critical variables by use' });
    const [first, second] = within(list).getAllByRole('listitem') as [HTMLElement, HTMLElement];

    expect(first).toHaveTextContent('No origin screen');
    expect(within(first).queryByText('Created in')).not.toBeInTheDocument();
    expect(second).toHaveTextContent('Created in Inicio');
    expect(within(second).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
      'href',
      '/screens/3',
    );
  });

  it('links each variable to its page', async () => {
    const user = setupUser();
    const { router } = await openStep(4);
    const list = await screen.findByRole('list', { name: 'Critical variables by use' });

    expect(within(list).getByRole('link', { name: 'gUsuarioActual' })).toHaveAttribute(
      'href',
      '/variables/11',
    );
    await user.click(within(list).getByRole('link', { name: 'gFiltros' }));
    expect(router.state.location.pathname).toBe('/variables/14');
  });

  it('keeps the order of the API', async () => {
    const summary = makeSummary();
    await openStep(4, makeSummary({ globalVariables: [...summary.globalVariables].reverse() }));
    const list = await screen.findByRole('list', { name: 'Critical variables by use' });

    expect(
      within(list)
        .getAllByRole('listitem')
        .map((row) => row.querySelector('a')?.textContent),
    ).toEqual(['gFiltros', 'gUsuarioActual']);
  });

  it('says there are no global variables in an application with only App (OnStart)', async () => {
    await openStep(4, makeEmptySummary());

    expect(
      await screen.findByRole('heading', { name: 'No global variables yet', level: 2 }),
    ).toBeVisible();
    expect(
      screen.getByText('Global variables appear here once screens read or write them.'),
    ).toBeVisible();
  });
});

describe('step 5: most used components', () => {
  it('lists the components in the order the API sends them, with their screen and uses', async () => {
    await openStep(5);
    const list = await screen.findByRole('list', { name: 'Components by use' });
    const rows = within(list).getAllByRole('listitem');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('galSolicitudes');
    expect(rows[0]).toHaveTextContent('in Solicitudes');
    expect(rows[0]).toHaveTextContent('Uses 5 variables and collections');
    expect(rows[1]).toHaveTextContent('btnGuardar');
    expect(rows[1]).toHaveTextContent('in Detalle');
    expect(rows[1]).toHaveTextContent('Uses 1 variable or collection');
  });

  it('leads a component to the Components & navigation tab of its screen and the screen to its page', async () => {
    const user = setupUser();
    const { router } = await openStep(5);
    const list = await screen.findByRole('list', { name: 'Components by use' });

    expect(within(list).getByRole('link', { name: 'galSolicitudes' })).toHaveAttribute(
      'href',
      '/screens/7?tab=components',
    );
    expect(within(list).getByRole('link', { name: 'Solicitudes' })).toHaveAttribute(
      'href',
      '/screens/7',
    );

    await user.click(within(list).getByRole('link', { name: 'btnGuardar' }));
    expect(router.state.location.pathname).toBe('/screens/12');
    expect(router.state.location.search).toBe('?tab=components');
  });

  it('says no component uses variables or collections in an application with only App (OnStart)', async () => {
    await openStep(5, makeEmptySummary());

    expect(
      await screen.findByRole('heading', {
        name: 'No components use variables or collections yet',
        level: 2,
      }),
    ).toBeVisible();
    expect(
      screen.getByText('Components appear here once they use a variable or a collection.'),
    ).toBeVisible();
  });

  it('has no fixed tips: no frame draws them', async () => {
    await openStep(5);
    const card = await screen.findByRole('region', { name: 'Components that use the most data' });

    expect(within(card).queryByText(/Reading tip|Status tags/i)).not.toBeInTheDocument();
  });
});

describe('the column on the right', () => {
  it('links to App (OnStart), its Miro diagram, the map and the search', async () => {
    await openStep(3);
    const explore = await screen.findByRole('region', { name: 'Explore while you read' });

    expect(within(explore).getByRole('link', { name: 'Open App (OnStart)' })).toHaveAttribute(
      'href',
      '/screens/10',
    );
    expect(within(explore).getByRole('link', { name: /^Miro diagram/ })).toHaveAttribute(
      'href',
      SAMPLE_MIRO,
    );
    expect(within(explore).getByRole('link', { name: 'See it on the map' })).toHaveAttribute(
      'href',
      '/dependency-map',
    );
    expect(within(explore).getByRole('link', { name: 'Search the documentation' })).toHaveAttribute(
      'href',
      '/search',
    );
  });

  it('leaves out the Miro diagram when App (OnStart) has none or it is not https', async () => {
    const base = makeSummary();
    await openStep(
      3,
      makeSummary({
        appContextScreen: { ...base.appContextScreen, miroLink: 'http://miro.com/x' },
      }),
    );
    const explore = await screen.findByRole('region', { name: 'Explore while you read' });

    expect(within(explore).queryByRole('link', { name: /Miro diagram/ })).not.toBeInTheDocument();
    expect(within(explore).getAllByRole('link')).toHaveLength(3);
  });

  it('shows the figures of the summary under "<application> at a glance", on every step', async () => {
    await openStep(4);
    const glance = await screen.findByRole('region', { name: 'SAR at a glance' });

    expect(
      within(glance)
        .getAllByRole('definition')
        .map((item) => item.textContent),
    ).toEqual(['31', '47', '9', '41.7%']);
    expect(within(glance).getByText('approved')).toBeVisible();
  });

  it('is the same column in the five steps', async () => {
    await openStep(5);
    expect(await screen.findByRole('region', { name: 'Explore while you read' })).toBeVisible();
    expect(stepRegion('SAR at a glance')).toBeVisible();
  });
});
