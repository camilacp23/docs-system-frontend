// StatusStrip: full-width warning strip under the top bar (S-46 offline, S-09b archived application).
// Props: icon (18 px Lucide glyph), lead (bold sentence), children (rest of the text), action (optional button
// that sits right after the text, as in S-09b). role="alert" announces it when it appears.
import type { ReactNode } from 'react';

interface StatusStripProps {
  icon: ReactNode;
  lead: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function StatusStrip({ icon, lead, children, action }: StatusStripProps) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-warning-border bg-warning-bg px-6 py-2.5 text-body-lg text-warning-ink"
    >
      <span aria-hidden="true" className="flex shrink-0">
        {icon}
      </span>
      <p className="min-w-0">
        <span className="font-bold">{lead}</span>
        {children && <span> {children}</span>}
      </p>
      {action}
    </div>
  );
}
