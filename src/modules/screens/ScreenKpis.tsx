// ScreenKpis: the four cards above the screen list (S-18), in the style of the variable and collection counters
// (StatTile): all the screens, the ones In review, the Approved ones (with a small bar of the approved share) and the
// Undocumented ones. They are plain widgets, not buttons: the list is filtered with the Status select of the filter strip.
// Props: counts (the counters, null while they load or failed: the cards then show a dash).
// The total includes App (OnStart) (FR-19, D-98). The bar is drawn from approved / total and is decoration: the figures
// say the same in text.
import { CircleAlert, CircleCheck, ClipboardCheck, Monitor } from 'lucide-react';

import { ICON_STROKE_WIDTH, StatTile } from '../../components/ui';

import type { ScreenCounts } from './useScreenCounts';

interface ScreenKpisProps {
  counts: ScreenCounts | null;
}

export function ScreenKpis({ counts }: ScreenKpisProps) {
  const iconProps = { size: 18, strokeWidth: ICON_STROKE_WIDTH } as const;
  const share =
    counts === null || counts.total === 0 ? 0 : Math.round((counts.approved / counts.total) * 100);
  return (
    <section aria-label="Screen counts" className="grid grid-cols-4 gap-4">
      <StatTile
        icon={<Monitor {...iconProps} />}
        value={counts?.total ?? null}
        label="Screens"
        tone="screen"
      />
      <StatTile
        icon={<ClipboardCheck {...iconProps} />}
        value={counts?.inReview ?? null}
        label="In review"
        tone="review"
      />
      <StatTile
        icon={<CircleCheck {...iconProps} />}
        value={counts?.approved ?? null}
        label="Approved"
        tone="success"
        share={share}
      />
      <StatTile
        icon={<CircleAlert {...iconProps} />}
        value={counts?.undocumented ?? null}
        label="Undocumented"
        tone="danger"
      />
    </section>
  );
}
