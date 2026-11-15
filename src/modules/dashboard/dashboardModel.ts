// dashboardModel: the pure part of the dashboard (FR-19): the shapes taken from the contract, the percentages, the
// rows of the status chart, the links of every indicator and the summaries read by screen readers.
// Nothing here draws or reads: the components and the hooks use it, and the tests check it without a page.
//
// Percentages. The API sends only `approvedPercent`; the share of the other statuses is calculated here with the SAME
// rule the API uses for it (D-106): whole-number arithmetic with half-up rounding to one decimal,
// `floor((2·n·1000 + t) / (2·t))` tenths. Never Math.round or toFixed over a binary decimal (6.25 would give 6.2).
// The card shows `approvedPercent` as the API sends it; the Approved row of the legend is calculated and must match.
import type { components } from '../../api/schema';
import {
  DOCUMENTATION_STATUS_LABEL,
  type DocumentationStatus,
} from '../../components/ui/documentationStatus';
import { clockOf, dayOf, formatDay } from '../audit/auditDates';
import { toTagStatus } from '../screens/screenLabels';
import type { ApiDocumentationStatus } from '../screens/screenTypes';

export type Indicators = components['schemas']['IndicatorsEnvelope']['data'];
export type ActivitySummary = components['schemas']['ActivitySummary'];

/** The five statuses of `byStatus`, in the order of the chart and the legend (Table 54). */
export const STATUS_ORDER: readonly ApiDocumentationStatus[] = [
  'UNDOCUMENTED',
  'DRAFT',
  'IN_PROGRESS',
  'IN_REVIEW',
  'APPROVED',
];

/** Tenths of a percent of n over t, half-up, in whole numbers (0 when t is 0, as the API does). */
export function percentTenths(n: number, t: number): number {
  if (t <= 0) return 0;
  return Math.floor((2 * n * 1000 + t) / (2 * t));
}

/** "33.3" from tenths (333); always one decimal ("50.0", "0.0", "100.0"). */
export function tenthsText(tenths: number): string {
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

/** The share of n over t as the legend shows it: "6.3". */
export function percentText(n: number, t: number): string {
  return tenthsText(percentTenths(n, t));
}

/** `approvedPercent` as the API sent it, with one decimal for a whole number ("50.0"); nothing is recalculated. */
export function apiPercentText(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

export interface StatusRow {
  api: ApiDocumentationStatus;
  /** The identifier of the Tag / chart color (`in-progress`). */
  tag: DocumentationStatus;
  label: string;
  count: number;
  /** The share of the total, "8.3" (without the % sign). */
  percent: string;
  href: string;
}

export function screensHref(status: ApiDocumentationStatus): string {
  return `/screens?status=${status}`;
}

export const UNTRACED_HREF = '/variables?untraced=true';
export const UNDOCUMENTED_HREF = '/collections?undocumented=true';
/** The screen list ordered by pending to-dos, most first (the real `sort` of the list, D-54). */
export const PENDING_HREF = '/screens?sort=-pendingSubtasks';
/** The audit log opens on the application selected in the shell (its default; `application=all` is the only value). */
export const AUDIT_HREF = '/audit';

export function todoHref(screenId: number): string {
  return `/screens/${screenId}?tab=todo`;
}

export function statusRows(indicators: Indicators): StatusRow[] {
  const { byStatus, totalScreens } = indicators.documentation;
  return STATUS_ORDER.map((api) => ({
    api,
    tag: toTagStatus(api),
    label: DOCUMENTATION_STATUS_LABEL[toTagStatus(api)],
    count: byStatus[api],
    percent: percentText(byStatus[api], totalScreens),
    href: screensHref(api),
  }));
}

export function screensText(count: number): string {
  return `${count} ${count === 1 ? 'screen' : 'screens'}`;
}

/** The aria-label of the donut: every figure of the legend in one sentence. */
export function donutSummary(rows: readonly StatusRow[], total: number): string {
  const parts = rows.map((row) => `${row.label} ${row.count} (${row.percent}%)`);
  return `Documentation by status: ${screensText(total)}. ${parts.join(', ')}.`;
}

export interface TopScreen {
  id: number;
  name: string;
  pending: number;
}

/** The aria-label of the bars: "Pending to-dos by screen: Detalle 3, App (OnStart) 2, Inicio 1." */
export function barsSummary(rows: readonly TopScreen[]): string {
  return `Pending to-dos by screen: ${rows.map((row) => `${row.name} ${row.pending}`).join(', ')}.`;
}

export function pendingText(count: number): string {
  return `${count} pending to-do${count === 1 ? '' : 's'}`;
}

/** An application with nothing documented yet: only App (OnStart), no variable and no collection. */
export function isEmptyApplication(indicators: Indicators): boolean {
  return (
    indicators.documentation.totalScreens <= 1 &&
    indicators.variables.total === 0 &&
    indicators.collections.total === 0
  );
}

/** "2026-10-05 08:40": the local day and time of the last synchronization, or null when it never happened. */
export function syncedText(iso: string | null, timeZone: string): string | null {
  return iso === null ? null : `${dayOf(iso, timeZone)} ${clockOf(iso, timeZone)}`;
}

/** The greeting by the local hour of the browser. */
export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 19) return 'Good afternoon';
  return 'Good evening';
}

/** The first word of the name of the user ("Camila Castillo" -> "Camila"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/** "10:21" for a record of today, "Oct 4, 10:21" for another day (`today` is the local day, YYYY-MM-DD). */
export function activityTime(iso: string, timeZone: string, today: string): string {
  const day = dayOf(iso, timeZone);
  return day === today
    ? clockOf(iso, timeZone)
    : `${formatDay(day, today)}, ${clockOf(iso, timeZone)}`;
}
