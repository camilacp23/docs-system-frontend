// graphModel: the response of the API becomes React Flow nodes and edges (every node variant, every edge kind), the
// "untraced only" filter keeps the untraced variables and their neighbors without dangling edges, and an application
// with only App (OnStart) counts as empty.
import { describe, expect, it } from 'vitest';

import { EDGE_STYLE } from '../../modules/dependency-map/edgeStyles';
import {
  isEmptyMap,
  onlyUntraced,
  ORIGIN_LABEL,
  toFlowGraph,
} from '../../modules/dependency-map/graphModel';
import { EDGE_KINDS } from '../../modules/dependency-map/graphTypes';
import { computeLayout, NODE_SIZE } from '../../modules/dependency-map/layout';
import { sampleGraph, screenNode } from '../helpers/graphFixtures';

describe('toFlowGraph', () => {
  const data = sampleGraph();
  const { nodes, edges } = toFlowGraph(data, computeLayout(data).positions);

  it('makes one node per graph node, keyed by the node key, with the type and the fixed size of its box', () => {
    expect(nodes).toHaveLength(data.nodes.length);
    for (const [index, node] of nodes.entries()) {
      const source = data.nodes[index];
      expect(node.id).toBe(source?.key);
      expect(node.type).toBe(source?.type.toLowerCase());
      expect(node.width).toBe(NODE_SIZE[source?.type ?? 'SCREEN'].width);
      expect(node.height).toBe(NODE_SIZE[source?.type ?? 'SCREEN'].height);
      expect(node.data.graphNode).toBe(source);
    }
    expect(new Set(nodes.map((node) => node.type))).toEqual(
      new Set(['screen', 'variable', 'collection', 'component']),
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

  it('makes one edge per graph edge with the built-in type and the style of its kind', () => {
    expect(edges).toHaveLength(data.edges.length);
    expect(new Set(edges.map((edge) => edge.data?.graphEdge.kind))).toEqual(new Set(EDGE_KINDS));
    for (const edge of edges) {
      expect(edge.type).toBe('default');
      const kind = edge.data?.graphEdge.kind;
      expect(kind).toBeDefined();
      if (kind) expect(edge.style?.stroke).toBe(EDGE_STYLE[kind].stroke);
    }
  });

  it('labels only the CREATES edges, with "origin", and keeps edges out of the tab order', () => {
    for (const edge of edges) {
      expect(edge.label).toBe(edge.data?.graphEdge.kind === 'CREATES' ? ORIGIN_LABEL : undefined);
      expect(edge.focusable).toBe(false);
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
