// VariableKpis: the four cards above the variable list (S-10): all variables, global (Set), context
// (UpdateContext) and without origin screen. The last one is also a filter: pressing it toggles `untraced`.
// Props: kpis (the counters, null while they load or failed: the cards then show a dash), untracedActive,
// onToggleUntraced.
// They are StatTile cards (the same size and look as the collection counters): cerulean for the total, green for global,
// teal for context and red for the filter (always red, also when the count is 0; with a ring and a check while the filter is
// on: `aria-pressed` says it).
import { Braces, CircleAlert, LayoutGrid, Monitor } from 'lucide-react';

import { ICON_STROKE_WIDTH, StatTile } from '../../components/ui';

import type { VariableKpis as Kpis } from './useVariableKpis';

interface VariableKpisProps {
  kpis: Kpis | null;
  untracedActive: boolean;
  onToggleUntraced: () => void;
}

export function VariableKpis({ kpis, untracedActive, onToggleUntraced }: VariableKpisProps) {
  const iconProps = { size: 18, strokeWidth: ICON_STROKE_WIDTH } as const;
  return (
    <section aria-label="Variable counts" className="grid grid-cols-4 gap-4">
      <StatTile
        icon={<Braces {...iconProps} />}
        value={kpis?.total ?? null}
        label="Variables"
        tone="variable"
      />
      <StatTile
        icon={<LayoutGrid {...iconProps} />}
        value={kpis?.global ?? null}
        label="Global · Set"
        tone="success"
      />
      <StatTile
        icon={<Monitor {...iconProps} />}
        value={kpis?.context ?? null}
        label="Context · UpdateContext"
        tone="teal"
      />
      <StatTile
        icon={<CircleAlert {...iconProps} />}
        value={kpis?.untraced ?? null}
        label="Without origin screen · filter"
        tone="danger"
        pressed={untracedActive}
        onPress={onToggleUntraced}
      />
    </section>
  );
}
