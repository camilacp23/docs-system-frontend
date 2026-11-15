// GraphCanvas: the React Flow canvas of the dependency map (frames S-27 to S-28).
// Props: nodes, edges (from sceneToFlow, already placed and routed), bounds (everything that is drawn), fit (the boxes the first
// view frames and the one to keep in the middle, null for the whole map), layoutKey (changes only when the map is placed again:
// the view is fitted then and never when a node is selected), index (for the tooltip of an edge), onPaneClick.
// Performance (NFR-11): the node and edge types are module constants, nodes are memoized, only the elements inside the viewport
// are rendered (onlyRenderVisibleElements), nothing is draggable or connectable and the page owns the selection (React Flow gets no
// onNodesChange). The edge type is 'routed' (see RoutedEdge): the lines were routed with the layout, so they are not computed
// while drawing. A line shows its tooltip when hovered (S-27c); the same facts are in the side panel for the keyboard.
// The chrome of the canvas keeps out of the way of the map:
//   - a bar at the top with the "Relationships" button (the legend is a panel it opens, not a card over the map) and "Minimap";
//   - the zoom controls at the bottom right; the mini map, small and next to them, is OFF until the visitor turns it on with the
//     "Minimap" button (the preference is kept in this browser only, never needed);
//   - the first view and "fit view" RESERVE the space of that chrome (see canvasFit): no box starts under it. The first view is
//     readable: the whole map when it fits at 100 % or less, never below READABLE_MIN_ZOOM; when it does not fit, the framed
//     boxes start at the top left, or, if there is a box to keep in the middle (the focused element), around it.
//   - panning is limited to the map plus the room of the chrome.
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

import type { Rect } from './edgeRouting';
import type { MapFlowEdge, MapFlowNode } from './graphModel';
import { MAP_EDGE_TYPES } from './mapEdgeTypes';
import { MAP_NODE_TYPES } from './mapNodeTypes';
import { fitViewport, MINIMAP_SIZE } from './canvasFit';
import { edgeTooltip, type GraphIndex } from './panelModel';
import { MinimapToggle } from './MinimapToggle';
import { RelationshipsMenu } from './RelationshipsMenu';
import { useMinimapPreference } from './useMinimapPreference';
import type { SceneEdge, SceneFit } from './scene';
import './mapCanvas.css';

/** How far the user can zoom out by hand. */
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const MINIMAP_NODE_COLOR = 'var(--color-border-control)';
/** Panning goes this far (in map units) past the map: enough to bring its edge out from under the chrome. */
const PAN_ROOM = { top: 160, right: 400, bottom: 120, left: 120 };

interface GraphCanvasProps {
  nodes: MapFlowNode[];
  edges: MapFlowEdge[];
  bounds: Rect;
  fit: SceneFit | null;
  layoutKey: unknown;
  index: GraphIndex;
  onPaneClick: () => void;
}

interface Hovered {
  edge: SceneEdge;
  x: number;
  y: number;
}

export function GraphCanvas({
  nodes,
  edges,
  bounds,
  fit,
  layoutKey,
  index,
  onPaneClick,
}: GraphCanvasProps) {
  const { setViewport } = useReactFlow();
  const [minimapOn, toggleMinimap] = useMinimapPreference();
  const minimapRef = useRef(minimapOn);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(nodes);
  const [hovered, setHovered] = useState<Hovered | null>(null);

  useEffect(() => {
    nodesRef.current = nodes;
    minimapRef.current = minimapOn;
  });

  /** The readable first view: see canvasFit. */
  const fitReadable = useCallback(() => {
    const container = containerRef.current;
    if (!container || nodesRef.current.length === 0) return;
    const size = { width: container.offsetWidth, height: container.offsetHeight };

    // What the view frames: the boxes of `fit`, or everything that is drawn.
    const top = nodesRef.current.filter((node) => node.parentId === undefined);
    const rectOf = (node: MapFlowNode): Rect => ({
      x: node.position.x,
      y: node.position.y,
      width: node.width ?? 0,
      height: node.height ?? 0,
    });
    const framed = fit ? top.filter((node) => fit.keys.includes(node.id)).map(rectOf) : [];
    const left = Math.min(...framed.map((rect) => rect.x));
    const above = Math.min(...framed.map((rect) => rect.y));
    const content: Rect =
      framed.length === 0
        ? bounds
        : {
            x: left,
            y: above,
            width: Math.max(...framed.map((rect) => rect.x + rect.width)) - left,
            height: Math.max(...framed.map((rect) => rect.y + rect.height)) - above,
          };
    const anchorNode =
      fit?.anchorKey == null ? null : top.find((node) => node.id === fit.anchorKey);
    const view = fitViewport({
      content,
      anchor: anchorNode ? rectOf(anchorNode) : null,
      canvas: size,
      minimap: minimapRef.current,
    });
    void setViewport({ x: view.x, y: view.y, zoom: view.zoom }, { duration: 0 });
  }, [setViewport, bounds, fit]);

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
        edgeTypes={MAP_EDGE_TYPES}
        onlyRenderVisibleElements
        // Manual z-index: every edge is at 0 and every box above it. In the default mode React Flow lifts an edge to the level
        // of the component it ends at, which is above the boxes of the other screens, and the line crosses their text.
        zIndexMode="manual"
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        translateExtent={[
          [bounds.x - PAN_ROOM.left, bounds.y - PAN_ROOM.top],
          [bounds.x + bounds.width + PAN_ROOM.right, bounds.y + bounds.height + PAN_ROOM.bottom],
        ]}
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
        {minimapOn && (
          <MiniMap
            pannable
            zoomable
            ariaLabel="Minimap"
            nodeColor={MINIMAP_NODE_COLOR}
            position="bottom-right"
            style={MINIMAP_SIZE}
            className="!mr-14"
          />
        )}
        <Panel position="top-left" className="!m-3">
          <div className="flex items-start gap-2">
            <RelationshipsMenu />
            <MinimapToggle pressed={minimapOn} onToggle={toggleMinimap} />
          </div>
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
