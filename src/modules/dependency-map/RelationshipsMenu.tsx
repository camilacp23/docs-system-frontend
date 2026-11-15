// RelationshipsMenu: the "Relationships" button of the bar of the canvas and the panel it opens: one sample line per kind of
// edge (the legend of frame S-27c), drawn with the same style as the edges so the kinds can be told apart without color
// (WCAG 1.4.1). It used to be a card that stayed over the map; now it is out of the way until it is asked for.
// No props. The button has aria-expanded and aria-controls; the panel closes with Esc (the focus goes back to the button)
// or with a click anywhere outside it.
import { Waypoints } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { ICON_STROKE_WIDTH } from '../../components/ui';

import { EDGE_STYLE, edgeStyleOf } from './edgeStyles';
import { EDGE_KIND_LABEL } from './graphLabels';
import { EDGE_KINDS } from './graphTypes';

export const RELATIONSHIPS_LABEL = 'Relationships';

export function RelationshipsMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border-control bg-surface px-3 text-label font-semibold text-ink-900 shadow-card hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <Waypoints aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
        {RELATIONSHIPS_LABEL}
      </button>
      {open && (
        <section
          id={panelId}
          aria-labelledby={titleId}
          className="absolute top-10 left-0 z-20 w-80 rounded-card border border-border-subtle bg-surface px-4 py-3 shadow-modal"
        >
          <h2 id={titleId} className="mb-2 text-label font-bold text-ink-900">
            {RELATIONSHIPS_LABEL}
          </h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
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
      )}
    </div>
  );
}
