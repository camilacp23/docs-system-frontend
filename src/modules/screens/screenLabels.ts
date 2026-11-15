// screenLabels: the words and mappings the screens pages use for the documentation status of the API.
// toTagStatus(status) -> the identifier of the StatusTag ('IN_PROGRESS' -> 'in-progress').
// STATUS_FILTER_OPTIONS: the five statuses in the order of SDD Table 54, with the label of the tag.
import { DOCUMENTATION_STATUS_LABEL, type DocumentationStatus } from '../../components/ui';

import type { ApiDocumentationStatus } from './screenTypes';

const API_STATUSES: readonly ApiDocumentationStatus[] = [
  'UNDOCUMENTED',
  'DRAFT',
  'IN_PROGRESS',
  'IN_REVIEW',
  'APPROVED',
];

export function isApiStatus(value: string | null): value is ApiDocumentationStatus {
  return API_STATUSES.some((status) => status === value);
}

export function toTagStatus(status: ApiDocumentationStatus): DocumentationStatus {
  return status.toLowerCase().replace('_', '-') as DocumentationStatus;
}

export const STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: ApiDocumentationStatus;
  label: string;
}> = API_STATUSES.map((value) => ({
  value,
  label: DOCUMENTATION_STATUS_LABEL[toTagStatus(value)],
}));

/** The reserved tag of the screen where the application starts (S-18). */
export const RESERVED_LABEL = 'Reserved';
