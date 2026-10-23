// Avatar: circle with the initials of a person (36 px, blue gradient).
// Props: name (initials are the first letter of the first and last words), decorative (hide from assistive
// technology when the name is already next to it, e.g. in the user block), className.
import { cx } from './cx';

export interface AvatarProps {
  name: string;
  decorative?: boolean;
  className?: string;
}

/** First letter of the first and last words, uppercased ("Camila Castillo" -> "CC"; "Integración" -> "I"). */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0];
  const last = words.length > 1 ? words[words.length - 1]?.[0] : undefined;
  return `${first ?? ''}${last ?? ''}`.toUpperCase();
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
