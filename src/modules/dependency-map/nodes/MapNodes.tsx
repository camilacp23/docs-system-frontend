// MapNodes: the node kinds of the map (frames S-27 to S-28) and what they show.
// Each node is a fixed-size box (the size is in its data, from the scene) holding ONE native button: it is what the keyboard
// reaches (Tab, then Enter or Space) and what a screen reader names with the full name of the element. The name is cut with
// "…" when it does not fit; the full name is in the accessible name and in the tooltip (title).
//   screenCard   (Screens view) monitor icon, name, documentation status tag, "Reserved" for App (OnStart) and the counters
//                of components, variables and collections
//   screen       monitor icon, name, status tag and "Reserved"
//   screenGroup  a screen that holds its components: a header with the screen, and the components are drawn inside it
//   variable     braces icon, name, scope tag; an untraced variable has a dashed border and the tag "Untraced"
//   collection   database icon and name
//   component    box icon and name, in a pill
// The color is neutral for every type (the design has no color per type yet); the type is told by icon and shape.
// A node reacts to the mouse and to the keyboard focus (the page highlights its connections) and is dimmed while another node
// is highlighted. Nodes are memoized; the `nodeTypes` table is in mapNodeTypes.ts.
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo, useContext } from 'react';
import type { ReactNode } from 'react';

import { cx, ElementTypeIcon, StatusTag, Tag } from '../../../components/ui';
import { RESERVED_LABEL, toTagStatus } from '../../screens/screenLabels';
import { countText, SCOPE_LABEL } from '../../variables/variableLabels';
import { UNTRACED_TAG_LABEL } from '../graphLabels';
import type { MapFlowNode } from '../graphModel';
import type { GraphNode } from '../graphTypes';
import { GROUP_HEADER } from '../screenGroups';
import { HighlightContext, MapActionsContext, nodeButtonId } from '../mapContext';
import { nodeAriaLabel, truncateName } from '../nodeLabels';
import type { SceneCounters } from '../scene';

const HANDLE_CLASS = 'pointer-events-none opacity-0';

function NodeShell({
  node,
  data,
  selected,
  counters = null,
  buttonClassName,
  children,
}: {
  node: GraphNode;
  data: MapFlowNode['data'];
  selected: boolean;
  counters?: SceneCounters | null;
  buttonClassName?: string;
  children: ReactNode;
}) {
  const { activate, hover, focusNode } = useContext(MapActionsContext);
  const lit = useContext(HighlightContext);
  const dimmed = lit !== null && !lit.has(node.key);
  const chosen = selected || data.role === 'center';
  return (
    <div
      style={{ width: data.width, height: data.height }}
      className={cx('relative transition-opacity', dimmed && 'opacity-25')}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className={HANDLE_CLASS}
      />
      <button
        type="button"
        id={nodeButtonId(node.key)}
        aria-label={nodeAriaLabel(node, counters)}
        aria-pressed={chosen}
        title={node.name}
        onClick={() => {
          activate(node.key);
        }}
        onMouseEnter={() => {
          hover(node.key);
        }}
        onMouseLeave={() => {
          hover(null);
        }}
        onFocus={() => {
          focusNode(node.key);
        }}
        onBlur={() => {
          focusNode(null);
        }}
        className={cx(
          'nopan nodrag flex size-full cursor-pointer text-left text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          buttonClassName,
          chosen ? 'border-accent ring-2 ring-accent' : 'border-border-control hover:border-accent',
        )}
      >
        {children}
      </button>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className={HANDLE_CLASS}
      />
    </div>
  );
}

const BOX_CLASS =
  'flex-col justify-center gap-1 overflow-hidden rounded-card border bg-surface px-3 shadow-card';

function NameRow({
  node,
  type,
}: {
  node: GraphNode;
  type: 'screen' | 'variable' | 'collection' | 'component';
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ElementTypeIcon type={type} size={15} className="shrink-0 text-ink-700" />
      <span className="min-w-0 truncate font-mono text-label font-semibold">
        {truncateName(node.name, node.type)}
      </span>
    </span>
  );
}

