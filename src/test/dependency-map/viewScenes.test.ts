// The Screens view and the All elements view (D-114): only screens and navigation with counters calculated in the client
// (components by CONTAINS, variables by ACCESSES and CREATES, collections by ACCESSES), App (OnStart) at the start; and the
// All elements view with screens as groups holding their components, packed pieces, and the limit of 60 nodes.
import { describe, expect, it } from 'vitest';

import {
  buildAllScene,
  exceedsAllLimit,
  MAX_ALL_NODES,
} from '../../modules/dependency-map/allScene';
import type { GraphData } from '../../modules/dependency-map/graphTypes';
import { SCREEN_CARD_SIZE } from '../../modules/dependency-map/layout';
import { groupEdges } from '../../modules/dependency-map/sceneEdges';
import { buildScreensScene, screenCounters } from '../../modules/dependency-map/screensScene';
import {
  accesses,
  collectionNode,
  componentNode,
  contains,
  creates,
  makeLargeGraph,
  navigates,
  sampleGraph,
  screenNode,
  uses,
  variableNode,
} from '../helpers/graphFixtures';

describe('Screens view', () => {
  it('draws only the screens, as cards, and only the NAVIGATES_TO edges', () => {
    const scene = buildScreensScene(sampleGraph());
    expect(scene.nodes.map((node) => node.key).sort()).toEqual([
      'screen:10',
      'screen:11',
      'screen:12',
    ]);
    expect(scene.nodes.every((node) => node.kind === 'screenCard')).toBe(true);
    expect(scene.nodes[0]).toMatchObject(SCREEN_CARD_SIZE);
    expect(scene.edges.map((edge) => [edge.kind, edge.source, edge.target])).toEqual([
      ['NAVIGATES_TO', 'screen:11', 'screen:12'],
    ]);
    expect(scene.edges[0]?.label).toBeNull();
  });

  it('counts components by CONTAINS, and distinct variables and collections by ACCESSES', () => {
    const counters = screenCounters(sampleGraph());
    // Inicio: galClientes; reads gUsuario and colClientes.
    expect(counters.get('screen:11')).toEqual({ components: 1, variables: 1, collections: 1 });
    // Detalle: btnGuardar and lblNombre; creates locMostrarDetalle, reads gUsuario, reads and writes colClientes.
    expect(counters.get('screen:12')).toEqual({ components: 2, variables: 2, collections: 1 });
  });

  it('counts a variable that a screen only creates (the origin row is not an ACCESSES edge)', () => {
    const data: GraphData = {
      nodes: [screenNode(1, 'Inicio'), variableNode(1, 'gSolo')],
      edges: [creates(1, 'screen:1', 'variable:1')],
    };
    expect(screenCounters(data).get('screen:1')).toEqual({
      components: 0,
      variables: 1,
      collections: 0,
    });
  });

  it('counts a variable once when a screen creates it and also accesses it in several places', () => {
    const data: GraphData = {
      nodes: [screenNode(1, 'Inicio'), variableNode(1, 'gUsuario'), collectionNode(1, 'colA')],
      edges: [
        creates(1, 'screen:1', 'variable:1'),
        accesses(2, 'screen:1', 'variable:1', 'READ', 'a'),
        accesses(3, 'screen:1', 'variable:1', 'WRITE', 'b'),
        accesses(4, 'screen:1', 'collection:1', 'READ', 'c'),
        accesses(5, 'screen:1', 'collection:1', 'READ', 'd'),
      ],
    };
    expect(screenCounters(data).get('screen:1')).toEqual({
      components: 0,
      variables: 1,
      collections: 1,
    });
  });

  it('puts the counters on the cards', () => {
    const scene = buildScreensScene(sampleGraph());
    expect(scene.nodes.find((node) => node.key === 'screen:12')?.counters).toEqual({
      components: 2,
      variables: 2,
      collections: 1,
    });
  });

  it('places App (OnStart) at the start, also when it navigates nowhere and other screens do', () => {
    const data: GraphData = {
      nodes: [
        screenNode(1, 'App (OnStart)', { isAppContext: true }),
        screenNode(2, 'a'),
        screenNode(3, 'b'),
        screenNode(4, 'c'),
      ],
      edges: [navigates(1, 'screen:2', 'screen:3'), navigates(2, 'screen:3', 'screen:4')],
    };
    const app = buildScreensScene(data).nodes.find((node) => node.key === 'screen:1');
    expect(app).toMatchObject({ x: 0, y: 0 });
  });

  it('places an application whose screens barely navigate as a block, not a strip', () => {
    const data = makeLargeGraph(500);
    const scene = buildScreensScene(data);
    let width = 0;
    let height = 0;
    for (const node of scene.nodes) {
      width = Math.max(width, node.x + node.width);
      height = Math.max(height, node.y + node.height);
    }
    expect(scene.nodes).toHaveLength(40);
    // The 500-element application has a ring of navigations through 39 screens: it must not become a strip.
    expect(width / height).toBeLessThan(3.5);
  });

  it('ignores a screen graph without screens', () => {
    expect(buildScreensScene({ nodes: [variableNode(1, 'v')], edges: [] }).nodes).toEqual([]);
  });
});

