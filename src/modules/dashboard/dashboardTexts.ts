// dashboardTexts: the words of the dashboard that are not built from data (S-31, S-31r, S-31j). The ones of the frames
// are marked; the rest are derived and are listed in DESIGN_REFERENCE §9, pending confirmation in design.
export const REFRESH_LABEL = 'Refresh'; // S-31

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
