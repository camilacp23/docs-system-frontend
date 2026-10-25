// variableForm: the form model of a variable, shared by the creation modal (S-12a) and the edit page (S-12b).
//   emptyValues(), valuesFromVariable(variable)  -> the initial form values
//   toVariableWrite(values)                      -> the COMPLETE representation the API expects (POST and PUT)
//   validateVariable(values)                     -> the errors of the rules the CONTRACT declares for the fields
//                                                   (required, length, pattern, at least one environment); every
//                                                   other rule is decided by the server and shown on its field.
import { getRuleMessage } from '../../api/messages';

import { ENVIRONMENTS } from './variableLabels';
import type {
  DataType,
  Environment,
  ScreenSummary,
  Variable,
  VariableScope,
  VariableWrite,
} from './variableTypes';

export interface EnvironmentValue {
  enabled: boolean;
  notes: string;
}

export interface VariableFormValues {
  name: string;
  dataType: DataType | '';
  scope: VariableScope;
  /** Id of the origin screen as text; '' = none (the variable is then untraced). */
  originScreenId: string;
  environments: Record<Environment, EnvironmentValue>;
  description: string;
}

/** Limits and pattern of VariableWrite in the contract. */
export const NAME_MAX_LENGTH = 150;
export const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const DESCRIPTION_MAX_LENGTH = 4000;
export const NOTES_MAX_LENGTH = 2000;

export const FIELD_LABEL = {
  name: 'Name',
  dataType: 'Data type',
  scope: 'Scope',
  originScreenId: 'Origin screen',
  environments: 'Environments',
  description: 'Description',
  notes: 'Notes',
} as const;

export function emptyValues(): VariableFormValues {
  return {
    name: '',
    dataType: 'TEXT',
    scope: 'GLOBAL',
    originScreenId: '',
    environments: {
      DEV: { enabled: true, notes: '' },
      PROD: { enabled: false, notes: '' },
    },
    description: '',
  };
}

export function valuesFromVariable(variable: Variable): VariableFormValues {
  const byEnvironment = new Map(variable.environmentDetails.map((e) => [e.environment, e]));
  const entry = (environment: Environment): EnvironmentValue => {
    const found = byEnvironment.get(environment);
    return { enabled: found !== undefined, notes: found?.notes ?? '' };
  };
  return {
    name: variable.name,
    dataType: variable.dataType,
    scope: variable.scope,
    originScreenId: variable.originScreen === null ? '' : String(variable.originScreen.id),
    environments: { DEV: entry('DEV'), PROD: entry('PROD') },
    description: variable.description ?? '',
  };
}

/** The complete write body. An empty text is sent as null, never as an empty string. */
export function toVariableWrite(values: VariableFormValues): VariableWrite {
  return {
    name: values.name,
    // validateVariable guarantees a data type before this is sent.
    dataType: values.dataType as DataType,
    scope: values.scope,
    description: values.description === '' ? null : values.description,
    originScreenId: values.originScreenId === '' ? null : Number(values.originScreenId),
    environments: ENVIRONMENTS.filter((e) => values.environments[e].enabled).map((environment) => ({
      environment,
      notes:
        values.environments[environment].notes === ''
          ? null
          : values.environments[environment].notes,
    })),
  };
}

export interface VariableFormErrors {
  name?: string;
  dataType?: string;
  scope?: string;
  originScreenId?: string;
  /** The environments group (none chosen). */
  environments?: string;
  /** One message per environment row (notes too long, repeated environment). */
  environmentRows?: Partial<Record<Environment, string>>;
  description?: string;
  /** A message for the whole form (a server error that points to no field). */
  form?: string;
}

export function hasErrors(errors: VariableFormErrors): boolean {
  const { environmentRows, ...rest } = errors;
  return (
    Object.values(rest).some((value) => Boolean(value)) ||
    (environmentRows !== undefined && Object.keys(environmentRows).length > 0)
  );
}

export function validateVariable(values: VariableFormValues): VariableFormErrors {
  const errors: VariableFormErrors = {};
  if (values.name === '') errors.name = getRuleMessage('required', FIELD_LABEL.name);
  else if (values.name.length > NAME_MAX_LENGTH)
    errors.name = getRuleMessage('maxLength', FIELD_LABEL.name);
  else if (!NAME_PATTERN.test(values.name))
    errors.name = getRuleMessage('pattern', FIELD_LABEL.name);

  if (values.dataType === '') errors.dataType = getRuleMessage('required', FIELD_LABEL.dataType);

  if (values.description.length > DESCRIPTION_MAX_LENGTH)
    errors.description = getRuleMessage('maxLength', FIELD_LABEL.description);

  const enabled = ENVIRONMENTS.filter((e) => values.environments[e].enabled);
  if (enabled.length === 0)
    errors.environments = getRuleMessage('minItems', FIELD_LABEL.environments);
  const rows: Partial<Record<Environment, string>> = {};
  for (const environment of enabled) {
    if (values.environments[environment].notes.length > NOTES_MAX_LENGTH)
      rows[environment] = getRuleMessage('maxLength', FIELD_LABEL.notes);
  }
  if (Object.keys(rows).length > 0) errors.environmentRows = rows;
  return errors;
}

/** True when the chosen origin screen is the reserved App (OnStart) screen. */
export function isAppScreen(screens: readonly ScreenSummary[], originScreenId: string): boolean {
  return screens.some((screen) => screen.isAppContext && String(screen.id) === originScreenId);
}

/**
 * The values after the scope changes. A context variable cannot originate in App (OnStart) (FR-05), so that
 * origin is cleared when the scope becomes CONTEXT; the form says why next to the field.
 */
export function withScope(
  values: VariableFormValues,
  scope: VariableScope,
  screens: readonly ScreenSummary[],
): VariableFormValues {
  const clearOrigin = scope === 'CONTEXT' && isAppScreen(screens, values.originScreenId);
  return { ...values, scope, originScreenId: clearOrigin ? '' : values.originScreenId };
}
