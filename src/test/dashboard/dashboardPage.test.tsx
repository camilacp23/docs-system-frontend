// The dashboard page (FR-19, S-31): the figures of every indicator, the five statuses with their zeros, the percentage
// exactly as the API sends it, the screens with the most pending to-dos, the link of every indicator to its list with the
// real parameters, refresh, and the headings and names a screen reader needs.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeScreenDetail } from '../helpers/fakeScreensApi';
import { makeIndicators } from '../helpers/fakeDashboardApi';
import { renderDashboard } from '../helpers/renderDashboard';
import { setupUser } from '../helpers/setupUser';

const card = (name: string) => screen.getByRole('article', { name });

describe('dashboard: figures', () => {
  it('greets by first name and says whose documentation it is', async () => {
    await renderDashboard({ name: 'Camila Castillo' });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /^Good (morning|afternoon|evening), Camila$/,
    );
    expect(screen.getByText('Documentation health of SAR')).toBeInTheDocument();
  });

  it('shows the approved percentage exactly as the API sends it', async () => {
    await renderDashboard({
      indicators: {
        1: makeIndicators({
          byStatus: { UNDOCUMENTED: 5, DRAFT: 3, IN_PROGRESS: 2, IN_REVIEW: 5, APPROVED: 1 },
          approvedPercent: 6.3,
        }),
      },
    });

    const approved = within(card('Documentation approved'));
    expect(approved.getByText('6.3%')).toBeInTheDocument();
    expect(approved.getByText('1 of 16 screens approved')).toBeInTheDocument();
  });

  it('writes a whole percentage with one decimal', async () => {
    await renderDashboard({
      indicators: {
        1: makeIndicators({
          byStatus: { UNDOCUMENTED: 1, DRAFT: 0, IN_PROGRESS: 0, IN_REVIEW: 0, APPROVED: 1 },
        }),
      },
    });

    expect(within(card('Documentation approved')).getByText('50.0%')).toBeInTheDocument();
  });

  it('shows the figures of the other four cards over their totals', async () => {
    await renderDashboard();

    expect(card('Screens in review')).toHaveTextContent('3');
    expect(card('Screens in review')).toHaveTextContent('Waiting for a decision');
    expect(card('Variables without origin')).toHaveTextContent('9');
    expect(card('Variables without origin')).toHaveTextContent('of 134 variables');
    expect(card('Collections not linked')).toHaveTextContent('1');
    expect(card('Collections not linked')).toHaveTextContent('of 4 collections');
    expect(card('Pending to-dos')).toHaveTextContent('6');
    expect(card('Pending to-dos')).toHaveTextContent('Subtasks not Done in Jira');
  });

  it('uses the singular for one variable and one collection', async () => {
    await renderDashboard({
      indicators: {
        1: makeIndicators({
          variables: { total: 1, untraced: 1 },
          collections: { total: 1, undocumented: 0 },
        }),
      },
    });

    expect(card('Variables without origin')).toHaveTextContent('of 1 variable');
    expect(card('Collections not linked')).toHaveTextContent('of 1 collection');
  });

  it('lists the five statuses in the legend, also the ones that are 0, with App (OnStart) counted', async () => {
    await renderDashboard({
      indicators: {
        1: makeIndicators({
          byStatus: { UNDOCUMENTED: 0, DRAFT: 2, IN_PROGRESS: 0, IN_REVIEW: 0, APPROVED: 2 },
        }),
      },
    });

    const table = screen.getByRole('table', { name: 'Documentation by status' });
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => [...row.children].map((cell) => cell.textContent));
    expect(rows).toEqual([
      ['Undocumented', '0', '0.0%'],
      ['Draft', '2', '50.0%'],
      ['In progress', '0', '0.0%'],
      ['In review', '0', '0.0%'],
      ['Approved', '2', '50.0%'],
    ]);
    expect(screen.getByText('4 screens · App (OnStart) included')).toBeInTheDocument();
  });

  it('says when the data was read and the Refresh button reads both again', async () => {
    const user = setupUser();
    const { api } = await renderDashboard();
    expect(screen.getByText(/^Updated \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(api.callsTo('GET /dashboard/indicators')).toHaveLength(1);
    expect(api.callsTo('GET /screens').filter((c) => c.options.query?.pageSize !== 1)).toHaveLength(
      1,
    );

    api.state.indicators[1] = makeIndicators({
      variables: { total: 134, untraced: 4 },
      recentActivity: [],
    });
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(api.callsTo('GET /dashboard/indicators')).toHaveLength(2);
    expect(card('Variables without origin')).toHaveTextContent('4');
    expect(api.callsTo('GET /screens').filter((c) => c.options.query?.pageSize !== 1)).toHaveLength(
      2,
    );
  });
});

