// PasswordField: TextField whose content can be revealed with an accessible eye button.
// Props: the same as TextField except `type`, plus `revealKey` (a number: each time it changes to a new value the text is shown, for a
// password the page just generated and the person has to read). The toggle is a real button (keyboard and screen-reader
// friendly) wired to the input with aria-controls; its aria-label (Show password / Hide password) is the accessible name.
import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';

import { cx, ICON_STROKE_WIDTH } from './cx';
import { TextField } from './TextField';
import type { TextFieldProps } from './TextField';

export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'mono'> & { revealKey?: number };

export function PasswordField({ id, className, revealKey = 0, ...rest }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState(revealKey);
  // A new `revealKey` shows the text (adjusting the state while rendering is the documented pattern for this).
  if (revealKey !== revealed) {
    setRevealed(revealKey);
    setVisible(true);
  }

  return (
    <div className="relative">
      <TextField
        {...rest}
        id={inputId}
        type={visible ? 'text' : 'password'}
        className={cx('pr-11', className)}
      />
      <button
        type="button"
        aria-controls={inputId}
        aria-label={visible ? 'Hide password' : 'Show password'}
        disabled={rest.disabled}
        onClick={() => {
          setVisible((current) => !current);
        }}
        className="absolute inset-y-0 right-2 my-auto flex size-8 items-center justify-center rounded-chip text-ink-500 hover:text-accent-ink disabled:opacity-45"
      >
        {visible ? (
          <EyeOff size={18} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        ) : (
          <Eye size={18} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
