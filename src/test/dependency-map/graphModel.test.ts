// graphModel: a scene of a view becomes React Flow nodes and edges (kinds, sizes, groups with their children, step edges with
// the style of their kind), the "untraced only" filter keeps the untraced variables and their neighbors without dangling
// edges, an application with only App (OnStart) counts as empty, and the highlight keeps a node, its neighbors and their lines.
import { describe, expect, it } from 'vitest';

import { buildAllScene } from '../../modules/dependency-map/allScene';
import { EDGE_STYLE } from '../../modules/dependency-map/edgeStyles';
import { buildFocusScene } from '../../modules/dependency-map/focusScene';
import { isEmptyMap, onlyUntraced, sceneToFlow } from '../../modules/dependency-map/graphModel';
import { EDGE_KINDS } from '../../modules/dependency-map/graphTypes';
import { computeHighlight, DIMMED_OPACITY } from '../../modules/dependency-map/highlight';
import { buildScreensScene } from '../../modules/dependency-map/screensScene';
import { accesses, collectionNode, sampleGraph, screenNode } from '../helpers/graphFixtures';

describe('sceneToFlow', () => {
  const scene = buildAllScene(sampleGraph());
  const { nodes, edges } = sceneToFlow(scene);

  it('makes one node per box, keyed by the key, with the kind and the fixed size of its box', () => {
    expect(nodes).toHaveLength(scene.nodes.length);
    for (const [position, node] of nodes.entries()) {
      const box = scene.nodes[position];
      expect(node.id).toBe(box?.key);
      expect(node.type).toBe(box?.kind);
      expect(node.width).toBe(box?.width);
      expect(node.height).toBe(box?.height);
      expect(node.data.graphNode).toBe(box?.graphNode);
    }
  });

  it('puts the components of a group inside it: parent, extent and a position relative to the group', () => {
    const group = nodes.find((node) => node.id === 'screen:12');
    const child = nodes.find((node) => node.id === 'component:31');
    expect(group?.type).toBe('screenGroup');
    expect(group?.parentId).toBeUndefined();
    expect(child).toMatchObject({ parentId: 'screen:12', extent: 'parent' });
    // The group comes before its children, as React Flow needs.
    expect(nodes.indexOf(group as (typeof nodes)[number])).toBeLessThan(
      nodes.indexOf(child as (typeof nodes)[number]),
    );
  });

  it('keeps the variant fields of the contract inside the node data', () => {
    const byKey = new Map(nodes.map((node) => [node.id, node.data.graphNode]));
    expect(byKey.get('screen:11')).toMatchObject({
      documentationStatus: 'APPROVED',
      miroLink: expect.any(String) as string,
    });
    expect(byKey.get('variable:3')).toMatchObject({ scope: 'GLOBAL', untraced: true });
    expect(byKey.get('component:31')).toMatchObject({ screenId: 12 });
    expect(byKey.get('collection:21')).not.toHaveProperty('scope');
  });

  it('carries the counters of a card and the role of a box in the focus view', () => {
    const cards = sceneToFlow(buildScreensScene(sampleGraph())).nodes;
    expect(cards.every((node) => node.type === 'screenCard')).toBe(true);
    expect(cards.find((node) => node.id === 'screen:12')?.data.counters).toEqual({
      components: 2,
      variables: 2,
      collections: 1,
    });
    const focus = buildFocusScene(sampleGraph(), 'variable:1', 1);
    const roles = sceneToFlow(focus as NonNullable<typeof focus>).nodes.map(
      (node) => node.data.role,
    );
    expect(new Set(roles)).toEqual(new Set(['center', 'left', 'right']));
  });

  it('draws every edge with the routed type, the style of its kind and the route of the router', () => {
    const focus = sceneToFlow(buildFocusScene(sampleGraph(), 'collection:21', 2) as never).edges;
    expect(focus.length).toBeGreaterThan(0);
    expect(new Set(focus.map((edge) => edge.data?.sceneEdge.kind)).size).toBeGreaterThan(1);
    for (const edge of [...edges, ...focus]) {
      expect(edge.type).toBe('routed');
      const kind = edge.data?.sceneEdge.kind;
      expect(kind).toBeDefined();
      if (kind) expect(edge.style?.stroke).toBe(EDGE_STYLE[kind].stroke);
      expect(edge.focusable).toBe(false);
      // The path is the route that was computed with the layout, not one React Flow works out from the sides of the boxes.
      expect(edge.data?.route?.points.length).toBeGreaterThanOrEqual(2);
      expect(edge.data?.route).toBe(edge.data?.sceneEdge.route);
    }
  });

  it('draws a line from the border of its source to the border of its target through its own ports', () => {
    const reading = {
      nodes: [screenNode(1, 'Inicio'), collectionNode(1, 'colClientes')],
      edges: [accesses(1, 'screen:1', 'collection:1', 'READ', 'OnVisible')],
    };
    const scene = buildFocusScene(reading, 'screen:1', 1) as NonNullable<
      ReturnType<typeof buildFocusScene>
    >;
    const line = sceneToFlow(scene).edges[0];
    // Real direction kept: source is the screen, target the collection (which is on the screen's left).
    expect([line?.source, line?.target]).toEqual(['screen:1', 'collection:1']);
    const points = line?.data?.route?.points ?? [];
    const screenBox = scene.nodes.find((node) => node.key === 'screen:1');
    const collectionBox = scene.nodes.find((node) => node.key === 'collection:1');
    expect(points[0]?.x).toBe(screenBox?.x); // leaves the left border of the screen
    expect(points[points.length - 1]?.x).toBe(
      (collectionBox?.x ?? 0) + (collectionBox?.width ?? 0),
    );
  });

  it('puts the boxes above the lines and the components above their group', () => {
    const flow = sceneToFlow(buildAllScene(sampleGraph()));
    expect(flow.edges.every((edge) => edge.zIndex === 0)).toBe(true);
    expect(flow.nodes.find((node) => node.id === 'screen:12')?.zIndex).toBe(1);
    expect(flow.nodes.find((node) => node.id === 'component:31')?.zIndex).toBe(2);
  });

  it('shows the label of a line only when it touches the focused element, in the focus view', () => {
    const focus = sceneToFlow(buildFocusScene(sampleGraph(), 'variable:1', 2) as never).edges;
    const touching = focus.filter((edge) => edge.data?.sceneEdge.labelFirst);
    const others = focus.filter((edge) => !edge.data?.sceneEdge.labelFirst);
    expect(touching.length).toBeGreaterThan(0);
    expect(others.length).toBeGreaterThan(0);
    expect(touching.every((edge) => edge.data?.labelShown === true)).toBe(true);
    expect(others.every((edge) => edge.data?.labelShown === false)).toBe(true);
    for (const edge of sceneToFlow(buildScreensScene(sampleGraph())).edges) {
      expect(edge.data?.sceneEdge.label).toBeNull();
    }
  });

  it('gives each edge kind its own line: no two kinds share color, width and dash together', () => {
    const lines = EDGE_KINDS.map((kind) => JSON.stringify(EDGE_STYLE[kind]));
    expect(new Set(lines).size).toBe(EDGE_KINDS.length);
    // The line (width and dash) differs from kind to kind, so color is never the only cue (WCAG 1.4.1).
    const patterns = EDGE_KINDS.map(
      (kind) => `${EDGE_STYLE[kind].strokeWidth}|${EDGE_STYLE[kind].strokeDasharray ?? 'solid'}`,
    );
    expect(new Set(patterns).size).toBe(EDGE_KINDS.length);
  });
});

