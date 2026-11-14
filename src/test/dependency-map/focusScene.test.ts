// Focus view (D-114): the element in the middle, what comes before it on the left and what comes after it on the right, by the
// flow of the data and with the access mode. One test for each rule, one for a neighbor with relations in both directions,
// depth 2, the group of a screen with its components (and no CONTAINS edge), grouped parallel edges, and the layout.
import { describe, expect, it } from 'vitest';

import type { GraphData, GraphEdge } from '../../modules/dependency-map/graphTypes';
import {
  buildFocusScene,
  CENTER_SCALE,
  upstreamKeyOf,
} from '../../modules/dependency-map/focusScene';
import { snapUp } from '../../modules/dependency-map/grid';
import { NODE_SIZE } from '../../modules/dependency-map/layout';
import { groupLayout } from '../../modules/dependency-map/screenGroups';
import type { Scene, SceneNode } from '../../modules/dependency-map/scene';
import {
  accesses,
  collectionNode,
  componentNode,
  contains,
  creates,
  derives,
  feeds,
  navigates,
  sampleGraph,
  screenNode,
  uses,
  variableNode,
} from '../helpers/graphFixtures';

function sceneOf(data: GraphData, center: string, depth = 1): Scene {
  const scene = buildFocusScene(data, center, depth);
  if (scene === null) throw new Error(`no scene for ${center}`);
  return scene;
}

const nodeOf = (scene: Scene, key: string): SceneNode => {
  const found = scene.nodes.find((node) => node.key === key);
  if (!found) throw new Error(`${key} is not in the scene`);
  return found;
};

const roleOf = (scene: Scene, key: string) => nodeOf(scene, key).role;

const screen = screenNode(1, 'Inicio');
const other = screenNode(2, 'Detalle');
const variable = variableNode(1, 'gUsuario');
const collection = collectionNode(1, 'colClientes');
const collectionB = collectionNode(2, 'colUsuarios');

describe('focus view: the side of each neighbor, by the flow of the data', () => {
  it('ACCESSES READ: the element that is read goes to the LEFT of the screen (it enters)', () => {
    const data = {
      nodes: [screen, collection],
      edges: [accesses(1, 'screen:1', 'collection:1', 'READ', 'OnVisible')],
    };
    expect(roleOf(sceneOf(data, 'screen:1'), 'collection:1')).toBe('left');
  });

  it('ACCESSES WRITE: the element that is written goes to the RIGHT of the screen (it leaves)', () => {
    const data = {
      nodes: [screen, collection],
      edges: [accesses(1, 'screen:1', 'collection:1', 'WRITE', 'btn.OnSelect')],
    };
    expect(roleOf(sceneOf(data, 'screen:1'), 'collection:1')).toBe('right');
  });

  it('ACCESSES READ_WRITE: to the LEFT, with the label "Read / Write"', () => {
    const data = {
      nodes: [screen, collection],
      edges: [accesses(1, 'screen:1', 'collection:1', 'READ_WRITE', 'btn.OnSelect')],
    };
    const scene = sceneOf(data, 'screen:1');
    expect(roleOf(scene, 'collection:1')).toBe('left');
    expect(scene.edges[0]?.label).toBe('Read / Write');
  });

  it('seen from the element, the screens that read it are on its right and the ones that write it on its left', () => {
    const data = {
      nodes: [screen, other, collection],
      edges: [
        accesses(1, 'screen:1', 'collection:1', 'READ', 'a'),
        accesses(2, 'screen:2', 'collection:1', 'WRITE', 'b'),
      ],
    };
    const scene = sceneOf(data, 'collection:1');
    expect(roleOf(scene, 'screen:1')).toBe('right');
    expect(roleOf(scene, 'screen:2')).toBe('left');
  });

  it('USES (component to variable or collection): the element that is used goes to the left', () => {
    const component = componentNode(5, 'lblNombre', 99); // its screen is not in the graph
    const data = { nodes: [component, variable], edges: [uses(1, 'component:5', 'variable:1')] };
    expect(roleOf(sceneOf(data, 'component:5'), 'variable:1')).toBe('left');
    expect(roleOf(sceneOf(data, 'variable:1'), 'component:5')).toBe('right');
  });

  it('CREATES: the screen of origin goes to the left of the variable, and the variable to the right of the screen', () => {
    const data = { nodes: [screen, variable], edges: [creates(1, 'screen:1', 'variable:1')] };
    expect(roleOf(sceneOf(data, 'variable:1'), 'screen:1')).toBe('left');
    expect(roleOf(sceneOf(data, 'screen:1'), 'variable:1')).toBe('right');
  });

  it('FEEDS: the collection goes to the left of the variable', () => {
    const data = {
      nodes: [collection, variable],
      edges: [feeds(1, 'collection:1', 'variable:1', 'SET', 'First', 'OnStart')],
    };
    expect(roleOf(sceneOf(data, 'variable:1'), 'collection:1')).toBe('left');
    expect(roleOf(sceneOf(data, 'collection:1'), 'variable:1')).toBe('right');
  });

  it('DERIVES_FROM: the collection it derives from goes to the left', () => {
    // colClientes derives from colUsuarios: the stored edge goes from the derived one to the origin.
    const data = {
      nodes: [collection, collectionB],
      edges: [derives(1, 'collection:1', 'collection:2')],
    };
    expect(roleOf(sceneOf(data, 'collection:1'), 'collection:2')).toBe('left');
    expect(roleOf(sceneOf(data, 'collection:2'), 'collection:1')).toBe('right');
  });

  it('NAVIGATES_TO: the screen you navigate from goes to the left', () => {
    const data = { nodes: [screen, other], edges: [navigates(1, 'screen:1', 'screen:2')] };
    expect(roleOf(sceneOf(data, 'screen:2'), 'screen:1')).toBe('left');
    expect(roleOf(sceneOf(data, 'screen:1'), 'screen:2')).toBe('right');
  });

  it('names the upstream end of every kind of edge', () => {
    const edge = (kind: GraphEdge['kind']): GraphEdge =>
      ({ id: 'x:1', source: 'a', target: 'b', kind }) as GraphEdge;
    expect(upstreamKeyOf(edge('CREATES'))).toBe('a');
    expect(upstreamKeyOf(edge('CONTAINS'))).toBe('a');
    expect(upstreamKeyOf(edge('NAVIGATES_TO'))).toBe('a');
    expect(upstreamKeyOf(edge('DERIVES_FROM'))).toBe('b');
    expect(upstreamKeyOf(edge('USES'))).toBe('b');
    expect(upstreamKeyOf(accesses(1, 'a', 'b', 'READ', 'x'))).toBe('b');
    expect(upstreamKeyOf(accesses(1, 'a', 'b', 'WRITE', 'x'))).toBe('a');
    expect(upstreamKeyOf(accesses(1, 'a', 'b', 'READ_WRITE', 'x'))).toBe('b');
    expect(upstreamKeyOf(feeds(1, 'a', 'b', 'SET', null, 'x'))).toBe('a');
  });
});

