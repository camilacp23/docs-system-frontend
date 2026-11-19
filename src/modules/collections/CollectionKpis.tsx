// CollectionKpis: the three cards above the collection list (S-14), in the style of the variable counters (StatTile): all
// collections, linked to screens (with a small bar of the linked share) and not linked to any screen. The last one is also
// a filter: pressing it toggles `undocumented` (its accessible name is "Not linked to any screen").
// Props: counts (the counters, null while they load or failed: the cards then show a dash), undocumentedActive,
// onToggleUndocumented.
// Every figure comes from the same light reads of GET /collections as useCollectionCounts; the share of the bar is only
// drawn from them (linked / total) and is decoration: the figures say the same in text.
import { CircleAlert, Database, Link2 } from 'lucide-react';

import { ICON_STROKE_WIDTH, StatTile } from '../../components/ui';

import type { CollectionCounts } from './useCollectionCounts';

interface CollectionKpisProps {
  counts: CollectionCounts | null;
  undocumentedActive: boolean;
  onToggleUndocumented: () => void;
}

export function CollectionKpis({
  counts,
  undocumentedActive,
  onToggleUndocumented,
}: CollectionKpisProps) {
  const iconProps = { size: 18, strokeWidth: ICON_STROKE_WIDTH } as const;
  const linked = counts === null ? null : counts.total - counts.undocumented;
  const share =
    counts === null || counts.total === 0 ? 0 : Math.round(((linked ?? 0) / counts.total) * 100);
  return (
    <section aria-label="Collection counts" className="grid grid-cols-3 gap-4">
      <StatTile
        icon={<Database {...iconProps} />}
        value={counts?.total ?? null}
        label="Collections"
        tone="collection"
      />
      <StatTile
        icon={<Link2 {...iconProps} />}
        value={linked}
        label="Linked to screens"
        tone="success"
        share={share}
      />
      <StatTile
        icon={<CircleAlert {...iconProps} />}
        value={counts?.undocumented ?? null}
        label="Not linked · filter"
        tone={undocumentedActive || (counts?.undocumented ?? 0) > 0 ? 'danger' : 'neutral'}
        pressed={undocumentedActive}
        onPress={onToggleUndocumented}
        ariaLabel="Not linked to any screen"
      />
    </section>
  );
}