describe('computeHighlight', () => {
  const scene = buildAllScene(sampleGraph());

  it('is null when nothing is active or the key is not in the scene', () => {
    expect(computeHighlight(scene, null)).toBeNull();
    expect(computeHighlight(scene, 'variable:999')).toBeNull();
  });

  it('keeps the node, its neighbors and the lines between them', () => {
    const lit = computeHighlight(scene, 'collection:20');
    // colUsuarios feeds gUsuario and is derived by colClientes.
    expect(lit?.nodes.has('collection:20')).toBe(true);
    expect(lit?.nodes.has('variable:1')).toBe(true);
    expect(lit?.nodes.has('collection:21')).toBe(true);
    expect(lit?.nodes.has('variable:2')).toBe(false);
    expect(lit?.edges.size).toBe(2);
  });

  it('counts the components of a group as the group, and a component brings its group', () => {
    const group = computeHighlight(scene, 'screen:12');
    // Detalle holds btnGuardar and lblNombre: their lines are its lines, so what they use is lit.
    expect(group?.nodes.has('component:32')).toBe(true);
    expect(group?.nodes.has('variable:1')).toBe(true);
    const child = computeHighlight(scene, 'component:32');
    expect(child?.nodes.has('screen:12')).toBe(true);
    expect(child?.nodes.has('variable:1')).toBe(true);
  });

  it('is symmetrical: a neighbor of a lit node is lit from both ends', () => {
    const fromVariable = computeHighlight(scene, 'variable:1');
    const fromCollection = computeHighlight(scene, 'collection:20');
    expect(fromVariable?.nodes.has('collection:20')).toBe(true);
    expect(fromCollection?.nodes.has('variable:1')).toBe(true);
    expect(DIMMED_OPACITY).toBeLessThan(0.5);
  });
});

describe('onlyUntraced', () => {
  it('keeps the untraced variables, their direct neighbors and the edges between visible nodes', () => {
    const result = onlyUntraced(sampleGraph());
    expect(result.nodes.map((node) => node.key)).toEqual(['variable:3', 'collection:21']);
    expect(result.edges.map((edge) => edge.id)).toEqual(['vc:2']);
    const keys = new Set(result.nodes.map((node) => node.key));
    for (const edge of result.edges) {
      expect(keys.has(edge.source) && keys.has(edge.target)).toBe(true);
    }
  });

  it('leaves out what is two steps away from an untraced variable', () => {
    // Inicio accesses colClientes, which feeds gRegistroSel (untraced), but Inicio is not a direct neighbor.
    expect(onlyUntraced(sampleGraph()).nodes.some((node) => node.key === 'screen:11')).toBe(false);
  });

  it('returns nothing when no variable is untraced', () => {
    const data = sampleGraph();
    const traced = {
      nodes: data.nodes.map((node) =>
        node.type === 'VARIABLE' ? { ...node, untraced: false } : node,
      ),
      edges: data.edges,
    };
    expect(onlyUntraced(traced)).toEqual({ nodes: [], edges: [] });
  });
});

describe('isEmptyMap', () => {
  it('is true for an application with only App (OnStart), or nothing', () => {
    expect(isEmptyMap({ nodes: [], edges: [] })).toBe(true);
    expect(
      isEmptyMap({ nodes: [screenNode(1, 'App (OnStart)', { isAppContext: true })], edges: [] }),
    ).toBe(true);
  });

  it('is false as soon as another element exists', () => {
    expect(isEmptyMap(sampleGraph())).toBe(false);
    expect(
      isEmptyMap({
        nodes: [screenNode(1, 'App (OnStart)', { isAppContext: true }), screenNode(2, 'Inicio')],
        edges: [],
      }),
    ).toBe(false);
  });
});
