// dashboardTexts: the words of the dashboard that are not built from data (S-31, S-31r, S-31j). The ones of the frames
// are marked; the rest are derived and are listed in DESIGN_REFERENCE §9, pending confirmation in design.
export const REFRESH_LABEL = 'Refresh'; // S-31
export const GENERATE_REPORT_LABEL = 'Generate report'; // S-31, flow 5
export const DIALOG_LOAD_FAILED =
  "The dialog couldn't be opened. Check your connection and try again.";

/** Titles and subtitles of the cards (S-31). */
export const STATUS_TITLE = 'Documentation by status';
export const PENDING_TITLE = 'Pending to-dos by screen';
export const PENDING_SUBTITLE = 'Jira Subtasks not Done · top screens';
export const ACTIVITY_TITLE = 'Recent activity';
export const AUDIT_LINK_TEXT = 'Audit log →';

/** The cards of figures (S-31): label, caption and link. `of N variables` and the like are built with the numbers. */
export const APPROVED_LABEL = 'Documentation approved';
export const APPROVED_LINK_TEXT = 'View screens →';
export const REVIEW_LABEL = 'Screens in review';
export const REVIEW_CAPTION = 'Waiting for a decision';
/** The frame says "Open queue →" and leads to the review queue; the queue is its own module, so the link opens the list. */
export const REVIEW_LINK_TEXT = 'View in review →';
export const UNTRACED_LABEL = 'Variables without origin';
export const UNTRACED_LINK_TEXT = 'View untraced →';
export const UNDOCUMENTED_LABEL = 'Collections not linked';
export const UNDOCUMENTED_LINK_TEXT = 'View collections →';
export const PENDING_LABEL = 'Pending to-dos';
export const PENDING_CAPTION = 'Subtasks not Done in Jira';
export const PENDING_LINK_TEXT = 'By screen →';

/** The lead of the error of each block: the catalog text of the error follows, and "Try again". */
export const INDICATORS_FAILED_LEAD = "Couldn't load the indicators.";
export const STATUS_FAILED_LEAD = "Couldn't load the documentation by status.";
export const PENDING_FAILED_LEAD = "Couldn't load the screens with the most pending to-dos.";
export const ACTIVITY_FAILED_LEAD = "Couldn't load the recent activity.";

/** An application with only App (OnStart): the state that takes the place of the donut. */
export const EMPTY_TITLE = 'Nothing documented yet';
export function emptyText(application: string): string {
  return `Screens, variables and collections of ${application} appear here as they're documented.`;
}
export const EMPTY_ACTION = 'New screen';
export const NEW_SCREEN_HREF = '/screens?new=1';

/** Jira (S-31j): the saved copy of the to-dos when Jira does not answer. The figures always come from the local copy. */
export const STALE_TAG = 'Stale';
/** The caption of the card with Jira unavailable; the date of the copy is in the banner under the row (S-31j). */
export const JIRA_UNAVAILABLE_CAPTION = 'Jira unavailable · last saved copy';
export const JIRA_UNAVAILABLE_NEVER_CAPTION = 'Jira unavailable · never synced';
export const JIRA_NOTICE_LEAD = "Jira isn't responding.";
export const NEVER_SYNCED = 'Never synced';
/** Said to screen readers before the date of the second line of the card ("Last synced 2026-10-05 08:40"); the line itself
 *  shows a clock and the date, so it fits one line of the narrowest card. */
export const LAST_SYNCED_LABEL = 'Last synced';
/** The banner of S-31j; without a date (nothing was ever synchronized) the second sentence leaves it out. */
export function jiraNoticeText(date: string | null): string {
  return date === null
    ? 'To-do counts come from the saved copy.'
    : `To-do counts come from the copy saved on ${date}.`;
}
