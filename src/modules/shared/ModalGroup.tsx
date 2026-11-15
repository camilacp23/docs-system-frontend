// ModalGroup: a headed group of fields inside a creation modal (variables, collections): a small icon tile, the
// title and the fields below; a group that is not the first of its parent gets a divider above.
// Props: title (also the accessible name of the group as a region), icon (13 px Lucide), children.
import type { ReactNode } from 'react';

export function ModalGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-4 first:pt-0 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-divider [&:not(:first-child)]:pt-5"
    >
      <h3 className="flex items-center gap-2 text-label font-semibold text-ink-900">
        <span
          aria-hidden="true"
          className="flex size-5.5 items-center justify-center rounded-keycap bg-accent-soft text-accent-ink"
        >
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}
