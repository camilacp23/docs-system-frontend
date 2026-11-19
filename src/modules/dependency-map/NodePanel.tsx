// NodePanel: the side panel of the selected node (frames S-27b and S-28).
// Props: node, index (the graph indexed by indexGraph), focusedKey (the node the map is focused on, if any),
// onSelectNode(key) (an item of the panel was chosen: its panel opens), onFocus(node) (the "Focus on this node"
// button), notDrawn (the relationships the focus view at depth 2 does not draw: a section says how many and lists them), onClose (omitted in the focus view, where the panel always shows the element in the middle).
// Design: a card with a header band in the color of the node's type (indigo for a screen, cerulean for a variable, royal blue for a
// collection, rose for a component): a solid tile with the type icon, the type as a small pill, the name in IBM Plex Mono and the
// tags. Under it the actions (open, Miro, focus) and the connections, each group with its count and each row a soft tile with the
// icon of the other element.
// It shows the type, the name, the tags of the node (documentation status, "Reserved", scope, "Untraced"), the link to
// the page of the element (a component leads to the Components & navigation tab of its screen, D-102), for a screen the
// link to its Miro diagram when it is an https address (another tab, rel="noopener noreferrer") and the connections
// of the node, incoming and outgoing, grouped by kind. It is a region named "Selected element": the heading takes the
// focus when the node changes, Esc or the close button close it, and every item is a native button that opens the
// panel of that node, so the whole graph can be walked without the canvas.
import { ExternalLink, Network, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import {
  Button,
  ButtonLink,
  ElementTypeIcon,
  ICON_STROKE_WIDTH,
  StatusTag,
  Tag,
  cx,
} from '../../components/ui';
import {
  BUTTON_BASE,
  BUTTON_SIZE_CLASS,
  LINK_VARIANT_CLASS,
} from '../../components/ui/buttonStyles';
import { RESERVED_LABEL, toTagStatus } from '../screens/screenLabels';
import { SCOPE_LABEL } from '../variables/variableLabels';

import { EDGE_KIND_LABEL, NODE_TYPE_LABEL, UNTRACED_TAG_LABEL } from './graphLabels';
import type { GraphEdge, GraphNode, NodeType } from './graphTypes';
import { NO_CONNECTIONS_TEXT, NOT_DRAWN_TITLE, undrawnText } from './mapTexts';
import { miroHrefOf, nodeHref, nodeOpenLabel } from './nodeLinks';
import { buildPanelSections, type GraphIndex } from './panelModel';

interface NodePanelProps {
  node: GraphNode;
  index: GraphIndex;
  focusedKey: string | null;
  /** The relationships the map leaves out (focus view, depth 2): the panel says how many and lists them. */
  notDrawn?: readonly GraphEdge[];
  onSelectNode: (key: string) => void;
  onFocus: (node: GraphNode) => void;
  onClose?: (() => void) | undefined;
}

const NO_EDGES: readonly GraphEdge[] = [];

/** Written out so Tailwind finds the classes: the color of each type of element. */
const TONE: Record<
  NodeType,
  { card: string; band: string; tile: string; pill: string; row: string; rowIcon: string }
> = {
  SCREEN: {
    card: 'border-screen-border',
    band: 'from-screen-soft',
    tile: 'bg-(image:--gradient-screen)',
    pill: 'bg-surface text-screen-ink',
    row: 'hover:bg-screen-soft',
    rowIcon: 'bg-screen-soft text-screen-ink',
  },
  VARIABLE: {
    card: 'border-variable-border',
    band: 'from-variable-soft',
    tile: 'bg-(image:--gradient-variable)',
    pill: 'bg-surface text-variable-ink',
    row: 'hover:bg-variable-soft',
    rowIcon: 'bg-variable-soft text-variable-ink',
  },
  COLLECTION: {
    card: 'border-collection-border',
    band: 'from-collection-soft',
    tile: 'bg-(image:--gradient-collection)',
    pill: 'bg-surface text-collection-ink',
    row: 'hover:bg-collection-soft',
    rowIcon: 'bg-collection-soft text-collection-ink',
  },
  COMPONENT: {
    card: 'border-map-border',
    band: 'from-map-soft',
    tile: 'bg-(image:--gradient-map)',
    pill: 'bg-surface text-map-ink',
    row: 'hover:bg-map-soft',
    rowIcon: 'bg-map-soft text-map-ink',
  },
};

function iconType(node: GraphNode) {
  return node.type.toLowerCase() as 'screen' | 'variable' | 'collection' | 'component';
}

const ROW_CLASS =
  'flex w-full items-center justify-between gap-3 rounded-control px-2 py-1.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring motion-reduce:transition-none';

export function NodePanel({
  node,
  index,
  focusedKey,
  notDrawn = NO_EDGES,
  onSelectNode,
  onFocus,
  onClose,
}: NodePanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sections = buildPanelSections(node, index);
  const miroHref = miroHrefOf(node);
  const tone = TONE[node.type];

  // A new node opens a new panel: the heading takes the focus so the change is announced and Tab continues inside.
  useEffect(() => {
    headingRef.current?.focus();
  }, [node.key]);

  // Esc closes the panel while the focus is inside it. A listener on the element (not a prop) because the panel is a
  // landmark, not a control.
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const panel = panelRef.current;
    if (panel === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current?.();
      }
    };
    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <aside
      aria-label="Selected element"
      ref={panelRef}
      className={cx(
        'flex w-88 shrink-0 flex-col overflow-hidden rounded-modal border bg-surface shadow-card motion-safe:animate-fade-in',
        tone.card,
      )}
    >
      <div
        className={cx(
          'flex items-start justify-between gap-3 border-b border-divider bg-linear-to-br to-surface px-5 py-4',
          tone.band,
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className={cx(
              'flex size-11 shrink-0 items-center justify-center rounded-card text-on-primary shadow-nav-tile',
              tone.tile,
            )}
          >
            <ElementTypeIcon type={iconType(node)} size={20} />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <p
              className={cx(
                'w-fit rounded-pill px-2.5 py-0.5 text-micro font-bold tracking-wider uppercase shadow-button',
                tone.pill,
              )}
            >
              {NODE_TYPE_LABEL[node.type]}
            </p>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-mono text-heading font-semibold break-words text-ink-900 focus:outline-none"
            >
              {node.name}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {node.type === 'SCREEN' && (
                <>
                  <StatusTag status={toTagStatus(node.documentationStatus)} />
                  {node.isAppContext && <Tag>{RESERVED_LABEL}</Tag>}
                </>
              )}
              {node.type === 'VARIABLE' && (
                <>
                  <Tag>{SCOPE_LABEL[node.scope]}</Tag>
                  {node.untraced && <Tag tone="warning">{UNTRACED_TAG_LABEL}</Tag>}
                </>
              )}
            </div>
          </div>
        </div>
        {onClose !== undefined && (
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="flex size-7.5 shrink-0 items-center justify-center rounded-pill bg-surface text-ink-700 shadow-button transition-colors duration-150 hover:bg-control-hover hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring motion-reduce:transition-none"
          >
            <X aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        <div className="flex flex-col gap-2">
          <ButtonLink to={nodeHref(node)} variant="primary" size="lg" className="w-full">
            {nodeOpenLabel(node)}
          </ButtonLink>
          {(miroHref !== null || focusedKey !== node.key) && (
            <div className="flex gap-2">
              {miroHref !== null && (
                <a
                  href={miroHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${BUTTON_BASE} ${BUTTON_SIZE_CLASS.lg} ${LINK_VARIANT_CLASS.secondary} flex-1`}
                >
                  Open in Miro
                  <ExternalLink aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
              {focusedKey !== node.key && (
                <Button
                  size="lg"
                  className="flex-1"
                  iconLeft={
                    <Network aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
                  }
                  onClick={() => {
                    onFocus(node);
                  }}
                >
                  Focus on this node
                </Button>
              )}
            </div>
          )}
        </div>

        {sections.length === 0 ? (
          <p className="rounded-card bg-canvas px-4 py-3 text-body-lg text-ink-500">
            {NO_CONNECTIONS_TEXT}
          </p>
        ) : (
          sections.map((section) => (
            <section key={section.id} aria-labelledby={`panel-${section.id}`}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3
                  id={`panel-${section.id}`}
                  className="text-nav-section font-bold tracking-wider text-ink-700 uppercase"
                >
                  {section.title}
                </h3>
                <span
                  aria-hidden="true"
                  className="rounded-pill bg-disabled-bg px-2 py-px text-tag font-bold text-ink-700"
                >
                  {section.items.length}
                </span>
              </div>
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const itemTone = TONE[item.node.type];
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectNode(item.node.key);
                        }}
                        className={cx(ROW_CLASS, itemTone.row)}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className={cx(
                              'flex size-7 shrink-0 items-center justify-center rounded-control',
                              itemTone.rowIcon,
                            )}
                          >
                            <ElementTypeIcon type={iconType(item.node)} size={14} />
                          </span>
                          <span className="sr-only">{NODE_TYPE_LABEL[item.node.type]} </span>
                          <span className="min-w-0 truncate font-mono text-label font-semibold text-identifier">
                            {item.node.name}
                          </span>
                        </span>
                        {(item.detail !== '' || item.mono !== '') && (
                          <span className="shrink-0 text-small text-ink-500">
                            {item.detail}
                            {item.detail !== '' && item.mono !== '' && ' · '}
                            {item.mono !== '' && <span className="font-mono">{item.mono}</span>}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}

        {notDrawn.length > 0 && (
          <section aria-labelledby="panel-not-drawn">
            <h3
              id="panel-not-drawn"
              className="mb-1 text-nav-section font-bold tracking-wider text-ink-700 uppercase"
            >
              {NOT_DRAWN_TITLE}
            </h3>
            <p className="mb-1.5 text-small text-ink-500">{undrawnText(notDrawn.length)}</p>
            <ul className="flex flex-col gap-0.5">
              {notDrawn.map((edge) => {
                const source = index.nodesByKey.get(edge.source);
                const target = index.nodesByKey.get(edge.target);
                if (!source || !target) return null;
                return (
                  <li key={edge.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectNode(source.key);
                      }}
                      className={cx(ROW_CLASS, 'hover:bg-control-hover')}
                    >
                      <span className="min-w-0 truncate font-mono text-label font-semibold text-identifier">
                        {source.name} → {target.name}
                      </span>
                      <span className="shrink-0 text-small text-ink-500">
                        {EDGE_KIND_LABEL[edge.kind]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
