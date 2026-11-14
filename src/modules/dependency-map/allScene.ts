// allScene: the All elements view (D-114).
// buildAllScene(data) -> Scene with every node of the graph: a screen that has components is a GROUP that holds them (a
//   header with the screen and its components inside, with no CONTAINS edge), the rest are plain boxes. The groups are
//   placed in layers by every other edge (a component's edges count for its screen) and the disconnected pieces are packed
//   in rows until the map has the proportions of the canvas, so there are no thin strips. Every line is routed: the lines of
//   a component leave through the border of its group, level with the component, and never enter the group.
// exceedsAllLimit(data) -> true when the graph has more than MAX_ALL_NODES nodes (components included, however they are
//   grouped): the map is not drawn then. Past that size no layout is readable, so the page shows a notice with ways
//   to narrow it down (filter, Screens view, focus) instead.
import type { GraphData, GraphNode } from './graphTypes';
import { heightFor } from './grid';
import { computeLayout, NODE_SIZE, type NodeSize } from './layout';
import { buildRouted, degreesOf } from './routedScene';
import { groupEdges } from './sceneEdges';
import { componentsByScreen, groupLayout, unitKeyOf } from './screenGroups';
import { makeNode, nodeKindOf, NO_BOUNDS, type Scene, type SceneNode } from './scene';

export const MAX_ALL_NODES = 150;

export function exceedsAllLimit(data: GraphData): boolean {
  return data.nodes.length > MAX_ALL_NODES;
}

export function buildAllScene(data: GraphData): Scene {
  const groups = componentsByScreen(data);
  const nodesByKey = new Map(data.nodes.map((node) => [node.key, node]));
  const unitOf = (key: string) => {
    const node = nodesByKey.get(key);
    return node ? unitKeyOf(node, groups) : key;
  };

  const units = data.nodes.filter((node) => unitOf(node.key) === node.key);
  const drawnEdges = data.edges.filter(
    (edge) =>
      edge.kind !== 'CONTAINS' && nodesByKey.has(edge.source) && nodesByKey.has(edge.target),
  );
  const lines = groupEdges(drawnEdges, 'counts');
  const degrees = degreesOf(lines, unitOf);
  const sizeOfUnit = (node: GraphNode): NodeSize => {
    const children = groups.get(node.key);
    const base = children ? groupLayout(children.length) : NODE_SIZE[node.type];
    return { width: base.width, height: heightFor(base.height, degrees.get(node.key) ?? 0) };
  };
  const firstKey = data.nodes.find((node) => node.type === 'SCREEN' && node.isAppContext)?.key;

  return buildRouted((gapScale) => {
    const { positions } = computeLayout(
      {
        nodes: units,
        edges: drawnEdges.map((edge) => ({
          source: unitOf(edge.source),
          target: unitOf(edge.target),
        })),
      },
      (node) => {
        const unit = nodesByKey.get(node.key);
        return unit ? sizeOfUnit(unit) : NODE_SIZE[node.type];
      },
      { firstKey, gapScale },
    );

    const nodes: SceneNode[] = [];
    for (const unit of units) {
      const position = positions.get(unit.key) ?? { x: 0, y: 0 };
      const children = groups.get(unit.key);
      const size = sizeOfUnit(unit);
      nodes.push(
        makeNode({
          key: unit.key,
          kind: children ? 'screenGroup' : nodeKindOf(unit),
          graphNode: unit,
          x: position.x,
          y: position.y,
          width: size.width,
          height: size.height,
        }),
      );
      if (children) {
        const layout = groupLayout(children.length);
        children.forEach((child, index) => {
          const at = layout.positions[index] ?? { x: 0, y: 0 };
          nodes.push(
            makeNode({
              key: child.key,
              kind: 'component',
              graphNode: child,
              x: at.x,
              y: at.y,
              width: NODE_SIZE.COMPONENT.width,
              height: NODE_SIZE.COMPONENT.height,
              parentKey: unit.key,
            }),
          );
        });
      }
    }
    return {
      nodes,
      edges: lines,
      bounds: NO_BOUNDS,
      fit: null,
      failures: 0,
      routingMs: 0,
      undrawn: [],
      attempts: 1,
    };
  });
}
