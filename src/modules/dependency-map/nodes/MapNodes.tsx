// MapNodes: the four node types of the map (frames S-27 to S-28).
// Each node is a fixed-size box (NODE_SIZE) holding ONE native button: it is what the keyboard reaches (Tab, then
// Enter or Space opens the side panel) and what a screen reader names with the full name of the element. The name is
// cut with "…" when it does not fit; the full name is in the accessible name and in the tooltip (title).
//   screen      monitor icon, name, documentation status tag and, for App (OnStart), the tag "Reserved"
//   variable    braces icon, name, scope tag; an untraced variable has a dashed border and the tag "Untraced"
//   collection  database icon and name
//   component   box icon and name, in a pill
// The color is neutral for every type (the design has no color per type yet); the type is told by icon and shape.
// Nodes are memoized (React Flow re-renders a node only when its props change); the `nodeTypes` table is in mapNodeTypes.ts.
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo, useContext } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { cx, ElementTypeIcon, StatusTag, Tag } from '../../../components/ui';
import { RESERVED_LABEL, toTagStatus } from '../../screens/screenLabels';
import { SCOPE_LABEL } from '../../variables/variableLabels';
import type { MapFlowNode } from '../graphModel';
import type { GraphNode } from '../graphTypes';
import { NODE_SIZE } from '../layout';
import { UNTRACED_TAG_LABEL } from '../graphLabels';
import { MapActionsContext, nodeButtonId } from '../mapContext';
import { nodeAriaLabel, truncateName } from '../nodeLabels';

function NodeBox({
  node,
  selected,
  className,
  children,
}: {
  node: GraphNode;
  selected: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { select } = useContext(MapActionsContext);
  const size: CSSProperties = NODE_SIZE[node.type];
  return (
    <div style={size} className="relative">
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="pointer-events-none opacity-0"
      />
      <button
        type="button"
        id={nodeButtonId(node.key)}
        aria-label={nodeAriaLabel(node)}
        aria-pressed={selected}
        title={node.name}
        onClick={() => {
          select(node.key);
        }}
        className={cx(
          'nopan nodrag flex size-full cursor-pointer flex-col justify-center gap-1 overflow-hidden border bg-surface px-3 text-left text-ink-900 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          selected
            ? 'border-accent ring-2 ring-accent'
            : 'border-border-control hover:border-accent',
          className,
        )}
      >
        {children}
      </button>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="pointer-events-none opacity-0"
      />
    </div>
  );
}

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

export const ScreenMapNode = memo(function ScreenMapNode({
  data,
  selected,
}: NodeProps<MapFlowNode>) {
  const node = data.graphNode;
  if (node.type !== 'SCREEN') return null;
  return (
    <NodeBox node={node} selected={selected === true} className="rounded-card">
      <NameRow node={node} type="screen" />
      <span className="flex items-center gap-1.5">
        <StatusTag status={toTagStatus(node.documentationStatus)} />
        {node.isAppContext && <Tag>{RESERVED_LABEL}</Tag>}
      </span>
    </NodeBox>
  );
});

export const VariableMapNode = memo(function VariableMapNode({
  data,
  selected,
}: NodeProps<MapFlowNode>) {
  const node = data.graphNode;
  if (node.type !== 'VARIABLE') return null;
  return (
    <NodeBox
      node={node}
      selected={selected === true}
      className={cx('rounded-card', node.untraced && 'border-dashed border-badge-warning-bg')}
    >
      <NameRow node={node} type="variable" />
      <span className="flex items-center gap-1.5">
        <Tag>{SCOPE_LABEL[node.scope]}</Tag>
        {node.untraced && <Tag tone="warning">{UNTRACED_TAG_LABEL}</Tag>}
      </span>
    </NodeBox>
  );
});

export const CollectionMapNode = memo(function CollectionMapNode({
  data,
  selected,
}: NodeProps<MapFlowNode>) {
  const node = data.graphNode;
  if (node.type !== 'COLLECTION') return null;
  return (
    <NodeBox node={node} selected={selected === true} className="rounded-card">
      <NameRow node={node} type="collection" />
    </NodeBox>
  );
});

export const ComponentMapNode = memo(function ComponentMapNode({
  data,
  selected,
}: NodeProps<MapFlowNode>) {
  const node = data.graphNode;
  if (node.type !== 'COMPONENT') return null;
  return (
    <NodeBox
      node={node}
      selected={selected === true}
      className="rounded-pill border-transparent bg-disabled-bg px-3.5 shadow-none"
    >
      <NameRow node={node} type="component" />
    </NodeBox>
  );
});
