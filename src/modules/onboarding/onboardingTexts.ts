// onboardingTexts: every text of /onboarding (S-38a to S-38c and the derived ones, DESIGN_REFERENCE section 9). Nothing here
// is a figure: the numbers, the platform and the names come from the summary and the application, never from the frame.

export const ONBOARDING_TITLE = 'Onboarding';
export const STEPPER_LABEL = 'Onboarding steps';
export const STEPPER_HEADING = 'Your path';
export const PROGRESS_LABEL = 'Progress';
export const BACK_LABEL = 'Back';
export const DASHBOARD_LABEL = 'Go to Dashboard';
export const LOADING_LABEL = 'Loading the onboarding';
export const DONE_HINT = 'completed';

export function subtitleOf(applicationName: string): string {
  return `For developers new to the team: how ${applicationName} is built, read from its own documentation.`;
}

export function pageTitleOf(applicationName: string): string {
  return `${ONBOARDING_TITLE} · ${applicationName}`;
}

export function stepCounterOf(step: number, total: number): string {
  return `Step ${step} of ${total}`;
}

export function nextLabelOf(label: string): string {
  return `Next: ${label}`;
}

export function progressTextOf(done: number, total: number): string {
  return `${done} of ${total} steps completed`;
}

export function kickerOf(step: number, kicker: string): string {
  return `Step ${step} · ${kicker}`;
}

// The titles and the lead of each step. Steps 1 to 3 are the text of the frames; 4 and 5 are derived (D-146).
export function overviewTitleOf(applicationName: string): string {
  return `What ${applicationName} is and how it is documented`;
}

export function overviewLeadOf(applicationName: string, platform: string): string {
  return `${applicationName} is a ${platform} application. Its documentation lives here: one page per screen with a seven-field template, plus its variables, collections and components, linked so you can follow any value from where it is created to where it is used.`;
}

export function appStartTitleOf(applicationName: string): string {
  return `How ${applicationName} starts`;
}

export const APP_START_LEAD =
  'Before any screen opens, App (OnStart) prepares the data the screens share. Read it first: most global variables are created here.';
export const KEY_SCREENS_TITLE = 'Read these screens first';
export function keyScreensLeadOf(applicationName: string): string {
  return `The most connected screens of ${applicationName}, in suggested reading order: the closest to App (OnStart) first. Each one links variables, collections and components, so they explain most of the app.`;
}
export const CRITICAL_VARIABLES_TITLE = 'Variables to know first';
export const CRITICAL_VARIABLES_LEAD =
  'The global variables used by the most screens. Understand these first: a change to one of them reaches every screen that reads or writes it.';
export const TOP_COMPONENTS_TITLE = 'Components that use the most data';
export const TOP_COMPONENTS_LEAD =
  'The components that use the most variables and collections. They carry much of the logic of the app: open the screen that contains one to see how it is built.';

/** The title and the lead of a step, which the page draws also while the data loads (D-146). */
export function stepFrameOf(
  step: number,
  applicationName: string,
  platform: string,
): { title: string; lead: string } {
  switch (step) {
    case 2:
      return { title: appStartTitleOf(applicationName), lead: APP_START_LEAD };
    case 3:
      return { title: KEY_SCREENS_TITLE, lead: keyScreensLeadOf(applicationName) };
    case 4:
      return { title: CRITICAL_VARIABLES_TITLE, lead: CRITICAL_VARIABLES_LEAD };
    case 5:
      return { title: TOP_COMPONENTS_TITLE, lead: TOP_COMPONENTS_LEAD };
    default:
      return {
        title: overviewTitleOf(applicationName),
        lead: overviewLeadOf(applicationName, platform),
      };
  }
}

// Step 1.
export const PROGRESS_CARD_TITLE = 'Documentation progress';
export function approvedTextOf(percentText: string): string {
  return `${percentText}% approved`;
}
export const APPROVED_NOTE =
  'Approved screens are the official reference; others may still change.';