describe('dashboard: screens with the most pending to-dos', () => {
  it('asks for the list ordered by pending to-dos of this application', async () => {
    const { api } = await renderDashboard();

    const read = api.callsTo('GET /screens').find((call) => call.options.query?.sort !== undefined);
    // One row more than the five it shows: the API lists App (OnStart) first whatever the order.
    expect(read?.options.query).toMatchObject({
      applicationId: 1,
      sort: '-pendingSubtasks',
      pageSize: 6,
    });
  });

  it('lists the screens with pending to-dos, the most first, and leaves out the ones with none', async () => {
    await renderDashboard();

    const list = within(screen.getByRole('region', { name: 'Pending to-dos by screen' })).getByRole(
      'list',
    );
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Detalle, 3 pending to-dos',
      'App (OnStart), 2 pending to-dos',
      'Inicio, 1 pending to-do',
    ]);
    expect(
      screen.getByRole('img', {
        name: 'Pending to-dos by screen: Detalle 3, App (OnStart) 2, Inicio 1.',
      }),
    ).toBeInTheDocument();
  });

  it('keeps the fifth screen when App (OnStart) has none (the API lists it first)', async () => {
    await renderDashboard({
      screens: [
        makeScreenDetail(10, 'App (OnStart)', { isAppContext: true, pendingSubtasks: 0 }),
        ...[5, 4, 3, 2, 1].map((pending, index) =>
          makeScreenDetail(20 + index, `Pantalla${pending}`, { pendingSubtasks: pending }),
        ),
      ],
    });

    const list = within(screen.getByRole('region', { name: 'Pending to-dos by screen' })).getByRole(
      'list',
    );
    expect(within(list).getAllByRole('link')).toHaveLength(5);
    expect(within(list).getByRole('link', { name: /^Pantalla1,/ })).toBeInTheDocument();
  });

  it('shows no more than five screens', async () => {
    await renderDashboard({
      screens: [
        makeScreenDetail(10, 'App (OnStart)', { isAppContext: true, pendingSubtasks: 0 }),
        ...[7, 6, 5, 4, 3, 2].map((pending, index) =>
          makeScreenDetail(20 + index, `Pantalla${pending}`, { pendingSubtasks: pending }),
        ),
      ],
    });

    const list = within(screen.getByRole('region', { name: 'Pending to-dos by screen' })).getByRole(
      'list',
    );
    expect(within(list).getAllByRole('link')).toHaveLength(5);
    expect(within(list).queryByRole('link', { name: /^Pantalla2,/ })).not.toBeInTheDocument();
  });

  it('says so when no screen has pending to-dos', async () => {
    await renderDashboard({
      screens: [makeScreenDetail(10, 'App (OnStart)', { isAppContext: true })],
    });

    expect(screen.getByText('No pending to-dos')).toBeInTheDocument();
  });
});

describe('dashboard: every indicator leads to its list', () => {
  const user = setupUser();
  const at = (router: { state: { location: { pathname: string; search: string } } }) =>
    `${router.state.location.pathname}${router.state.location.search}`;

  it.each([
    ['Documentation approved', 'View screens →', '/screens?status=APPROVED'],
    ['Screens in review', 'View in review →', '/screens?status=IN_REVIEW'],
    ['Variables without origin', 'View untraced →', '/variables?untraced=true'],
    ['Collections not linked', 'View collections →', '/collections?undocumented=true'],
    ['Pending to-dos', 'By screen →', '/screens?sort=-pendingSubtasks'],
  ])('%s -> %s', async (label, linkText, destination) => {
    const { router } = await renderDashboard();

    const link = within(card(label)).getByRole('link', { name: linkText });
    expect(link).toHaveAttribute('href', destination);
    await user.click(link);

    expect(at(router)).toBe(destination);
  });

  it.each([
    ['Undocumented', '/screens?status=UNDOCUMENTED'],
    ['Draft', '/screens?status=DRAFT'],
    ['In progress', '/screens?status=IN_PROGRESS'],
    ['In review', '/screens?status=IN_REVIEW'],
    ['Approved', '/screens?status=APPROVED'],
  ])('the legend row %s leads to %s', async (label, destination) => {
    const { router } = await renderDashboard();

    await user.click(
      within(screen.getByRole('table', { name: 'Documentation by status' })).getByRole('link', {
        name: label,
      }),
    );

    expect(at(router)).toBe(destination);
  });

  it('a screen of the pending list leads to its Future to do tab', async () => {
    const { router } = await renderDashboard();

    await user.click(screen.getByRole('link', { name: 'Detalle, 3 pending to-dos' }));

    expect(at(router)).toBe('/screens/12?tab=todo');
  });
});

describe('dashboard: structure for assistive technology', () => {
  it('has one h1 and the blocks as h2, with the cards of figures as h3 under "Indicators"', async () => {
    await renderDashboard();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      'Indicators',
      'Documentation by status',
      'Pending to-dos by screen',
      'Recent activity',
    ]);
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual([
      'Documentation approved',
      'Screens in review',
      'Variables without origin',
      'Collections not linked',
      'Pending to-dos',
    ]);
  });

  it('every link has a name', async () => {
    await renderDashboard();

    const main = screen.getByRole('main');
    for (const link of within(main).getAllByRole('link')) {
      expect(link).toHaveAccessibleName();
      expect(link.getAttribute('href')).toMatch(/^\//);
    }
  });
});
