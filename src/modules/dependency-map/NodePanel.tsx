// NodePanel: the side panel of the selected node (frames S-27b and S-28).
// Props: node, index (the graph indexed by indexGraph), focusedKey (the node the map is focused on, if any),
// onSelectNode(key) (an item of the panel was chosen: its panel opens), onFocus(node) (the "Focus on this node"
// button), notDrawn (the relationships the focus view at depth 2 does not draw: a section says how many and lists them), onClose (omitted in the focus view, where the panel always shows the element in the middle).
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
} from '../../components/ui';
import {
  BUTTON_BASE,
  BUTTON_SIZE_CLASS,
  LINK_VARIANT_CLASS,
} from '../../components/ui/buttonStyles';
import { RESERVED_LABEL, toTagStatus } from '../screens/screenLabels';
import { SCOPE_LABEL } from '../variables/variableLabels';

import { EDGE_KIND_LABEL, NODE_TYPE_LABEL, UNTRACED_TAG_LABEL } from './graphLabels';
import type { GraphEdge, GraphNode } from './graphTypes';
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

function iconType(node: GraphNode) {
  return node.type.toLowerCase() as 'screen' | 'variable' | 'collection' | 'component';
}

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
      className="flex w-88 shrink-0 flex-col gap-4 overflow-y-auto rounded-card border border-border-subtle bg-surface p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-label text-ink-500">{NODE_TYPE_LABEL[node.type]}</p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-mono text-title font-semibold break-words text-ink-900 focus:outline-none"
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
        {onClose !== undefined && (
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="flex size-7.5 shrink-0 items-center justify-center rounded-chip text-primary hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <X aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <ButtonLink to={nodeHref(node)} variant="primary" size="lg" className="w-full">
          {nodeOpenLabel(node)}
        </ButtonLink>
        {miroHref !== null && (
          <a
            href={miroHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`${BUTTON_BASE} ${BUTTON_SIZE_CLASS.lg} ${LINK_VARIANT_CLASS.secondary} w-full`}
          >
            Open in Miro
            <ExternalLink aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        {focusedKey !== node.key && (
          <Button
            size="lg"
            iconLeft={<Network aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            onClick={() => {
              onFocus(node);
            }}
          >
            Focus on this node
          </Button>
        )}
      </div>

      {sections.length === 0 ? (
        <p className="text-body-lg text-ink-500">{NO_CONNECTIONS_TEXT}</p>
      ) : (
        sections.map((section) => (
          <section key={section.id} aria-labelledby={`panel-${section.id}`}>
            <h3
              id={`panel-${section.id}`}
              className="mb-1 text-nav-section font-bold tracking-wider text-ink-500 uppercase"
            >
              {section.title}
            </h3>
            <ul>
              {section.items.map((item) => (
                <li key={item.id} className="border-b border-divider last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectNode(item.node.key);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-chip px-1 py-2 text-left hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ElementTypeIcon
                        type={iconType(item.node)}
                        size={14}
                        className="shrink-0 text-ink-700"
                      />
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
              ))}
            </ul>
          </section>
        ))
      )}

      {notDrawn.length > 0 && (
        <section aria-labelledby="panel-not-drawn">
          <h3
            id="panel-not-drawn"
            className="mb-1 text-nav-section font-bold tracking-wider text-ink-500 uppercase"
          >
            {NOT_DRAWN_TITLE}
          </h3>
          <p className="mb-1 text-small text-ink-500">{undrawnText(notDrawn.length)}</p>
          <ul>
            {notDrawn.map((edge) => {
              const source = index.nodesByKey.get(edge.source);
              const target = index.nodesByKey.get(edge.target);
              if (!source || !target) return null;
              return (
                <li key={edge.id} className="border-b border-divider last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectNode(source.key);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-chip px-1 py-2 text-left hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
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
    </aside>
  );
}
