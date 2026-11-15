// dashboardModel: the percentages (the API's own rounding, D-106), the rows of the legend, the links of every indicator
// and the summaries a screen reader gets.
import { describe, expect, it } from 'vitest';

import {
  apiPercentText,
  barsSummary,
  donutSummary,
  firstName,
  greeting,
  isEmptyApplication,
  pendingText,
  percentTenths,
  percentText,
  screensHref,
  statusRows,
  syncedText,
  todoHref,
  tenthsText,
} from '../../modules/dashboard/dashboardModel';
import { makeIndicators } from '../helpers/fakeDashboardApi';

describe('percentages, half up in whole numbers (D-106)', () => {
  // The edge cases of D-106: what the API sends as `approvedPercent` for n approved of t screens.
  it.each([
    [1, 3, '33.3'],
    [2, 3, '66.7'],
    [1, 8, '12.5'],
    [1, 16, '6.3'],
    [3, 16, '18.8'],
    [1, 6, '16.7'],
    [0, 12, '0.0'],
    [12, 12, '100.0'],
  ])('%i of %i is %s', (n, t, expected) => {
    expect(percentText(n, t)).toBe(expected);
  });

  it('is not what toFixed or Math.round give on binary decimals', () => {
    // 6.25 and 18.75 are exact in binary, but 1.005-like values are not: the rule never goes through a decimal.
    expect((1 / 16) * 100).toBe(6.25);
    expect(percentTenths(1, 16)).toBe(63);
    expect(percentTenths(5, 8)).toBe(625);
    expect(percentTenths(1, 1000)).toBe(1);
    expect(percentTenths(1, 2000)).toBe(1);
    expect(percentTenths(1, 3000)).toBe(0);
  });

  it('is 0 when there is nothing to divide', () => {
    expect(percentText(0, 0)).toBe('0.0');
  });

  it('writes tenths with one decimal', () => {
    expect(tenthsText(0)).toBe('0.0');
    expect(tenthsText(1000)).toBe('100.0');
    expect(tenthsText(417)).toBe('41.7');
  });

  it('shows approvedPercent as the API sends it', () => {
    expect(apiPercentText(33.3)).toBe('33.3');
    expect(apiPercentText(50)).toBe('50.0');
    expect(apiPercentText(0)).toBe('0.0');
    expect(apiPercentText(100)).toBe('100.0');
  });

  it.each([
    [1, 3],
    [2, 3],
    [1, 8],
    [1, 16],
    [3, 16],
    [1, 6],
    [0, 12],
    [12, 12],
  ])('the Approved row of %i of %i matches the approvedPercent of the API', (approved, total) => {
    const rest = total - approved;
    const indicators = makeIndicators({
      byStatus: { UNDOCUMENTED: rest, DRAFT: 0, IN_PROGRESS: 0, IN_REVIEW: 0, APPROVED: approved },
    });
    const approvedRow = statusRows(indicators).find((row) => row.api === 'APPROVED');
    expect(approvedRow?.percent).toBe(apiPercentText(indicators.documentation.approvedPercent));
  });
});

describe('the rows of the legend', () => {
  it('has the five statuses in order, also the ones that are 0', () => {
    const rows = statusRows(
      makeIndicators({
        byStatus: { UNDOCUMENTED: 0, DRAFT: 0, IN_PROGRESS: 0, IN_REVIEW: 0, APPROVED: 4 },
      }),
    );
    expect(rows.map((row) => [row.label, row.count, row.percent])).toEqual([
      ['Undocumented', 0, '0.0'],
      ['Draft', 0, '0.0'],
      ['In progress', 0, '0.0'],
      ['In review', 0, '0.0'],
      ['Approved', 4, '100.0'],
    ]);
    expect(rows.map((row) => row.tag)).toEqual([
      'undocumented',
      'draft',
      'in-progress',
      'in-review',
      'approved',
    ]);
  });

  it('links each status to the screen list with the real parameter', () => {
    expect(statusRows(makeIndicators()).map((row) => row.href)).toEqual([
      '/screens?status=UNDOCUMENTED',
      '/screens?status=DRAFT',
      '/screens?status=IN_PROGRESS',
      '/screens?status=IN_REVIEW',
      '/screens?status=APPROVED',
    ]);
    expect(screensHref('IN_REVIEW')).toBe('/screens?status=IN_REVIEW');
    expect(todoHref(12)).toBe('/screens/12?tab=todo');
  });
});

describe('summaries', () => {
  it('the donut says every figure of the legend', () => {
    const rows = statusRows(makeIndicators());
    expect(donutSummary(rows, 24)).toBe(
      'Documentation by status: 24 screens. Undocumented 2 (8.3%), Draft 3 (12.5%), In progress 6 (25.0%), In review 3 (12.5%), Approved 10 (41.7%).',
    );
    expect(donutSummary(rows, 1)).toContain('1 screen.');
  });

  it('the bars say every screen and its count', () => {
    expect(
      barsSummary([
        { id: 1, name: 'Detalle', pending: 3 },
        { id: 2, name: 'App (OnStart)', pending: 2 },
      ]),
    ).toBe('Pending to-dos by screen: Detalle 3, App (OnStart) 2.');
    expect(pendingText(1)).toBe('1 pending to-do');
    expect(pendingText(3)).toBe('3 pending to-dos');
  });
});

describe('the rest', () => {
  it('an application with only App (OnStart) is empty', () => {
    const empty = makeIndicators({
      byStatus: { UNDOCUMENTED: 1, DRAFT: 0, IN_PROGRESS: 0, IN_REVIEW: 0, APPROVED: 0 },
      variables: { total: 0, untraced: 0 },
      collections: { total: 0, undocumented: 0 },
    });
    expect(isEmptyApplication(empty)).toBe(true);
    expect(isEmptyApplication(makeIndicators())).toBe(false);
    expect(isEmptyApplication({ ...empty, variables: { total: 1, untraced: 0 } })).toBe(false);
  });

  it('writes the last synchronization in the zone asked for, or null when there is none', () => {
    expect(syncedText('2026-10-05T14:40:00.000Z', 'America/Costa_Rica')).toBe('2026-10-05 08:40');
    expect(syncedText(null, 'America/Costa_Rica')).toBeNull();
  });

  it('greets by the hour and by the first name', () => {
    expect(greeting(9)).toBe('Good morning');
    expect(greeting(12)).toBe('Good afternoon');
    expect(greeting(19)).toBe('Good evening');
    expect(firstName('  Camila Castillo ')).toBe('Camila');
  });
});
