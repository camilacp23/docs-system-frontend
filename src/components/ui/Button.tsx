// Button: the only action control of the design system (SDD Table 54).
// Props: variant ('primary' gradient | 'secondary' | 'ghost' | 'danger', default 'secondary'),
// size ('sm' 30 px | 'md' 36 px | 'lg' 40 px | 'xl' 44 px, default 'md'), loading (shows a spinner, sets aria-busy and
// ignores clicks without losing focus), fullWidth, iconLeft (decorative icon), plus every native button prop.
// `disabled` removes the button from the tab order and shows the flat disabled style (opacity .45).
import type { ComponentProps, MouseEvent, ReactNode } from 'react';

import { BUTTON_BASE, BUTTON_SIZE_CLASS, BUTTON_VARIANT_CLASS } from './buttonStyles';
import type { ButtonSize, ButtonVariant } from './buttonStyles';
import { cx } from './cx';
import { Spinner } from './Spinner';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
}

// Flat disabled look of the Figma frames (S-01c, S-44): grey fill, muted text, 45 % opacity.
const DISABLED_CLASS =
  'disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-disabled-bg disabled:bg-none disabled:text-disabled-ink disabled:opacity-45 disabled:shadow-button';

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  fullWidth = false,
  iconLeft,
  type = 'button',
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      // Keeps the button focusable (unlike `disabled`) while blocking clicks and implicit form submits.
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...rest}
      type={type}
      aria-busy={loading || undefined}
      onClick={handleClick}
      className={cx(
        BUTTON_BASE,
        BUTTON_SIZE_CLASS[size],
        BUTTON_VARIANT_CLASS[variant],
        DISABLED_CLASS,
        fullWidth && 'w-full',
        loading && 'cursor-progress',
        className,
      )}
    >
      {loading ? <Spinner size="sm" /> : iconLeft}
      {children}
    </button>
  );
}
