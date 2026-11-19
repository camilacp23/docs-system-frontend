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

// ---- The generate dialog (S-34) --------------------------------------------------------------------------------------
export const DIALOG_TITLE = 'Generate report';
export const dialogDescription = (applicationName: string) =>
  `${applicationName} · PDF or Excel of the application's documentation`;
export const TITLE_LABEL = 'Title';
export const FORMAT_FIELD_LABEL = 'Format';
export const INCLUDE_LABEL = 'Include';
export const STATUS_FIELD_LABEL = 'Documentation status';
export const SCREENS_LABEL = 'Screens';
export const STATUS_HELP = 'None selected = all statuses';
export const STATUS_DISABLED_HELP = 'Applies when Screens or Components is included.';
export const FORMAT_DESCRIPTION: Record<ReportFormat, string> = {
  PDF: 'Formatted document to read and share',
  XLSX: 'Spreadsheet, one sheet per section',
};
export const DEPENDENCIES_LABEL = 'Include dependencies';
export const DEPENDENCIES_HELP = 'What each screen reads, writes and opens';
export const STATUS_SUMMARY_LABEL = 'Include status summary';
export const STATUS_SUMMARY_HELP = 'Overall documentation status of the application';
export const PUBLISH_LABEL = 'Publish when ready';
export const PUBLISH_HELP = 'Readers can see and download it';
export const FOOTER_NOTE = 'Built in the background — you can keep working.';
export const CANCEL_LABEL = 'Cancel';
export const SUBMIT_LABEL = 'Create report';

export const TITLE_REQUIRED_TEXT = 'Title is required.';
export const INCLUDE_REQUIRED_TEXT = 'Choose at least one element, or include the status summary.';
export const NOT_APPLICABLE_TEXT = (label: string) =>
  `${label} only applies when Screens or Components is included.`;
export const fieldsNeedAttention = (count: number) =>
  `${count} field${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} attention.`;

export const SUMMARY_NOTHING = 'Nothing selected yet';
export const SUMMARY_STATUS_SUMMARY = 'Status summary';
export const SUMMARY_ALL_STATUSES = 'all statuses';
export const SUMMARY_WITH_DEPENDENCIES = 'with dependencies';
export const SUMMARY_WILL_PUBLISH = 'published when ready';
export const screensSummary = (count: number) => `${count} screen${count === 1 ? '' : 's'}`;

// The screen selector
export const SCREENS_PLACEHOLDER = 'All screens';
export const SCREENS_EMPTY_BOX_TEXT = 'No screens chosen yet.';
export const SCREENS_HELP = 'Leave empty to include every screen.';
export const screensSelected = (count: number) => `${screensSummary(count)} selected`;
export const SCREEN_SEARCH_LABEL = 'Search screens';
export const SCREEN_LIST_LABEL = 'Screens to include';
export const SCREEN_LIMIT_TEXT = 'You can select up to 500 screens.';
export const SCREEN_NONE_TEXT = 'No screens match.';
export const SCREEN_LOADING_TEXT = 'Loading screens…';
export const LOAD_MORE_LABEL = 'Load more';
export const REMOVE_SCREEN = (name: string) => `Remove ${name}`;
export const CLEAR_SCREENS_LABEL = 'Clear selection';
export const SCREEN_PANEL_LABEL = 'Choose screens';
