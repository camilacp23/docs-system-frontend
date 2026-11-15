// DeleteImpactBody: the body of a delete confirmation once the impact is known: the consequence in a highlighted
// panel, then the audit-log note apart, small and muted, under a divider.
// Props: children (the consequence sentence; it is rendered inside a <p>).
import { History } from 'lucide-react';
import type { ReactNode } from 'react';

import { ICON_STROKE_WIDTH, ImpactNotice } from '../../components/ui';

export const AUDIT_NOTE_TEXT = 'The audit log keeps a record of everything deleted.';

export function DeleteImpactBody({ children }: { children: ReactNode }) {
  return (
    <>
      <ImpactNotice>
        <p className="leading-6">{children}</p>
      </ImpactNotice>
      <p className="flex items-start gap-2 border-t border-divider pt-4 text-label text-ink-500">
        <History
          aria-hidden="true"
          size={16}
          strokeWidth={ICON_STROKE_WIDTH}
          className="mt-px shrink-0"
        />
        {AUDIT_NOTE_TEXT}
      </p>
    </>
  );
}
