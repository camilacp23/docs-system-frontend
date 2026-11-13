// applicationLabels: the words and formats of the application pages (S-07 to S-09b).
import type { components } from '../../api/schema';
import { formatTimestamp } from '../variables/variableLabels';

export type Application = components['schemas']['Application'];
export type ApplicationStatus = components['schemas']['ApplicationStatus'];

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
};

/** The department's default Jira project, used when an application has no key of its own (contract: TECHEA). */
export const DEFAULT_JIRA_PROJECT = 'TECHEA';

/** "APPB", or "TECHEA (default)" when the application uses the department project. */
export function jiraProjectText(key: string | null | undefined): string {
  return key ? key : `${DEFAULT_JIRA_PROJECT} (default)`;
}

export { formatTimestamp };
