// panelModel: what the side panel of a node lists (frames S-27b and S-28): its connections, incoming and outgoing.
// indexGraph(data) -> { nodesByKey, edgesByNode }  (built once per graph, so opening a panel never scans every edge).
// buildPanelSections(node, index) -> sections in a fixed order, each with a title and its items.
//   A section is one edge kind in one direction ("Contains", "Created in", "Accessed by", "Fed from" ...); the
//   titles the frames draw are kept, the rest follow the same pattern. NAVIGATES_TO is one section, "Navigation", whose
//   items say "to" or "from". An item is the other end of the edge plus a detail that says what the edge carries:
//   the access mode and `usedIn` of an ACCESSES edge, the assignment function, table function and `usedIn` of a FEEDS
//   edge, "origin" for CREATES, and for a component that uses the node, the screen it belongs to.
// Items follow the order of the response, which is deterministic (D-104 d).
import { ACCESS_MODE_LABEL, ASSIGNMENT_FUNCTION_LABEL, EDGE_KIND_LABEL } from './graphLabels';
import type { EdgeKind, GraphData, GraphEdge, GraphNode } from './graphTypes';
import { ORIGIN_LABEL } from './graphModel';

export interface GraphIndex {
  nodesByKey: ReadonlyMap<string, GraphNode>;
  edgesByNode: ReadonlyMap<string, readonly GraphEdge[]>;
}

export interface PanelItem {
  /** Unique within the panel: the edge id and the end that is shown. */
  id: string;
  node: GraphNode;
  /** The words at the right of the item (empty when the edge carries nothing to say). */
  detail: string;
  /** The part of the detail written in IBM Plex Mono (a `usedIn` value), when there is one. */
  mono: string;
  /** Plain text read by assistive technology after the name, e.g. "Read, lblNombre.Text". */
  description: string;
}

type Direction = 'out' | 'in';

export interface PanelSection {
  id: string;
  kind: EdgeKind;
  direction: Direction;
  title: string;
  items: PanelItem[];
}

export function indexGraph(data: GraphData): GraphIndex {
  const nodesByKey = new Map<string, GraphNode>();
  for (const node of data.nodes) nodesByKey.set(node.key, node);
  const edgesByNode = new Map<string, GraphEdge[]>();
  const add = (key: string, edge: GraphEdge) => {
    const list = edgesByNode.get(key);
    if (list) list.push(edge);
    else edgesByNode.set(key, [edge]);
  };
  for (const edge of data.edges) {
    add(edge.source, edge);
    if (edge.target !== edge.source) add(edge.target, edge);
  }
  return { nodesByKey, edgesByNode };
}

/** The section titles. NAVIGATES_TO is the same section in both directions. */
const SECTION_TITLE: Record<EdgeKind, Record<Direction, string>> = {
  CONTAINS: { out: 'Contains', in: 'Contained in' },
  CREATES: { out: 'Creates', in: 'Created in' },
  ACCESSES: { out: 'Accesses', in: 'Accessed by' },
  FEEDS: { out: 'Feeds', in: 'Fed from' },
  USES: { out: 'Uses', in: 'Used by' },
  DERIVES_FROM: { out: 'Derives from', in: 'Derived by' },
  NAVIGATES_TO: { out: 'Navigation', in: 'Navigation' },
};

const SECTION_ORDER: readonly EdgeKind[] = [
  'CONTAINS',
  'CREATES',
  'ACCESSES',
  'FEEDS',
  'USES',
  'DERIVES_FROM',
  'NAVIGATES_TO',
];

/** What the edge says, in two pieces: the plain words and the `usedIn` value (shown in monospace). */
export function edgeDetail(
  edge: GraphEdge,
  direction: Direction,
  other: GraphNode,
  index: GraphIndex,
): { detail: string; mono: string } {
  switch (edge.kind) {
    case 'CREATES':
      return { detail: ORIGIN_LABEL, mono: '' };
    case 'ACCESSES':
      return { detail: ACCESS_MODE_LABEL[edge.accessMode], mono: edge.usedIn };
    case 'FEEDS': {
      const parts = [ASSIGNMENT_FUNCTION_LABEL[edge.assignmentFunction]];
      if (edge.tableFunction !== null) parts.push(edge.tableFunction);
      return { detail: parts.join(' · '), mono: edge.usedIn };
    }
    case 'NAVIGATES_TO':
      return { detail: direction === 'out' ? 'to' : 'from', mono: '' };
    case 'USES': {
      // A component that uses the node: the screen it belongs to, when that screen is in the graph.
      if (direction === 'in' && other.type === 'COMPONENT') {
        const screen = index.nodesByKey.get(`screen:${other.screenId}`);
        return { detail: screen?.name ?? '', mono: '' };
      }
      return { detail: '', mono: '' };
    }
    default:
      return { detail: '', mono: '' };
  }
}

export function buildPanelSections(node: GraphNode, index: GraphIndex): PanelSection[] {
  const sections = new Map<string, PanelSection>();
  for (const edge of index.edgesByNode.get(node.key) ?? []) {
    const direction: Direction = edge.source === node.key ? 'out' : 'in';
    const otherKey = direction === 'out' ? edge.target : edge.source;
    const other = index.nodesByKey.get(otherKey);
    if (other === undefined) continue;
    const title = SECTION_TITLE[edge.kind][direction];
    const sectionId = edge.kind === 'NAVIGATES_TO' ? 'navigation' : `${edge.kind}:${direction}`;
    const section = sections.get(sectionId) ?? {
      id: sectionId,
      kind: edge.kind,
      direction,
      title,
      items: [],
    };
    const { detail, mono } = edgeDetail(edge, direction, other, index);
    section.items.push({
      id: `${edge.id}:${otherKey}`,
      node: other,
      detail,
      mono,
      description: [detail, mono].filter((part) => part !== '').join(', '),
    });
    sections.set(sectionId, section);
  }
  const order = (section: PanelSection) =>
    SECTION_ORDER.indexOf(section.kind) * 2 + (section.direction === 'out' ? 0 : 1);
  return [...sections.values()].sort((a, b) => order(a) - order(b));
}

/** The text of the tooltip of an edge (frame S-27c): "colUsuarios → gUsuario" and what the edge carries. */
export function edgeTooltip(edge: GraphEdge, index: GraphIndex): { title: string; detail: string } {
  const source = index.nodesByKey.get(edge.source)?.name ?? edge.source;
  const target = index.nodesByKey.get(edge.target)?.name ?? edge.target;
  const parts: string[] = [EDGE_KIND_LABEL[edge.kind]];
  switch (edge.kind) {
    case 'ACCESSES':
      parts.push(ACCESS_MODE_LABEL[edge.accessMode], edge.usedIn);
      break;
    case 'FEEDS':
      parts.push(ASSIGNMENT_FUNCTION_LABEL[edge.assignmentFunction]);
      if (edge.tableFunction !== null) parts.push(edge.tableFunction);
      parts.push(edge.usedIn);
      break;
    case 'CREATES':
      parts.push(ORIGIN_LABEL);
      break;
    default:
      break;
  }
  return { title: `${source} → ${target}`, detail: parts.join(' · ') };
}