function StatusRow({ node }: { node: GraphNode }) {
  if (node.type !== 'SCREEN') return null;
  return (
    <span className="flex items-center gap-1.5">
      <StatusTag status={toTagStatus(node.documentationStatus)} />
      {node.isAppContext && <Tag>{RESERVED_LABEL}</Tag>}
    </span>
  );
}

function Counter({
  type,
  count,
  noun,
}: {
  type: 'component' | 'variable' | 'collection';
  count: number;
  noun: string;
}) {
  return (
    <span className="inline-flex items-center gap-1" title={countText(count, noun)}>
      <ElementTypeIcon type={type} size={13} className="text-ink-500" />
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{countText(count, noun)}</span>
    </span>
  );
}

export const ScreenCardNode = memo(function ScreenCardNode({
  data,
  selected,
}: NodeProps<MapFlowNode>) {
  const node = data.graphNode;
  if (node.type !== 'SCREEN') return null;
  const counters = data.counters;
  return (
    <NodeShell
      node={node}
      data={data}
      selected={selected === true}
      counters={counters}
      buttonClassName={BOX_CLASS}
    >
      <NameRow node={node} type="screen" />
      <StatusRow node={node} />
      {counters !== null && (
        <span className="flex items-center gap-3 text-small text-ink-700">
          <Counter type="component" count={counters.components} noun="component" />
          <Counter type="variable" count={counters.variables} noun="variable" />
          <Counter type="collection" count={counters.collections} noun="collection" />
        </span>
      )}
    </NodeShell>
  );
});

export const ScreenMapNode = memo(function ScreenMapNode({
  data,
  selected,
}: NodeProps<MapFlowNode>) {
  const node = data.graphNode;
  if (node.type !== 'SCREEN') return null;
  return (
    <NodeShell node={node} data={data} selected={selected === true} buttonClassName={BOX_CLASS}>
      <NameRow node={node} type="screen" />
      <StatusRow node={node} />
    </NodeShell>
  );
});

/** A screen that holds its components: the button is the header, the components are nodes drawn on top of the body. */
export const ScreenGroupNode = memo(function ScreenGroupNode({
  data,
  selected,
}: NodeProps<MapFlowNode>) {
  const node = data.graphNode;
  if (node.type !== 'SCREEN') return null;
  return (
    <NodeShell
      node={node}
      data={data}
      selected={selected === true}
      buttonClassName="items-start rounded-card border bg-surface/80 shadow-card"
    >
      <span
        style={{ height: GROUP_HEADER }}
        className="flex w-full flex-col justify-center gap-1 px-3"
      >
        <NameRow node={node} type="screen" />
        <StatusRow node={node} />
      </span>
    </NodeShell>
  );
});

export const VariableMapNode = memo(function VariableMapNode({
  data,
  selected,
}: NodeProps<MapFlowNode>) {
  const node = data.graphNode;
  if (node.type !== 'VARIABLE') return null;
  return (
    <NodeShell
      node={node}
      data={data}
      selected={selected === true}
      buttonClassName={cx(BOX_CLASS, node.untraced && 'border-dashed border-badge-warning-bg')}
    >
      <NameRow node={node} type="variable" />
      <span className="flex items-center gap-1.5">
        <Tag>{SCOPE_LABEL[node.scope]}</Tag>
        {node.untraced && <Tag tone="warning">{UNTRACED_TAG_LABEL}</Tag>}
      </span>
    </NodeShell>
  );
});

export const CollectionMapNode = memo(function CollectionMapNode({
  data,
  selected,
}: NodeProps<MapFlowNode>) {
  const node = data.graphNode;
  if (node.type !== 'COLLECTION') return null;
  return (
    <NodeShell node={node} data={data} selected={selected === true} buttonClassName={BOX_CLASS}>
      <NameRow node={node} type="collection" />
    </NodeShell>
  );
});

export const ComponentMapNode = memo(function ComponentMapNode({
  data,
  selected,
}: NodeProps<MapFlowNode>) {
  const node = data.graphNode;
  if (node.type !== 'COMPONENT') return null;
  return (
    <NodeShell
      node={node}
      data={data}
      selected={selected === true}
      buttonClassName="flex-col justify-center overflow-hidden rounded-pill border bg-disabled-bg px-3.5"
    >
      <NameRow node={node} type="component" />
    </NodeShell>
  );
});
