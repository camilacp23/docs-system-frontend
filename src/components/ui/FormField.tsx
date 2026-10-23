// FormField: label + control + help / error text, wired for accessibility.
// Props: label, htmlFor (optional; an id is generated when omitted), required (danger "*" and aria-required),
// help (neutral hint), error (danger message with icon; sets aria-invalid), children (render function that
// receives { id, invalid, 'aria-describedby', 'aria-required' } to spread on the control).
// Usage: <FormField label="Email" required error={e}>{(c) => <TextField type="email" {...c} />}</FormField>
import { CircleAlert } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';

import { cx, ICON_STROKE_WIDTH } from './cx';

export interface FormFieldControlProps {
  id: string;
  invalid: boolean;
  'aria-describedby'?: string;
  'aria-required'?: true;
}

export interface FormFieldProps {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (control: FormFieldControlProps) => ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required,
  help,
  error,
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const helpId = `${controlId}-help`;
  const errorId = `${controlId}-error`;

  const hasError = error !== undefined && error !== null && error !== false && error !== '';
  const hasHelp = help !== undefined && help !== null && help !== false && help !== '';
  const describedBy = [hasHelp ? helpId : null, hasError ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cx('flex min-w-55 flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className="flex gap-0.5 text-label font-medium text-ink-700">
        <span>{label}</span>
        {required && (
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        )}
      </label>
      {children({
        id: controlId,
        invalid: hasError,
        'aria-describedby': describedBy || undefined,
        'aria-required': required ? true : undefined,
      })}
      {hasHelp && (
        <p id={helpId} className="text-small text-ink-500">
          {help}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="flex items-start gap-1 text-small text-danger">
          <CircleAlert
            aria-hidden="true"
            size={14}
            strokeWidth={ICON_STROKE_WIDTH}
            className="mt-px shrink-0"
          />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
