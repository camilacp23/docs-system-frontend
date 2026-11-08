// MiroLink: the link to the Miro diagram of a screen (FR-13). Props: href (the screen's `miroLink`), children
// (the visible text), className. It opens in another tab with rel="noopener noreferrer". Only an https address is
// drawn as a link (the contract only accepts https, and a stored value of another kind is never made clickable);
// anything else renders nothing.
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx, ICON_STROKE_WIDTH } from '../../components/ui';

interface MiroLinkProps {
  href: string | null;
  children: ReactNode;
  className?: string;
}

export function MiroLink({ href, children, className }: MiroLinkProps) {
  if (href === null || !/^https:\/\//.test(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        'inline-flex items-center gap-1.5 rounded-chip font-semibold text-primary hover:underline',
        className,
      )}
    >
      {children}
      <ExternalLink aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
