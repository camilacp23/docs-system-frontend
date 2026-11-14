// userLabels: the words and formats of the user pages (S-02 to S-06b): role names and descriptions, status names and
// the dates of the table ("2026-10-05 08:02", "2026-09-20", "Never" for a user who never signed in).
import type { components } from '../../api/schema';
import { ROLE_LABEL } from '../../app/router/routes';
import { formatTimestamp } from '../variables/variableLabels';

export type User = components['schemas']['User'];
export type UserRole = components['schemas']['UserRole'];
export type UserStatus = components['schemas']['UserStatus'];

export { ROLE_LABEL };

export const ROLES: readonly UserRole[] = ['ADMINISTRATOR', 'DEVELOPER', 'READER'];

/** The line under each role in the role choices (frames S-03 and S-05). */
export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  ADMINISTRATOR: 'Manages users and applications; approves documentation.',
  DEVELOPER: 'Creates and edits documentation; creates Jira tickets.',
  READER: 'Reads documentation and published reports; comments on screens.',
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

export function formatLastSignIn(iso: string | null): string {
  return iso === null ? 'Never' : formatTimestamp(iso);
}

/** "2026-09-20" in the local time of the browser. */
export function formatDate(iso: string): string {
  return formatTimestamp(iso).slice(0, 10);
}