describe('All elements view', () => {
  it('makes a screen with components a group that holds them, with no CONTAINS edge', () => {
    const scene = buildAllScene(sampleGraph());
    const group = scene.nodes.find((node) => node.key === 'screen:12');
    expect(group?.kind).toBe('screenGroup');
    const children = scene.nodes.filter((node) => node.parentKey === 'screen:12');
    expect(children.map((node) => node.key)).toEqual(['component:31', 'component:32']);
    expect(scene.edges.some((edge) => edge.kind === 'CONTAINS')).toBe(false);
    // The components are not top-level boxes: they do not take a place of their own on the map.
    const top = scene.nodes.filter((node) => node.parentKey === null).map((node) => node.key);
    expect(top).not.toContain('component:31');
  });

  it('keeps a screen without components as a plain screen', () => {
    const scene = buildAllScene(sampleGraph());
    expect(scene.nodes.find((node) => node.key === 'screen:10')?.kind).toBe('screen');
  });

  it('holds every child inside its group', () => {
    const scene = buildAllScene(sampleGraph());
    for (const child of scene.nodes.filter((node) => node.parentKey !== null)) {
      const group = scene.nodes.find((node) => node.key === child.parentKey);
      expect(group).toBeDefined();
      expect(child.x + child.width).toBeLessThanOrEqual(group?.width ?? 0);
      expect(child.y + child.height).toBeLessThanOrEqual(group?.height ?? 0);
    }
  });

  it('draws the edges of a component from inside its group', () => {
    const scene = buildAllScene(sampleGraph());
    expect(
      scene.edges.some((edge) => edge.source === 'component:32' && edge.target === 'variable:1'),
    ).toBe(true);
  });

  it('draws components alone when their screen is not in the graph', () => {
    const data: GraphData = {
      nodes: [componentNode(5, 'lblX', 77), variableNode(1, 'gA')],
      edges: [uses(1, 'component:5', 'variable:1')],
    };
    const scene = buildAllScene(data);
    expect(scene.nodes.find((node) => node.key === 'component:5')).toMatchObject({
      kind: 'component',
      parentKey: null,
    });
  });

  it('groups parallel edges and labels only the count', () => {
    const data: GraphData = {
      nodes: [screenNode(1, 'a'), collectionNode(1, 'c')],
      edges: [
        accesses(1, 'screen:1', 'collection:1', 'READ', 'x'),
        accesses(2, 'screen:1', 'collection:1', 'WRITE', 'y'),
      ],
    };
    expect(buildAllScene(data).edges).toMatchObject([{ count: 2, label: '×2' }]);
  });

  it('packs unconnected pieces in rows instead of one strip', () => {
    const data: GraphData = {
      nodes: Array.from({ length: 30 }, (_, index) => variableNode(index + 1, `v${index + 1}`)),
      edges: [],
    };
    const scene = buildAllScene(data);
    let width = 0;
    let height = 0;
    for (const node of scene.nodes) {
      width = Math.max(width, node.x + node.width);
      height = Math.max(height, node.y + node.height);
    }
    expect(width / height).toBeGreaterThan(1);
    expect(width / height).toBeLessThan(3);
  });

  it('is the same scene for the same data', () => {
    const data = sampleGraph();
    const plain = (scene: unknown) =>
      JSON.stringify(scene, (key, value: unknown) => (key === 'routingMs' ? undefined : value));
    expect(plain(buildAllScene(data))).toBe(
      plain(buildAllScene(JSON.parse(JSON.stringify(data)) as GraphData)),
    );
  });
});

describe('the limit of the All elements view', () => {
  it('draws up to 60 nodes and refuses more, counting the components', () => {
    const at = (count: number): GraphData => ({
      nodes: Array.from({ length: count }, (_, index) =>
        componentNode(index + 1, `c${index + 1}`, 1),
      ),
      edges: [],
    });
    expect(MAX_ALL_NODES).toBe(60);
    expect(exceedsAllLimit(at(60))).toBe(false);
    expect(exceedsAllLimit(at(61))).toBe(true);
    expect(exceedsAllLimit(makeLargeGraph(500))).toBe(true);
    expect(exceedsAllLimit(sampleGraph())).toBe(false);
  });
});

describe('groupEdges', () => {
  it('makes one edge of the parallel ones, keeping the originals and the order', () => {
    const edges = [
      uses(1, 'component:1', 'variable:1'),
      uses(2, 'component:1', 'variable:1'),
      contains(3, 'screen:1', 'component:1'),
    ];
    const grouped = groupEdges(edges, 'all');
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ id: 'd:1', count: 2, label: '×2' });
    expect(grouped[0]?.edges.map((edge) => edge.id)).toEqual(['d:1', 'd:2']);
    expect(grouped[1]).toMatchObject({ count: 1, label: null });
  });

  it('has no labels when asked for none', () => {
    const grouped = groupEdges([creates(1, 'a', 'b'), accesses(2, 'a', 'c', 'READ', 'x')], 'none');
    expect(grouped.map((edge) => edge.label)).toEqual([null, null]);
  });
});
