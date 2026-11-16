// reportTexts: the fixed texts of the reports page (S-33, S-33r, P-05, P-06). New texts are listed in DESIGN_REFERENCE §9.
// The error texts of the API come from src/api/messages.ts; the reason a report failed is the `errorMessage` of the API
// itself (one of four fixed texts, D-119) and is never replaced.
import type { ReportFormat, ReportStatus } from './reportModel';

export const REPORTS_TITLE = 'Reports';
export const GENERATE_LABEL = 'Generate report';
export const GENERATE_AGAIN_LABEL = 'Generate again';
export const DOWNLOAD_LABEL = 'Download';
export const CHECK_AGAIN_LABEL = 'Check again';
export const RELOAD_LABEL = 'Reload';

export const FILTER_LABEL = 'Show reports';
export const FILTER_ALL = 'All';
export const FILTER_PUBLISHED = 'Published';

export const PUBLISHED_LABEL = 'Published';
export const NOT_PUBLISHED_LABEL = 'Not published';

export const BUILDING_TEXT = 'Building in the background';
export const STILL_GENERATING_TEXT = 'Still generating. You can keep working or check again.';

export const PUBLISH_DISABLED_PENDING = 'Available when the report is ready.';
export const PUBLISH_DISABLED_FAILED = "A failed report can't be published.";

export const PUBLISHED_TOAST = 'Published. Readers can now see this report.';
export const UNPUBLISHED_TOAST = 'Unpublished. Readers can no longer see this report.';
export const READY_TOAST_SUFFIX = ' is ready.';
export const FAILED_ANNOUNCEMENT_SUFFIX = ' failed.';
export const REGENERATING_TOAST_SUFFIX = ' is being generated again.';

export const LIST_LABEL = 'Report list';

export function pageDescription(applicationName: string, reader: boolean): string {
  return reader
    ? 'Reports published for you.'
    : `Saved reports of ${applicationName}. Published ones are visible to Readers.`;
}

export const STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: 'Generating',
  READY: 'Ready',
  FAILED: 'Failed',
};

export const FORMAT_LABEL: Record<ReportFormat, string> = { PDF: 'PDF', XLSX: 'Excel' };
export const FORMAT_TILE: Record<ReportFormat, string> = { PDF: 'PDF', XLSX: 'XLSX' };

export const EMPTY_TITLE = 'No reports yet';
export const emptyText = (applicationName: string) =>
  `Generate a report to share the documentation of ${applicationName} as a PDF or an Excel file.`;
export const EMPTY_READER_TITLE = 'No published reports yet';
export const EMPTY_READER_TEXT = 'Reports published by the team will appear here.';
export const EMPTY_PUBLISHED_TITLE = 'No published reports';
export const EMPTY_PUBLISHED_TEXT = 'Publish a ready report to make it visible to Readers.';
export const SHOW_ALL_LABEL = 'Show all reports';
