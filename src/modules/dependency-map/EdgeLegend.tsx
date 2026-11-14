// EdgeLegend: the "Relationships" legend of the map (frame S-27c): one sample line per edge kind, drawn with the same
// style as the edges (color, width and dash), so the kinds can be told apart without color (WCAG 1.4.1).
// No props.
import { EDGE_STYLE, edgeStyleOf } from './edgeStyles';
import { EDGE_KIND_LABEL } from './graphLabels';
import { EDGE_KINDS } from './graphTypes';

export function EdgeLegend() {
  return (
    <section
      aria-labelledby="map-legend-title"
      className="rounded-card border border-border-subtle bg-surface px-4 py-3 shadow-card"
    >
      <h2 id="map-legend-title" className="mb-2 text-label font-bold text-ink-900">
        Relationships
      </h2>
      <ul className="grid grid-cols-4 gap-x-4 gap-y-1.5">
        {EDGE_KINDS.map((kind) => (
          <li key={kind} className="flex items-center gap-2 text-small text-ink-700">
            <svg width="36" height="8" aria-hidden="true" className="shrink-0">
              <line
                x1="2"
                y1="4"
                x2="34"
                y2="4"
                style={edgeStyleOf(kind)}
                data-width={EDGE_STYLE[kind].strokeWidth}
              />
            </svg>
            {EDGE_KIND_LABEL[kind]}
          </li>
        ))}
      </ul>
    </section>
  );
}
