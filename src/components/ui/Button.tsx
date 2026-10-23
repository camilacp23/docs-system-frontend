// Button: the only action control of the design system (SDD Table 54).
// Props: variant ('primary' gradient | 'secondary' | 'ghost' | 'danger', default 'secondary'),
// size ('sm' 30 px | 'md' 36 px | 'lg' 40 px, default 'md'), loading (shows a spinner, sets aria-busy and
// ignores clicks without losing focus), fullWidth, iconLeft (decorative icon), plus every native button prop.
// `disabled` removes the button from the tab order and shows the flat disabled style (opacity .45).
import type { ComponentProps, MouseEvent, ReactNode } from 'react';

import { cx } from './cx';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
}

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control border text-button font-bold';

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-7.5 px-3',
  md: 'h-9 px-3.5',
  lg: 'h-10 px-3.5',
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-(image:--gradient-primary) text-on-primary shadow-primary-button enabled:hover:bg-(image:--gradient-primary-hover) enabled:active:bg-(image:--gradient-primary-active)',
  secondary:
    'border-border bg-surface text-ink-900 shadow-card enabled:hover:bg-control-hover enabled:active:bg-control-active',
  ghost:
    'border-transparent bg-transparent text-primary enabled:hover:bg-control-hover enabled:active:bg-control-active',
  danger:
    'border-transparent bg-(image:--gradient-danger) text-on-primary enabled:hover:bg-(image:--gradient-danger-hover) enabled:active:bg-(image:--gradient-danger-active)',
};

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
        BASE,
        SIZE_CLASS[size],
        VARIANT_CLASS[variant],
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