// Step 2.
export const NOT_DOCUMENTED_TEXT = 'Not documented yet.';
export const DIRECT_SCREENS_TITLE = 'Key screens reached directly from App (OnStart)';

// Step 3.
export const COLUMN_NUMBER = '#';
export const COLUMN_SCREEN = 'Screen';
export const COLUMN_STATUS = 'Status';
export const COLUMN_CONNECTIONS = 'Connections';
export const KEY_SCREENS_LIST_LABEL = 'Key screens in reading order';
export const OPEN_LABEL = 'Open';
export const MIRO_LABEL = 'Miro diagram';
export function openNameOf(name: string): string {
  return `Open ${name}`;
}
/** The word that follows the number of connections for a screen reader (the column header names it on screen). */
export function connectionsWordOf(count: number): string {
  return count === 1 ? 'connection' : 'connections';
}

// Step 4.
export const VARIABLES_LIST_LABEL = 'Critical variables by use';
export const NO_ORIGIN_TEXT = 'No origin screen';
export const CREATED_IN_LABEL = 'Created in';
export function usedByOf(count: number): string {
  return count === 1 ? 'Used by 1 screen' : `Used by ${count} screens`;
}

// Step 5.
export const COMPONENTS_LIST_LABEL = 'Components by use';
export const IN_SCREEN_LABEL = 'in';
export function usesOf(count: number): string {
  return count === 1 ? 'Uses 1 variable or collection' : `Uses ${count} variables and collections`;
}

// Empty lists (an application with only App (OnStart)).
export const EMPTY_KEY_SCREENS_TITLE = 'No key screens yet';
export const EMPTY_KEY_SCREENS_TEXT = 'Screens appear here once they are documented and linked.';
export const EMPTY_VARIABLES_TITLE = 'No global variables yet';
export const EMPTY_VARIABLES_TEXT = 'Global variables appear here once screens read or write them.';
export const EMPTY_COMPONENTS_TITLE = 'No components use variables or collections yet';
export const EMPTY_COMPONENTS_TEXT =
  'Components appear here once they use a variable or a collection.';

// The fixed tips of the frames, kept as drawn (S-38a, S-38b, S-38c). Steps 4 and 5 have none: no frame draws them.
export interface Tip {
  title: string;
  /** The text; the words in `mono` are drawn in IBM Plex Mono. */
  text: string;
  mono?: readonly string[];
}

export const TIPS: Readonly<Record<number, readonly [Tip, Tip]>> = {
  1: [
    {
      title: 'How to read a screen',
      text: 'Start with Working process, then Data model. OnStart shows what runs when the screen opens.',
      mono: ['OnStart'],
    },
    {
      title: 'Status tags',
      text: 'Approved = reviewed by an administrator. In progress or Draft = still being written.',
    },
  ],
  2: [
    {
      title: 'Global vs context',
      text: 'Variables created here use Set and are global. Context variables use UpdateContext and live in one screen.',
      mono: ['Set', 'UpdateContext'],
    },
    {
      title: 'Before you change it',
      text: 'Check who reads a variable on its detail page or on the map: OnStart changes affect every screen.',
      mono: ['OnStart'],
    },
  ],
  3: [
    {
      title: 'Reading tip',
      text: "Open each screen's dependency map to see what it reads and writes.",
    },
    {
      title: 'Not approved yet',
      text: 'Screens In review or Draft may change; check their comments before relying on them.',
    },
  ],
};

// The column on the right.
export const EXPLORE_TITLE = 'Explore while you read';
export const EXPLORE_APP_START = 'Open App (OnStart)';
export const EXPLORE_MIRO = 'Miro diagram';
export const EXPLORE_MAP = 'See it on the map';
export const EXPLORE_SEARCH = 'Search the documentation';
export function glanceTitleOf(applicationName: string): string {
  return `${applicationName} at a glance`;
}
