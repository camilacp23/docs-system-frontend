// The five documentation statuses (SDD Table 54): fixed identifier and label, shared by StatusTag, charts and filters.
export const DOCUMENTATION_STATUSES = [
  'undocumented',
  'draft',
  'in-progress',
  'in-review',
  'approved',
] as const;

export type DocumentationStatus = (typeof DOCUMENTATION_STATUSES)[number];

export const DOCUMENTATION_STATUS_LABEL: Record<DocumentationStatus, string> = {
  undocumented: 'Undocumented',
  draft: 'Draft',
  'in-progress': 'In progress',
  'in-review': 'In review',
  approved: 'Approved',
};
