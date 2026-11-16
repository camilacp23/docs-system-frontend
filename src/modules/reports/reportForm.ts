// reportForm: the generate-report form (S-34, FR-22) as plain data, and the rules that make an invalid request impossible
// (D-115) before the API is asked.
// Types: ReportForm. Constants: EMPTY_FORM, ELEMENT_OPTIONS (Include chips, in the order of the frame), STATUS_OPTIONS,
// TITLE_MAX (200), SCREEN_LIMIT (500).
// Functions:
//   appliesToScreens(form)  Screens or Components is included: only then do the screen selection and the status filter apply
//                           (the API answers 400 `notApplicable` otherwise), so the form disables them and sends neither.
//   validateForm(form)      the client checks, one text per field: the title is not blank (the API pattern is `\S`) and at
//                           least one thing is included (an element type, or the status summary: an empty `elementTypes` is
//                           valid only with `includeStatusSummary`, D-115). Nothing else needs a check: the rest cannot be wrong.
//   buildRequest(form, applicationId)  the ReportRequest: the title as typed (the API stores it as sent), the element types
//                           in a fixed order, `screenIds` and `documentationStatus` only when chosen AND applicable (absent
//                           = all), both include flags always written (the contract's defaults, so the stored parameters say it).
//   summaryText(form)       the line of the footer of S-34: "PDF · Screens, Variables · all statuses · with dependencies".
//   toggleElement / toggleStatus / chooseScreens  the changes of the form that keep it valid: taking off the last of
//                           Screens and Components clears the screen selection and the status filter.
import { STATUS_FILTER_OPTIONS } from '../screens/screenLabels';
import type { ApiDocumentationStatus } from '../screens/screenTypes';

import type { ReportFormat, ReportRequest } from './reportModel';
import {
  FORMAT_LABEL,
  SUMMARY_ALL_STATUSES,
  SUMMARY_NOTHING,
  SUMMARY_STATUS_SUMMARY,
  SUMMARY_WITH_DEPENDENCIES,
  SUMMARY_WILL_PUBLISH,
  screensSummary,
  TITLE_REQUIRED_TEXT,
  INCLUDE_REQUIRED_TEXT,
} from './reportTexts';

export type ElementKind = 'SCREEN' | 'VARIABLE' | 'COLLECTION' | 'COMPONENT';

export interface PickedScreen {
  id: number;
  name: string;
}

export interface ReportForm {
  title: string;
  format: ReportFormat;
  elementTypes: ElementKind[];
  includeStatusSummary: boolean;
  includeDependencies: boolean;
  documentationStatus: ApiDocumentationStatus[];
  screens: PickedScreen[];
  publish: boolean;
}

export const TITLE_MAX = 200;
export const SCREEN_LIMIT = 500;

export const EMPTY_FORM: ReportForm = {
  title: '',
  format: 'PDF',
  elementTypes: [],
  includeStatusSummary: false,
  includeDependencies: false,
  documentationStatus: [],
  screens: [],
  publish: false,
};

/** The Include chips, in the order of the frame; the order of `elementTypes` in the request is this one too. */
export const ELEMENT_OPTIONS: ReadonlyArray<{ value: ElementKind; label: string }> = [
  { value: 'SCREEN', label: 'Screens' },
  { value: 'VARIABLE', label: 'Variables' },
  { value: 'COLLECTION', label: 'Collections' },
  { value: 'COMPONENT', label: 'Components' },
];

export const STATUS_OPTIONS = STATUS_FILTER_OPTIONS;

export function appliesToScreens(form: Pick<ReportForm, 'elementTypes'>): boolean {
  return form.elementTypes.includes('SCREEN') || form.elementTypes.includes('COMPONENT');
}

export interface ReportFormErrors {
  title?: string;
  include?: string;
}

export function validateForm(form: ReportForm): ReportFormErrors {
  const errors: ReportFormErrors = {};
  if (form.title.trim() === '') errors.title = TITLE_REQUIRED_TEXT;
  if (form.elementTypes.length === 0 && !form.includeStatusSummary) {
    errors.include = INCLUDE_REQUIRED_TEXT;
  }
  return errors;
}

export function hasErrors(errors: ReportFormErrors): boolean {
  return errors.title !== undefined || errors.include !== undefined;
}

function sortedTypes(types: readonly ElementKind[]): ElementKind[] {
  return ELEMENT_OPTIONS.map((option) => option.value).filter((value) => types.includes(value));
}

function sortedStatuses(statuses: readonly ApiDocumentationStatus[]): ApiDocumentationStatus[] {
  return STATUS_OPTIONS.map((option) => option.value).filter((value) => statuses.includes(value));
}

export function buildRequest(form: ReportForm, applicationId: number): ReportRequest {
  const applies = appliesToScreens(form);
  const statuses = sortedStatuses(form.documentationStatus);
  return {
    applicationId,
    title: form.title,
    scope: {
      elementTypes: sortedTypes(form.elementTypes),
      includeStatusSummary: form.includeStatusSummary,
      includeDependencies: form.includeDependencies,
      ...(applies &&
        form.screens.length > 0 && { screenIds: form.screens.map((screen) => screen.id) }),
      ...(applies && statuses.length > 0 && { documentationStatus: statuses }),
    },
    publish: form.publish,
  };
}

export function summaryText(form: ReportForm): string {
  const labels = ELEMENT_OPTIONS.filter((option) => form.elementTypes.includes(option.value)).map(
    (option) => option.label,
  );
  if (form.includeStatusSummary) labels.push(SUMMARY_STATUS_SUMMARY);
  const parts: string[] = [
    FORMAT_LABEL[form.format],
    labels.length > 0 ? labels.join(', ') : SUMMARY_NOTHING,
  ];
  if (appliesToScreens(form)) {
    const statuses = sortedStatuses(form.documentationStatus);
    parts.push(
      statuses.length === 0
        ? SUMMARY_ALL_STATUSES
        : STATUS_OPTIONS.filter((option) => statuses.includes(option.value))
            .map((option) => option.label)
            .join(', '),
    );
    if (form.screens.length > 0) parts.push(screensSummary(form.screens.length));
  }
  if (form.includeDependencies) parts.push(SUMMARY_WITH_DEPENDENCIES);
  if (form.publish) parts.push(SUMMARY_WILL_PUBLISH);
  return parts.join(' · ');
}

/** Turns one element type on or off; without Screens and Components the screen selection and the status filter go. */
export function toggleElement(form: ReportForm, kind: ElementKind, on: boolean): ReportForm {
  const elementTypes = sortedTypes(
    on ? [...form.elementTypes, kind] : form.elementTypes.filter((k) => k !== kind),
  );
  const next = { ...form, elementTypes };
  return appliesToScreens(next) ? next : { ...next, documentationStatus: [], screens: [] };
}

export function toggleStatus(
  form: ReportForm,
  status: ApiDocumentationStatus,
  on: boolean,
): ReportForm {
  return {
    ...form,
    documentationStatus: sortedStatuses(
      on
        ? [...form.documentationStatus, status]
        : form.documentationStatus.filter((s) => s !== status),
    ),
  };
}
