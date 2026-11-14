// graphFixtures: dependency graphs for the tests, in the shape of the contract (GraphNode, GraphEdge).
// Builders: screenNode, variableNode, collectionNode, componentNode and the edge helpers (contains, creates, accesses,
// feeds, uses, derives, navigates). Fields that do not apply are absent, as in the API (D-104 c).
// sampleGraph() is the graph of frames S-27 to S-28 (SAR): App (OnStart), Inicio, Detalle, the variables gUsuario,
// gFiltroActivo, gRegistroSel (untraced) and locMostrarDetalle, the collections colUsuarios, colClientes and
// colActivos, and the components galClientes, btnGuardar and lblNombre.
// makeLargeGraph(nodeCount) is a deterministic graph at department scale (about 500 nodes and 1100 edges at the
// default size) with every node type and edge kind, and cycles of DERIVES_FROM and NAVIGATES_TO, like the one that
// `npm run sandbox:graph` of the backend loads. The same call gives the same graph.
import type { components } from '../../api/schema';
import type { GraphData, GraphEdge, GraphNode } from '../../modules/dependency-map/graphTypes';

type Status = components['schemas']['DocumentationStatus'];
type AccessMode = components['schemas']['AccessMode'];

export function screenNode(
  id: number,
  name: string,
  overrides: Partial<Extract<GraphNode, { type: 'SCREEN' }>> = {},
): GraphNode {
  return {
    key: `screen:${id}`,
    id,
    type: 'SCREEN',
    name,
    documentationStatus: 'DRAFT' as Status,
    isAppContext: false,
    miroLink: null,
    ...overrides,
  };
}

export function variableNode(
  id: number,
  name: string,
  overrides: Partial<Extract<GraphNode, { type: 'VARIABLE' }>> = {},
): GraphNode {
  return {
    key: `variable:${id}`,
    id,
    type: 'VARIABLE',
    name,
    scope: 'GLOBAL',
    untraced: false,
    ...overrides,
  };
}

export function collectionNode(id: number, name: string): GraphNode {
  return { key: `collection:${id}`, id, type: 'COLLECTION', name };
}

export function componentNode(id: number, name: string, screenId: number): GraphNode {
  return { key: `component:${id}`, id, type: 'COMPONENT', name, screenId };
}

export const contains = (id: number, source: string, target: string): GraphEdge => ({
  id: `ct:${id}`,
  source,
  target,
  kind: 'CONTAINS',
});
export const creates = (id: number, source: string, target: string): GraphEdge => ({
  id: `cr:${id}`,
  source,
  target,
  kind: 'CREATES',
});
export const accesses = (
  id: number,
  source: string,
  target: string,
  accessMode: AccessMode,
  usedIn: string,
): GraphEdge => ({
  id: `${target.startsWith('variable') ? 'sv' : 'sc'}:${id}`,
  source,
  target,
  kind: 'ACCESSES',
  accessMode,
  usedIn,
});
export const feeds = (
  id: number,
  source: string,
  target: string,
  assignmentFunction: 'SET' | 'UPDATE_CONTEXT',
  tableFunction: string | null,
  usedIn: string,
): GraphEdge => ({
  id: `vc:${id}`,
  source,
  target,
  kind: 'FEEDS',
  usedIn,
  assignmentFunction,
  tableFunction,
});
export const uses = (id: number, source: string, target: string): GraphEdge => ({
  id: `d:${id}`,
  source,
  target,
  kind: 'USES',
});
export const derives = (id: number, source: string, target: string): GraphEdge => ({
  id: `d:${id}`,
  source,
  target,
  kind: 'DERIVES_FROM',
});
export const navigates = (id: number, source: string, target: string): GraphEdge => ({
  id: `d:${id}`,
  source,
  target,
  kind: 'NAVIGATES_TO',
});

export const MIRO_LINK = 'https://miro.com/app/board/uXjVInicio=/';

