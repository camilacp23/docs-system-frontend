// PasswordField: TextField whose content can be revealed with an accessible Show / Hide button.
// Props: the same as TextField except `type`. The toggle is a real button (keyboard and screen-reader
// friendly) wired to the input with aria-controls; its visible text is the accessible name.
import { useId, useState } from 'react';

import { cx } from './cx';
import { TextField } from './TextField';
import type { TextFieldProps } from './TextField';

export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'mono'>;

export function PasswordField({ id, className, ...rest }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <TextField
        {...rest}
        id={inputId}
        type={visible ? 'text' : 'password'}
        className={cx('pr-14', className)}
      />
      <button
        type="button"
        aria-controls={inputId}
        disabled={rest.disabled}
        onClick={() => {
          setVisible((current) => !current);
        }}
        className="absolute inset-y-0 right-2.5 flex items-center rounded-chip px-1 text-label font-semibold text-primary disabled:opacity-45"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
