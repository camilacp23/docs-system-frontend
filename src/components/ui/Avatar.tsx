// Avatar: circle with the initials of a person (36 px, blue gradient).
// Props: name (initials are the first letter of the first and last words), decorative (hide from assistive
// technology when the name is already next to it, e.g. in the user block), className.
import { cx } from './cx';
import { getInitials } from './initials';

export interface AvatarProps {
  name: string;
  decorative?: boolean;
  className?: string;
}

export function Avatar({ name, decorative = false, className }: AvatarProps) {
  return (
    <span
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name })}
      className={cx(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-pill bg-(image:--gradient-avatar) text-tag font-bold text-avatar-ink',
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
