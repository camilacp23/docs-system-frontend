// reportModel: the types and the pure rules of the report list (Module 9, FR-22).
// Types come from the generated contract: Report (list row), ReportDetail (with `parameters`), ReportRequest.
// Constants: POLL_INTERVAL_MS (3 s) and POLL_CAP_MS (180 s) of the polling (D-135), PAGE_SIZE of the list (12: a row of
// three cards, D-139 of the plan), PAGE_SIZES.
// Functions: etagOf(report) (the weak tag of D-118 from `updatedAt`), fileSizeText, completedText, publishedDay,
// fileNameFromDisposition (the name in Content-Disposition), downloadName, isPending.
import { clockOf, dayOf } from '../audit/auditDates';
import type { components } from '../../api/schema';

export type Report = components['schemas']['Report'];
export type ReportDetail = components['schemas']['ReportDetail'];
export type ReportRequest = components['schemas']['ReportRequest'];
export type ReportStatus = Report['status'];
export type ReportFormat = Report['format'];

/** Interval of the polling of a PENDING report (D-135). */
export const POLL_INTERVAL_MS = 3000;
/** After this long without an answer other than PENDING the polling stops and the user can check again (D-135). */
export const POLL_CAP_MS = 180_000;
export const PAGE_SIZE = 12;
export const PAGE_SIZES: readonly number[] = [12, 24, 48];

export function isPending(report: Pick<Report, 'status'>): boolean {
  return report.status === 'PENDING';
}

/**
 * The `If-Match` of a report taken from the list row: the contract defines the tag as W/"<epoch ms of updatedAt>" (D-118),
 * and the list has no tag per item. A newer response (a poll, a PUT) carries the real tag, which is preferred.
 */
export function etagOf(report: Pick<Report, 'updatedAt'>): string {
  return `W/"${Date.parse(report.updatedAt)}"`;
}

/** "412 KB", "1.5 MB", "300 B": the size of a file as the card shows it. */
export function fileSizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Oct 5" (with the year when it is not this one) in the given time zone. */
function shortDate(iso: string, timeZone: string, now: Date): string {
  const date = new Date(iso);
  const sameYear =
    new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone }).format(date) ===
    new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone }).format(now);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone,
  }).format(date);
}

/** "Completed Oct 5 · 09:01 · 412 KB" (S-33). */
export function completedText(
  report: Pick<Report, 'completedAt' | 'fileSize'>,
  timeZone: string,
  now: Date = new Date(),
): string {
  const parts: string[] = [];
  if (report.completedAt !== null) {
    parts.push(
      `Completed ${shortDate(report.completedAt, timeZone, now)} · ${clockOf(report.completedAt, timeZone)}`,
    );
  }
  if (report.fileSize !== null) parts.push(fileSizeText(report.fileSize));
  return parts.join(' · ');
}

/** "Published 2026-10-05" (S-33r). */
export function publishedDay(report: Pick<Report, 'publishedAt'>, timeZone: string): string | null {
  return report.publishedAt === null ? null : dayOf(report.publishedAt, timeZone);
}

// The server builds the name from a closed alphabet (D-120): letters, digits, "-" and ".", one quoted parameter.
const DISPOSITION_NAME = /filename="([a-z0-9][a-z0-9.-]*)"/;
const SAFE_NAME = /^[a-z0-9][a-z0-9.-]*$/;

/** The file name of a `Content-Disposition` header, only when it has the closed shape of D-120; otherwise null. */
export function fileNameFromDisposition(header: string | null): string | null {
  if (header === null) return null;
  const match = DISPOSITION_NAME.exec(header);
  return match?.[1] ?? null;
}

/** The name the saved file gets: the header's, else the report's `fileName`, else a neutral one. */
export function downloadName(header: string | null, fileName: string | null, format: ReportFormat) {
  const fromHeader = fileNameFromDisposition(header);
  if (fromHeader !== null) return fromHeader;
  if (fileName !== null && SAFE_NAME.test(fileName)) return fileName;
  return format === 'PDF' ? 'report.pdf' : 'report.xlsx';
}
