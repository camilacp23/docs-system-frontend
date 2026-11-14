// GraphCanvas: the React Flow canvas of the dependency map (frames S-27 to S-28).
// Props: nodes, edges (from toFlowGraph, already placed), layoutKey (changes only when the map is placed again: the
// view is fitted then and never when a node is selected), index (for the tooltip of an edge), onPaneClick.
// Performance (NFR-11, ~500 nodes and ~1100 edges): the node types are a module constant, nodes are memoized, only
// the elements inside the viewport are rendered (onlyRenderVisibleElements), nothing is draggable or connectable and the
// page owns the selection (React Flow gets no onNodesChange), and edges use the built-in 'default' type with a style per
// kind. The mini map and the zoom controls (zoom in, zoom out, fit view) are the ones React Flow brings; the legend
// is a panel at the bottom left. Hovering an edge shows its tooltip (S-27c); the same facts are in the side panel.
// Keyboard: every node holds a button (see MapNodes) and the canvas does not trap Tab.
import {
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
  type EdgeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { useCallback, useEffect, useRef, useState } from 'react';

import { EdgeLegend } from './EdgeLegend';
import type { MapFlowEdge, MapFlowNode } from './graphModel';
import type { GraphEdge } from './graphTypes';
import { MAP_NODE_TYPES } from './mapNodeTypes';
import { edgeTooltip, type GraphIndex } from './panelModel';
import './mapCanvas.css';

// includeHiddenNodes: React Flow measures only the nodes it renders, and with onlyRenderVisibleElements the ones outside
// the first view are never rendered, so a fit view over measured nodes alone would frame just the visible corner of the
// map. With this option it uses the declared size of every node (they all have one: NODE_SIZE).
const FIT_OPTIONS = { padding: 0.15, duration: 0, includeHiddenNodes: true };
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 2;
const MINIMAP_NODE_COLOR = 'var(--color-border-control)';

interface GraphCanvasProps {
  nodes: MapFlowNode[];
  edges: MapFlowEdge[];
  layoutKey: unknown;
  index: GraphIndex;
  onPaneClick: () => void;
}

interface Hovered {
  edge: GraphEdge;
  x: number;
  y: number;
}

export function GraphCanvas({ nodes, edges, layoutKey, index, onPaneClick }: GraphCanvasProps) {
  const { fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<Hovered | null>(null);

  // A new placement (new data) fits the view; selecting, panning or zooming never comes here.
  useEffect(() => {
    void fitView(FIT_OPTIONS);
  }, [layoutKey, fitView]);

  const showTooltip = useCallback<EdgeMouseHandler<MapFlowEdge>>((event, edge) => {
    const box = containerRef.current?.getBoundingClientRect();
    const graphEdge = edge.data?.graphEdge;
    if (!box || !graphEdge) return;
    setHovered({ edge: graphEdge, x: event.clientX - box.left, y: event.clientY - box.top });
  }, []);
  const hideTooltip = useCallback(() => {
    setHovered(null);
  }, []);

  const tooltip = hovered ? edgeTooltip(hovered.edge, index) : null;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Dependency graph"
      className="map-flow relative size-full"
    >
      <ReactFlow<MapFlowNode, MapFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={MAP_NODE_TYPES}
        onlyRenderVisibleElements
        fitView
        fitViewOptions={FIT_OPTIONS}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        attributionPosition="top-right"
        onPaneClick={onPaneClick}
        onEdgeMouseEnter={showTooltip}
        onEdgeMouseMove={showTooltip}
        onEdgeMouseLeave={hideTooltip}
      >
        <Controls showInteractive={false} fitViewOptions={FIT_OPTIONS} position="bottom-right" />
        <MiniMap
          pannable
          zoomable
          ariaLabel="Minimap"
          nodeColor={MINIMAP_NODE_COLOR}
          position="bottom-right"
          className="!mr-14"
        />
        <Panel position="bottom-left" className="!m-3">
          <EdgeLegend />
        </Panel>
      </ReactFlow>
      {tooltip && hovered && (
        <div
          role="tooltip"
          style={{ left: hovered.x + 12, top: hovered.y + 12 }}
          className="pointer-events-none absolute z-10 max-w-80 rounded-chip bg-toast-bg px-3 py-2 text-toast-ink shadow-toast"
        >
          <p className="font-mono text-label font-semibold break-words">{tooltip.title}</p>
          <p className="text-small">{tooltip.detail}</p>
        </div>
      )}
    </div>
  );
}
