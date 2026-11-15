// ButtonLink: a router link drawn like a Button, for actions that navigate (Edit, View on map).
// Props: to (route), variant, size, iconLeft, plus every native anchor prop. Use Button for actions that do
// something on the page. A link cannot be disabled: render a disabled Button instead when the action is blocked.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { LinkProps } from 'react-router';

import { BUTTON_BASE, BUTTON_SIZE_CLASS, LINK_VARIANT_CLASS } from './buttonStyles';
import type { ButtonSize, ButtonVariant } from './buttonStyles';
import { cx } from './cx';

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  iconLeft,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      {...rest}
      className={cx(BUTTON_BASE, BUTTON_SIZE_CLASS[size], LINK_VARIANT_CLASS[variant], className)}
    >
      {iconLeft}
      {children}
    </Link>
  );
}