export function sampleGraph(): GraphData {
  const nodes: GraphNode[] = [
    screenNode(10, 'App (OnStart)', { documentationStatus: 'IN_PROGRESS', isAppContext: true }),
    screenNode(11, 'Inicio', { documentationStatus: 'APPROVED', miroLink: MIRO_LINK }),
    screenNode(12, 'Detalle', { documentationStatus: 'IN_REVIEW' }),
    variableNode(1, 'gUsuario'),
    variableNode(2, 'gFiltroActivo'),
    variableNode(3, 'gRegistroSel', { untraced: true }),
    variableNode(4, 'locMostrarDetalle', { scope: 'CONTEXT' }),
    collectionNode(20, 'colUsuarios'),
    collectionNode(21, 'colClientes'),
    collectionNode(22, 'colActivos'),
    componentNode(30, 'galClientes', 11),
    componentNode(31, 'btnGuardar', 12),
    componentNode(32, 'lblNombre', 12),
  ];
  const edges: GraphEdge[] = [
    contains(30, 'screen:11', 'component:30'),
    contains(31, 'screen:12', 'component:31'),
    contains(32, 'screen:12', 'component:32'),
    creates(1, 'screen:10', 'variable:1'),
    creates(2, 'screen:10', 'variable:2'),
    creates(4, 'screen:12', 'variable:4'),
    accesses(1, 'screen:11', 'variable:1', 'READ', 'OnVisible'),
    accesses(2, 'screen:12', 'variable:1', 'READ', 'lblNombre.Text'),
    accesses(3, 'screen:11', 'collection:21', 'READ', 'galClientes.Items'),
    accesses(4, 'screen:12', 'collection:21', 'READ_WRITE', 'btnGuardar.OnSelect'),
    feeds(1, 'collection:20', 'variable:1', 'SET', 'First', 'OnStart'),
    feeds(2, 'collection:21', 'variable:3', 'SET', 'First', 'galClientes.OnSelect'),
    feeds(3, 'collection:21', 'variable:4', 'UPDATE_CONTEXT', null, 'OnVisible'),
    uses(40, 'component:32', 'variable:1'),
    uses(41, 'component:30', 'collection:21'),
    derives(50, 'collection:21', 'collection:20'),
    derives(51, 'collection:22', 'collection:21'),
    navigates(60, 'screen:11', 'screen:12'),
  ];
  return { nodes, edges };
}

/** A small deterministic generator (a linear congruential one), so the large graph is the same on every run. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function makeLargeGraph(nodeCount = 500): GraphData {
  const random = seeded(20261113);
  const screens = Math.round(nodeCount * 0.08);
  const variables = Math.round(nodeCount * 0.3);
  const collections = Math.round(nodeCount * 0.12);
  const components = nodeCount - screens - variables - collections;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const pick = (count: number) => 1 + Math.floor(random() * count);
  const statuses: Status[] = ['UNDOCUMENTED', 'DRAFT', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED'];

  for (let id = 1; id <= screens; id += 1) {
    nodes.push(
      screenNode(id, id === 1 ? 'App (OnStart)' : `scr${id}`, {
        documentationStatus: statuses[id % statuses.length] ?? 'DRAFT',
        isAppContext: id === 1,
      }),
    );
  }
  for (let id = 1; id <= variables; id += 1) {
    nodes.push(
      variableNode(id, `var${id}`, {
        scope: id % 3 === 0 ? 'CONTEXT' : 'GLOBAL',
        untraced: id % 11 === 0,
      }),
    );
  }
  for (let id = 1; id <= collections; id += 1) nodes.push(collectionNode(id, `col${id}`));
  for (let id = 1; id <= components; id += 1) {
    nodes.push(componentNode(id, `cmp${id}`, pick(screens)));
  }

  let edgeId = 1;
  const modes: AccessMode[] = ['READ', 'WRITE', 'READ_WRITE'];
  for (let id = 1; id <= components; id += 1) {
    const component = nodes.find((node) => node.key === `component:${id}`);
    if (component?.type === 'COMPONENT')
      edges.push(contains(edgeId++, `screen:${component.screenId}`, component.key));
  }
  for (let id = 1; id <= variables; id += 1) {
    if (id % 11 !== 0) edges.push(creates(edgeId++, `screen:${pick(screens)}`, `variable:${id}`));
  }
  for (let count = 0; count < 260; count += 1) {
    const target =
      random() < 0.6 ? `variable:${pick(variables)}` : `collection:${pick(collections)}`;
    edges.push(
      accesses(
        edgeId++,
        `screen:${pick(screens)}`,
        target,
        modes[count % 3] ?? 'READ',
        `ctl${count}.OnSelect`,
      ),
    );
  }
  for (let count = 0; count < 120; count += 1) {
    edges.push(
      feeds(
        edgeId++,
        `collection:${pick(collections)}`,
        `variable:${pick(variables)}`,
        count % 2 === 0 ? 'SET' : 'UPDATE_CONTEXT',
        count % 3 === 0 ? 'First' : null,
        'OnVisible',
      ),
    );
  }
  for (let count = 0; count < 280; count += 1) {
    const target =
      random() < 0.7 ? `variable:${pick(variables)}` : `collection:${pick(collections)}`;
    edges.push(uses(edgeId++, `component:${pick(components)}`, target));
  }
  // Cycles: each collection derives from the next one, and the last from the first; screens navigate in a ring.
  for (let id = 1; id <= collections; id += 1) {
    if (id % 4 === 0)
      edges.push(derives(edgeId++, `collection:${id}`, `collection:${(id % collections) + 1}`));
  }
  for (let id = 2; id <= screens; id += 1) {
    edges.push(navigates(edgeId++, `screen:${id}`, `screen:${id === screens ? 2 : id + 1}`));
  }
  return { nodes, edges };
}
