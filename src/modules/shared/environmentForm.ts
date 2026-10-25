// environmentForm: the form model of the environments (DEV, PROD) of a variable or a collection, with the notes of
// each one (contract schema EnvironmentPresence; FR-07).
//   emptyEnvironments()                  -> DEV on, PROD off, no notes
//   environmentsFromDetails(details)     -> the form values of `environmentDetails`
//   environmentsToWrite(values)          -> the `environments` array of the write body (empty notes are sent as null)
//   validateEnvironments(values)         -> { group, rows }: none chosen / notes too long, by the contract's rules
import { getRuleMessage } from '../../api/messages';
import type { components } from '../../api/schema';

type Environment = components['schemas']['Environment'];
type EnvironmentPresence = components['schemas']['EnvironmentPresence'];

export const ENVIRONMENT_LIST: readonly Environment[] = ['DEV', 'PROD'];
export const NOTES_MAX_LENGTH = 2000;
export const ENVIRONMENTS_LABEL = 'Environments';
export const NOTES_LABEL = 'Notes';

export interface EnvironmentValue {
  enabled: boolean;
  notes: string;
}

export type EnvironmentValues = Record<Environment, EnvironmentValue>;

export interface EnvironmentErrors {
  /** The group: no environment chosen. */
  group?: string;
  /** One message per environment row (notes too long, repeated environment). */
  rows?: Partial<Record<Environment, string>>;
}

export function emptyEnvironments(): EnvironmentValues {
  return { DEV: { enabled: true, notes: '' }, PROD: { enabled: false, notes: '' } };
}

export function environmentsFromDetails(
  details: readonly EnvironmentPresence[],
): EnvironmentValues {
  const byEnvironment = new Map(details.map((e) => [e.environment, e]));
  const entry = (environment: Environment): EnvironmentValue => {
    const found = byEnvironment.get(environment);
    return { enabled: found !== undefined, notes: found?.notes ?? '' };
  };
  return { DEV: entry('DEV'), PROD: entry('PROD') };
}

export function environmentsToWrite(values: EnvironmentValues): EnvironmentPresence[] {
  return ENVIRONMENT_LIST.filter((e) => values[e].enabled).map((environment) => ({
    environment,
    notes: values[environment].notes === '' ? null : values[environment].notes,
  }));
}

export function validateEnvironments(values: EnvironmentValues): EnvironmentErrors {
  const errors: EnvironmentErrors = {};
  const enabled = ENVIRONMENT_LIST.filter((e) => values[e].enabled);
  if (enabled.length === 0) errors.group = getRuleMessage('minItems', ENVIRONMENTS_LABEL);
  const rows: Partial<Record<Environment, string>> = {};
  for (const environment of enabled) {
    if (values[environment].notes.length > NOTES_MAX_LENGTH)
      rows[environment] = getRuleMessage('maxLength', NOTES_LABEL);
  }
  if (Object.keys(rows).length > 0) errors.rows = rows;
  return errors;
}
