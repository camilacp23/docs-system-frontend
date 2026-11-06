// fieldStyles: border states shared by TextField, Select and Textarea.
// 2 px border at rest; a 1 px inset outline of the same color makes it one 3 px border (no gap, no second ring).
// Default: neutral; hover: accent 2 px; focus: accent 3 px; invalid: danger 3 px, also while focused.

/** Classes for the border of a form control according to its validity. */
export function fieldBorderClass(invalid: boolean): string {
  return invalid
    ? 'border-danger outline-1 -outline-offset-1 outline-danger'
    : 'border-border-control enabled:hover:border-border-control-hover focus:border-accent focus-visible:outline-1 focus-visible:-outline-offset-1';
}
