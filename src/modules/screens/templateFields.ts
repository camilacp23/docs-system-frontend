// templateFields: the seven fields of the standard documentation template (SRS Table 28), in template order.
// TEMPLATE_FIELDS: { key (the name in the contract's ScreenTemplate), label (what the interface shows), mono (the
// text is Power Fx: OnStart is drawn in IBM Plex Mono) }.
// templateProgress(template) -> number of fields with content: a field has content when it is not null and not
// empty after trimming spaces (D-81, the same rule as the server).
import type { ScreenTemplate } from './screenTypes';

export type TemplateKey = keyof ScreenTemplate;

export interface TemplateField {
  key: TemplateKey;
  label: string;
  mono: boolean;
}

export const TEMPLATE_FIELDS: readonly TemplateField[] = [
  { key: 'onStart', label: 'OnStart', mono: true },
  { key: 'workingProcess', label: 'Working process', mono: false },
  { key: 'architecture', label: 'Architecture', mono: false },
  { key: 'dataModel', label: 'Data model', mono: false },
  { key: 'requirements', label: 'Requirements', mono: false },
  { key: 'knownIssues', label: 'Known issues', mono: false },
  { key: 'risks', label: 'Risks', mono: false },
];

export function hasContent(text: string | null | undefined): text is string {
  return typeof text === 'string' && text.trim() !== '';
}

export function templateProgress(template: ScreenTemplate): number {
  return TEMPLATE_FIELDS.filter((field) => hasContent(template[field.key])).length;
}
