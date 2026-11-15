// MinimapToggle: the "Minimap" button of the bar of the canvas, next to "Relationships". It turns the mini map on and off.
// Props: pressed (the mini map is on), onToggle. A toggle button: aria-pressed says the state, the label does not change.
import { Map as MapIcon } from 'lucide-react';

import { ICON_STROKE_WIDTH } from '../../components/ui';

export const MINIMAP_LABEL = 'Minimap';

export function MinimapToggle({ pressed, onToggle }: { pressed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`inline-flex h-8 items-center gap-1.5 rounded-control border px-3 text-label font-semibold text-ink-900 shadow-card hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
        pressed ? 'border-accent bg-accent-soft' : 'border-border-control bg-surface'
      }`}
    >
      <MapIcon aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
      {MINIMAP_LABEL}
    </button>
  );
}
