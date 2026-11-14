// RolePicker: the three roles as radio cards with what each one allows (frames S-03 and S-05). Native radio inputs,
// so the arrow keys, the focus and the screen readers work as a radio group.
// Props: name (radio group name), label (visible and accessible name of the group), value, onChange(role), required
// (danger "*"), error (message under the group; sets aria-invalid), disabled, currentRole (the role the user has
// now: that card says "Current role" so it is clear which choice changes nothing).
import { CircleAlert } from 'lucide-react';
import { useId } from 'react';

import { cx, ICON_STROKE_WIDTH } from '../../components/ui';

import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type UserRole } from './userLabels';

interface RolePickerProps {
  name: string;
  label: string;
  value: UserRole | '';
  onChange: (role: UserRole) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export function RolePicker({
  name,
  label,
  value,
  onChange,
  required = false,
  error,
  disabled = false,
}: RolePickerProps) {
  const labelId = useId();
  const errorId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="flex gap-0.5 text-label font-medium text-ink-700">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        )}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="flex flex-col gap-2"
      >
        {ROLES.map((role) => (
          <div
            key={role}
            className={cx(
              'relative flex items-start gap-3 rounded-control border-2 px-3.5 py-2.5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring',
              value === role ? 'border-accent bg-accent-soft' : 'border-border-subtle bg-surface',
              disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
            )}
          >
            <input
              id={`${name}-${role}`}
              type="radio"
              name={name}
              value={role}
              checked={value === role}
              disabled={disabled}
              onChange={() => {
                onChange(role);
              }}
              className="mt-1 size-4 shrink-0 accent-accent"
            />
            <label
              htmlFor={`${name}-${role}`}
              className="flex cursor-[inherit] flex-col after:absolute after:inset-0"
            >
              <span className="text-body-lg font-semibold text-ink-900">{ROLE_LABEL[role]}</span>
              <span className="text-small text-ink-500">{ROLE_DESCRIPTION[role]}</span>
            </label>
          </div>
        ))}
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-small text-danger">
          <CircleAlert
            aria-hidden="true"
            size={14}
            strokeWidth={ICON_STROKE_WIDTH}
            className="mt-px shrink-0"
          />
          {error}
        </p>
      )}
    </div>
  );
}
