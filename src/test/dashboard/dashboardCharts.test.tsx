// The two charts of the dashboard: each is role="img" with an aria-label that has every figure, and has a text
// alternative with the same numbers (the legend table, the list of screens). Zero states and links.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  barsSummary,
  donutSummary,
  statusRows,
  type TopScreen,
} from '../../modules/dashboard/dashboardModel';
import { NO_PENDING_TEXT, PendingBars } from '../../modules/dashboard/PendingBars';
import { NO_SCREENS_TEXT, StatusChart } from '../../modules/dashboard/StatusChart';
import { makeIndicators } from '../helpers/fakeDashboardApi';

function renderChart(indicators = makeIndicators()) {
  const rows = statusRows(indicators);
  const total = indicators.documentation.totalScreens;
  render(
    <MemoryRouter>
      <StatusChart rows={rows} total={total} />
    </MemoryRouter>,
  );
  return { rows, total };
}

describe('status donut', () => {
  it('is an image whose label has every figure of the legend', () => {
    const { rows, total } = renderChart();
    const chart = screen.getByRole('img', { name: /Documentation by status/ });
    expect(chart).toHaveAccessibleName(donutSummary(rows, total));
    expect(chart).toHaveAccessibleName(
      'Documentation by status: 24 screens. Undocumented 2 (8.3%), Draft 3 (12.5%), In progress 6 (25.0%), In review 3 (12.5%), Approved 10 (41.7%).',
    );
  });

  it('has a table with the same figures, the five statuses always', () => {
    renderChart();
    const table = screen.getByRole('table', { name: 'Documentation by status' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => [...row.children].map((cell) => cell.textContent))).toEqual([
      ['Undocumented', '2', '8.3%'],
      ['Draft', '3', '12.5%'],
      ['In progress', '6', '25.0%'],
      ['In review', '3', '12.5%'],
      ['Approved', '10', '41.7%'],
    ]);
  });

  it('shows the zeros as text, and the information does not depend on color', () => {
    renderChart(
      makeIndicators({
        byStatus: { UNDOCUMENTED: 0, DRAFT: 0, IN_PROGRESS: 0, IN_REVIEW: 0, APPROVED: 5 },
      }),
    );
    const table = screen.getByRole('table', { name: 'Documentation by status' });
    expect(within(table).getByRole('row', { name: /Undocumented 0 0\.0%/ })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /Approved 5 100\.0%/ })).toBeInTheDocument();
    // A segment has a path only for what is above 0: one (the full ring).
    expect(document.querySelectorAll('svg path')).toHaveLength(1);
  });

  it('links each status to the screen list with its parameter', () => {
    renderChart();
    expect(screen.getByRole('link', { name: 'In review' })).toHaveAttribute(
      'href',
      '/screens?status=IN_REVIEW',
    );
    expect(screen.getAllByRole('link')).toHaveLength(5);
  });

  it('says so when there are no screens, and draws no segment', () => {
    renderChart(
      makeIndicators({
        byStatus: { UNDOCUMENTED: 0, DRAFT: 0, IN_PROGRESS: 0, IN_REVIEW: 0, APPROVED: 0 },
      }),
    );
    expect(screen.getByText(NO_SCREENS_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/0 screens\. Undocumented 0 \(0\.0%\)/);
    expect(document.querySelectorAll('svg path')).toHaveLength(0);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('draws the entrance only for those who accept motion', () => {
    renderChart();
    expect(document.querySelector('g')).toHaveClass('motion-safe:animate-fade-in');
  });
});

const TOP: TopScreen[] = [
  { id: 13, name: 'Detalle', pending: 3 },
  { id: 10, name: 'App (OnStart)', pending: 2 },
  { id: 12, name: 'Inicio', pending: 1 },
];

function renderBars(rows: TopScreen[]) {
  render(
    <MemoryRouter>
      <PendingBars rows={rows} />
    </MemoryRouter>,
  );
}

describe('pending to-dos by screen', () => {
  it('is an image whose label has every screen and its count', () => {
    renderBars(TOP);
    expect(screen.getByRole('img')).toHaveAccessibleName(barsSummary(TOP));
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Pending to-dos by screen: Detalle 3, App (OnStart) 2, Inicio 1.',
    );
  });

  it('lists the same figures as text, each screen a link to its To-do tab with the count in its name', () => {
    renderBars(TOP);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Detalle, 3 pending to-dos3',
      'App (OnStart), 2 pending to-dos2',
      'Inicio, 1 pending to-do1',
    ]);
    expect(screen.getByRole('link', { name: 'Detalle, 3 pending to-dos' })).toHaveAttribute(
      'href',
      '/screens/13?tab=todo',
    );
  });

  it('draws each bar relative to the longest one', () => {
    renderBars(TOP);
    const bars = [...document.querySelectorAll('rect')].filter((rect) =>
      rect.getAttribute('fill')?.startsWith('url('),
    );
    expect(bars.map((bar) => bar.getAttribute('width'))).toEqual([
      '100%',
      `${(2 / 3) * 100}%`,
      `${(1 / 3) * 100}%`,
    ]);
  });

  it('says so when no screen has pending to-dos', () => {
    renderBars([]);
    expect(screen.getByText(NO_PENDING_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
