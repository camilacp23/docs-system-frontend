// focusFirstInvalid: after a failed submit, moves the focus to the first field marked invalid (WCAG 3.3.1), so a
// keyboard or screen reader user lands on the error. A radio group (aria-invalid on the group) focuses its
// checked option.
export function focusFirstInvalid(container: HTMLElement | null): void {
  const invalid = container?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!invalid) return;
  if (invalid.getAttribute('role') === 'radiogroup') {
    invalid.querySelector<HTMLElement>('input:checked, input')?.focus();
    return;
  }
  invalid.focus();
}
