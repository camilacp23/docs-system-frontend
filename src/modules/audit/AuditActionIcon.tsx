// AuditActionIcon: the glyph of an audit action, the same in the timeline and in the "This period" panel: a plus for Created, a
// pencil for Updated, a trash can for Deleted and a check circle for Events. Decorative (the action is always written next to it).
// Props: action, size (px, default 18).
import { CircleCheck, Pencil, Plus, Trash2 } from 'lucide-react';

import { ICON_STROKE_WIDTH } from '../../components/ui';

import type { AuditAction } from './auditLabels';

export function AuditActionIcon({ action, size = 18 }: { action: AuditAction; size?: number }) {
  const props = { size, strokeWidth: ICON_STROKE_WIDTH, 'aria-hidden': true } as const;
  switch (action) {
    case 'CREATE':
      return <Plus {...props} />;
    case 'UPDATE':
      return <Pencil {...props} />;
    case 'DELETE':
      return <Trash2 {...props} />;
    case 'EVENT':
      return <CircleCheck {...props} />;
  }
}