describe('focus view: a neighbor appears once', () => {
  // The screen creates the variable (the variable is downstream: right) AND reads it (the variable is upstream: left).
  const both: GraphData = {
    nodes: [screen, variable],
    edges: [
      creates(1, 'screen:1', 'variable:1'),
      accesses(2, 'screen:1', 'variable:1', 'READ', 'OnVisible'),
    ],
  };

  it('goes to the left when it has relations in both directions', () => {
    const scene = sceneOf(both, 'screen:1');
    expect(scene.nodes.filter((node) => node.key === 'variable:1')).toHaveLength(1);
    expect(roleOf(scene, 'variable:1')).toBe('left');
  });

  it('keeps the real direction of each of its edges', () => {
    const scene = sceneOf(both, 'screen:1');
    const kinds = scene.edges.map((edge) => [edge.kind, edge.source, edge.target]);
    expect(kinds).toEqual([
      ['CREATES', 'screen:1', 'variable:1'],
      ['ACCESSES', 'screen:1', 'variable:1'],
    ]);
  });

  it('does not repeat a node that is reached from two neighbors at depth 2', () => {
    const data: GraphData = {
      nodes: [screen, other, variable, collection],
      edges: [
        creates(1, 'screen:1', 'variable:1'),
        creates(2, 'screen:2', 'variable:1'),
        feeds(3, 'collection:1', 'variable:1', 'SET', null, 'a'),
        accesses(4, 'screen:1', 'collection:1', 'READ', 'b'),
        accesses(5, 'screen:2', 'collection:1', 'READ', 'c'),
      ],
    };
    const scene = sceneOf(data, 'variable:1', 2);
    const keys = scene.nodes.map((node) => node.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('focus view: depth', () => {
  const chain: GraphData = {
    nodes: [
      screenNode(1, 'a'),
      screenNode(2, 'b'),
      screenNode(3, 'c'),
      screenNode(4, 'd'),
      screenNode(5, 'e'),
    ],
    edges: [
      navigates(1, 'screen:1', 'screen:2'),
      navigates(2, 'screen:2', 'screen:3'),
      navigates(3, 'screen:3', 'screen:4'),
      navigates(4, 'screen:4', 'screen:5'),
    ],
  };

  it('depth 1 shows the center and its direct neighbors', () => {
    const scene = sceneOf(chain, 'screen:3', 1);
    expect(scene.nodes.map((node) => node.key).sort()).toEqual([
      'screen:2',
      'screen:3',
      'screen:4',
    ]);
  });

  it('depth 2 adds one more column on each side, on the side of the neighbor', () => {
    const scene = sceneOf(chain, 'screen:3', 2);
    expect(roleOf(scene, 'screen:2')).toBe('left');
    expect(roleOf(scene, 'screen:1')).toBe('left');
    expect(roleOf(scene, 'screen:4')).toBe('right');
    expect(roleOf(scene, 'screen:5')).toBe('right');
    const x = (key: string) => nodeOf(scene, key).x;
    expect(x('screen:1')).toBeLessThan(x('screen:2'));
    expect(x('screen:2')).toBeLessThan(x('screen:3'));
    expect(x('screen:3')).toBeLessThan(x('screen:4'));
    expect(x('screen:4')).toBeLessThan(x('screen:5'));
  });

  it('draws the edges between the neighbors too', () => {
    const scene = sceneOf(chain, 'screen:3', 2);
    expect(scene.edges).toHaveLength(4);
  });
});

describe('focus view: a screen holds its components', () => {
  const data = sampleGraph();

  it('makes the centered screen a group with its components inside and no CONTAINS edge', () => {
    const scene = sceneOf(data, 'screen:12');
    const group = nodeOf(scene, 'screen:12');
    expect(group.kind).toBe('screenGroup');
    expect(group.role).toBe('center');
    const children = scene.nodes.filter((node) => node.parentKey === 'screen:12');
    expect(children.map((child) => child.key).sort()).toEqual(['component:31', 'component:32']);
    const layout = groupLayout(2);
    expect(group.width).toBe(layout.width);
    expect(group.height).toBe(layout.height);
    // The groups come before their children, as React Flow needs.
    expect(scene.nodes.indexOf(group)).toBeLessThan(scene.nodes.indexOf(children[0] as SceneNode));
    expect(scene.edges.some((edge) => edge.kind === 'CONTAINS')).toBe(false);
  });

  it('keeps every child inside its group', () => {
    const scene = sceneOf(data, 'screen:12');
    const group = nodeOf(scene, 'screen:12');
    for (const child of scene.nodes.filter((node) => node.parentKey === 'screen:12')) {
      expect(child.x).toBeGreaterThanOrEqual(0);
      expect(child.y).toBeGreaterThanOrEqual(0);
      expect(child.x + child.width).toBeLessThanOrEqual(group.width);
      expect(child.y + child.height).toBeLessThanOrEqual(group.height);
    }
  });

  it('draws the edges of a component from inside its screen group', () => {
    const scene = sceneOf(data, 'screen:12');
    // lblNombre (component:32, in Detalle) uses gUsuario: the edge starts at the child, not at the group.
    expect(
      scene.edges.some((edge) => edge.source === 'component:32' && edge.target === 'variable:1'),
    ).toBe(true);
  });

  it('puts a component without its screen in the graph in a box of its own', () => {
    const lonely = {
      nodes: [componentNode(5, 'lblX', 77), variable],
      edges: [uses(1, 'component:5', 'variable:1')],
    };
    const scene = sceneOf(lonely, 'variable:1');
    expect(nodeOf(scene, 'component:5').kind).toBe('component');
    expect(nodeOf(scene, 'component:5').parentKey).toBeNull();
  });

  it('centers on the screen group when the element is one of its components', () => {
    const scene = sceneOf(data, 'component:31');
    expect(roleOf(scene, 'screen:12')).toBe('center');
  });
});

describe('focus view: parallel edges become one', () => {
  it('groups edges of the same kind between the same two boxes, with a count and the access mode', () => {
    const data: GraphData = {
      nodes: [screen, collection],
      edges: [
        accesses(1, 'screen:1', 'collection:1', 'READ', 'a'),
        accesses(2, 'screen:1', 'collection:1', 'READ', 'b'),
        accesses(3, 'screen:1', 'collection:1', 'READ', 'c'),
      ],
    };
    const scene = sceneOf(data, 'screen:1');
    expect(scene.edges).toHaveLength(1);
    expect(scene.edges[0]).toMatchObject({ count: 3, label: 'Read ×3' });
    expect(scene.edges[0]?.edges).toHaveLength(3);
  });

  it('lists the different access modes of a group, and the assignment functions of FEEDS', () => {
    const data: GraphData = {
      nodes: [screen, collection, variable],
      edges: [
        accesses(1, 'screen:1', 'collection:1', 'READ', 'a'),
        accesses(2, 'screen:1', 'collection:1', 'WRITE', 'b'),
        feeds(3, 'collection:1', 'variable:1', 'SET', null, 'x'),
        feeds(4, 'collection:1', 'variable:1', 'UPDATE_CONTEXT', null, 'y'),
      ],
    };
    const scene = sceneOf(data, 'collection:1');
    const labels = scene.edges.map((edge) => edge.label);
    expect(labels).toContain('Read · Write ×2');
    expect(labels).toContain('Set · UpdateContext ×2');
  });

  it('labels CREATES with "origin" and leaves a single plain edge without a count', () => {
    const data: GraphData = {
      nodes: [screen, other, variable],
      edges: [creates(1, 'screen:1', 'variable:1'), navigates(2, 'screen:1', 'screen:2')],
    };
    const scene = sceneOf(data, 'screen:1');
    expect(scene.edges.find((edge) => edge.kind === 'CREATES')?.label).toBe('origin');
    expect(scene.edges.find((edge) => edge.kind === 'NAVIGATES_TO')?.label).toBeNull();
  });

  it('keeps edges of different kinds or directions apart', () => {
    const data: GraphData = {
      nodes: [screen, other],
      edges: [navigates(1, 'screen:1', 'screen:2'), navigates(2, 'screen:2', 'screen:1')],
    };
    expect(sceneOf(data, 'screen:1').edges).toHaveLength(2);
  });
});

describe('focus view: layout', () => {
  it('returns null for an element that is not in the graph', () => {
    expect(buildFocusScene(sampleGraph(), 'variable:999', 1)).toBeNull();
  });

  it('puts the left column before the center and the center before the right', () => {
    const scene = sceneOf(sampleGraph(), 'variable:1');
    const lefts = scene.nodes.filter((node) => node.role === 'left' && node.parentKey === null);
    const rights = scene.nodes.filter((node) => node.role === 'right' && node.parentKey === null);
    const center = nodeOf(scene, 'variable:1');
    expect(lefts.length).toBeGreaterThan(0);
    expect(rights.length).toBeGreaterThan(0);
    for (const node of lefts) expect(node.x + node.width).toBeLessThan(center.x);
    for (const node of rights) expect(node.x).toBeGreaterThan(center.x + center.width);
  });

  it('never overlaps two top-level boxes', () => {
    for (const depth of [1, 2]) {
      const scene = sceneOf(sampleGraph(), 'collection:21', depth);
      const top = scene.nodes.filter((node) => node.parentKey === null);
      for (let first = 0; first < top.length; first += 1) {
        for (let second = first + 1; second < top.length; second += 1) {
          const a = top[first] as SceneNode;
          const b = top[second] as SceneNode;
          const overlap =
            a.x < b.x + b.width &&
            b.x < a.x + a.width &&
            a.y < b.y + b.height &&
            b.y < a.y + a.height;
          expect(overlap, `${a.key} and ${b.key}`).toBe(false);
        }
      }
    }
  });

  it('gives the same scene for the same data', () => {
    // The time the routing took is the only thing that may differ.
    const plain = (scene: Scene | null) =>
      JSON.stringify(scene, (key, value: unknown) => (key === 'routingMs' ? undefined : value));
    const first = plain(sceneOf(sampleGraph(), 'collection:21', 2));
    expect(
      plain(sceneOf(JSON.parse(JSON.stringify(sampleGraph())) as GraphData, 'collection:21', 2)),
    ).toBe(first);
  });

  it('sizes a plain box by its type, and the focused element a little bigger, all on the grid', () => {
    const scene = sceneOf(
      { nodes: [variable, screen], edges: [creates(1, 'screen:1', 'variable:1')] },
      'variable:1',
    );
    expect(nodeOf(scene, 'screen:1')).toMatchObject(NODE_SIZE.SCREEN);
    const center = nodeOf(scene, 'variable:1');
    expect(center.width).toBeGreaterThan(NODE_SIZE.VARIABLE.width);
    expect(center.height).toBeGreaterThanOrEqual(NODE_SIZE.VARIABLE.height);
    expect(center.width).toBe(snapUp(NODE_SIZE.VARIABLE.width * CENTER_SCALE));
    expect(center.width % 8).toBe(0);
    expect(contains(1, 'a', 'b').kind).toBe('CONTAINS');
  });
});
