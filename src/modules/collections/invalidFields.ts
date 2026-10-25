// invalidFields: the controls of a form that are marked invalid, for the "N fields need attention." summary of a long
// form (S-42, Table 58). invalidFields(form) -> [{ label, element }] in page order, one per control with
// aria-invalid="true"; the label is the accessible name the control already has (its aria-label or its <label>,
// without the required mark). The summary links call element.focus().
export interface InvalidField {
  label: string;
  element: HTMLElement;
}

function labelOf(element: HTMLElement): string {
  const own = element.getAttribute('aria-label');
  if (own !== null && own !== '') return own;
  const fromLabel = (element as HTMLInputElement).labels?.[0]?.textContent ?? '';
  return fromLabel.replace(/\*+\s*$/, '').trim() || 'This field';
}

export function invalidFields(form: HTMLElement | null): InvalidField[] {
  if (form === null) return [];
  return [...form.querySelectorAll<HTMLElement>('[aria-invalid="true"]')].map((element) => ({
    label: labelOf(element),
    element,
  }));
}
