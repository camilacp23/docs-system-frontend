// GraphCanvas: the React Flow canvas of the dependency map (frames S-27 to S-28).
// Props: nodes, edges (from sceneToFlow, already placed), layoutKey (changes only when the map is placed again: the view is
// fitted then and never when a node is selected), index (for the tooltip of an edge), onPaneClick.
// Performance (NFR-11): the node types are a module constant, nodes are memoized, only the elements inside the viewport
// are rendered (onlyRenderVisibleElements), nothing is draggable or connectable and the page owns the selection (React Flow
// gets no onNodesChange). Edges are the built-in 'smoothstep' type (steps), with a style per kind. The mini map and the zoom
// controls are the ones React Flow brings; the legend is a panel at the bottom left. Hovering an edge shows its tooltip
// (S-27c); the same facts are in the side panel for the keyboard.
// The first view is READABLE: when the whole map fits the canvas it is centered, at most at 100 %; when it does not, it is
// shown at READABLE_MIN_ZOOM (the text never shrinks below about 9 px) starting at its top left corner, where App (OnStart) is,
// and the mini map and panning go on from there. The "fit view" control does the same.
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
import { MAP_NODE_TYPES } from './mapNodeTypes';
import { edgeTooltip, type GraphIndex } from './panelModel';
import type { SceneEdge } from './scene';
import './mapCanvas.css';

/** The smallest zoom of the first view and of "fit view": 13 px text is about 9 px here. */
export const READABLE_MIN_ZOOM = 0.7;
/** A small map is not enlarged past its real size. */
export const FIT_MAX_ZOOM = 1;
/** The space kept around the map in the first view, in pixels. */
export const FIT_PADDING = 32;
/** How far the user can zoom out by hand. */
const MIN_ZOOM = 0.2;
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
  edge: SceneEdge;
  x: number;
  y: number;
}

export function GraphCanvas({ nodes, edges, layoutKey, index, onPaneClick }: GraphCanvasProps) {
  const { setViewport } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(nodes);
  const [hovered, setHovered] = useState<Hovered | null>(null);

  useEffect(() => {
    nodesRef.current = nodes;
  });

  /** The readable first view of the boxes of the map (components inside a group do not extend it). */
  const fitReadable = useCallback(() => {
    const container = containerRef.current;
    const top = nodesRef.current.filter((node) => node.parentId === undefined);
    if (!container || top.length === 0) return;
    const minX = Math.min(...top.map((node) => node.position.x));
    const minY = Math.min(...top.map((node) => node.position.y));
    const maxX = Math.max(...top.map((node) => node.position.x + (node.width ?? 0)));
    const maxY = Math.max(...top.map((node) => node.position.y + (node.height ?? 0)));
    const mapWidth = Math.max(1, maxX - minX);
    const mapHeight = Math.max(1, maxY - minY);
    const room = {
      width: Math.max(1, container.offsetWidth - 2 * FIT_PADDING),
      height: Math.max(1, container.offsetHeight - 2 * FIT_PADDING),
    };
    const fits = Math.min(room.width / mapWidth, room.height / mapHeight);
    const zoom = Math.min(FIT_MAX_ZOOM, Math.max(READABLE_MIN_ZOOM, fits));
    // Centered when it fits at this zoom, from the top left corner when it does not.
    const x =
      mapWidth * zoom <= room.width
        ? FIT_PADDING + (room.width - mapWidth * zoom) / 2 - minX * zoom
        : FIT_PADDING - minX * zoom;
    const y =
      mapHeight * zoom <= room.height
        ? FIT_PADDING + (room.height - mapHeight * zoom) / 2 - minY * zoom
        : FIT_PADDING - minY * zoom;
    void setViewport({ x, y, zoom }, { duration: 0 });
  }, [setViewport]);

  // A new placement (new data) fits the view; selecting, panning or zooming never comes here.
  useEffect(() => {
    fitReadable();
  }, [layoutKey, fitReadable]);

  const showTooltip = useCallback<EdgeMouseHandler<MapFlowEdge>>((event, edge) => {
    const box = containerRef.current?.getBoundingClientRect();
    const sceneEdge = edge.data?.sceneEdge;
    if (!box || !sceneEdge) return;
    setHovered({ edge: sceneEdge, x: event.clientX - box.left, y: event.clientY - box.top });
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
        <Controls showInteractive={false} onFitView={fitReadable} position="bottom-right" />
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
