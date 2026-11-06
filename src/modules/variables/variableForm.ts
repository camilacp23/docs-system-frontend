// variableForm: the form model of a variable, shared by the creation modal (S-12a) and the edit page (S-12b).
//   emptyValues(), valuesFromVariable(variable)  -> the initial form values
//   toVariableWrite(values)                      -> the COMPLETE representation the API expects (POST and PUT)
//   validateVariable(values)                     -> the errors of the rules the CONTRACT declares for the fields
//                                                   (required, length, pattern, at least one environment); every
//                                                   other rule is decided by the server and shown on its field.
import { getRuleMessage } from '../../api/messages';
import {
  emptyEnvironments,
  environmentsFromDetails,
  environmentsToWrite,
  validateEnvironments,
  type EnvironmentValues,
} from '../shared/environmentForm';

import type {
  DataType,
  Environment,
  ScreenSummary,
  Variable,
  VariableScope,
  VariableWrite,
} from './variableTypes';

export interface VariableFormValues {
  name: string;
  dataType: DataType | '';
  scope: VariableScope;
  /** Id of the origin screen as text; '' = none (the variable is then untraced). */
  originScreenId: string;
  environments: EnvironmentValues;
  description: string;
}

/** Limits and pattern of VariableWrite in the contract. */
export const NAME_MAX_LENGTH = 150;
export const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const DESCRIPTION_MAX_LENGTH = 4000;

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
    // A new variable starts with no environment chosen: the user decides where it exists.
    environments: emptyEnvironments(false),
    description: '',
  };
}

export function valuesFromVariable(variable: Variable): VariableFormValues {
  return {
    name: variable.name,
    dataType: variable.dataType,
    scope: variable.scope,
    originScreenId: variable.originScreen === null ? '' : String(variable.originScreen.id),
    environments: environmentsFromDetails(variable.environmentDetails),
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
    environments: environmentsToWrite(values.environments),
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

  const environments = validateEnvironments(values.environments);
  if (environments.group) errors.environments = environments.group;
  if (environments.rows) errors.environmentRows = environments.rows;
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
