// MapView: everything the dependency map shows and does once it has a source of data (FR-15, FR-16, NFR-11; frames S-27,
// S-27b, S-27c, S-28): the compact header (the hero of the redesigned pages in coral rose, with "Reset view"), the toolbar, the canvas, the side panel and the states.
// Props: source ({ status, data, error, reload }: the graph, from the API in the page and from test data in /dev/map),
// params / setParams / clearAll / clearFilters / clearFocus (the view, the filters and the focus, see useGraphParams), applicationId (the
// selection belongs to the application it was made in), zoomToKey and zoomLevel (development only: center and zoom on a node
// on load).
// Three views (D-114), each one a scene built from the loaded graph:
//   Screens (default)  only the screens, as cards with counters, joined by their navigation;
//   All elements       every element, the screens as groups that hold their components; past 60 nodes it is not drawn and a
//                      notice offers to filter, switch to the Screens view or pick an element to focus on;
//   focus              one element in the middle, what comes before it on the left and what comes after it on the right.
//                      Clicking a neighbor puts it in the middle; a trail of up to five steps, in memory, goes back. The side
//                      panel shows the element in the middle.
// Hovering, focusing with the keyboard or selecting a node highlights its connections and dims the rest.
// Placement: the scene is built once per answer and view (same data, same ETag: same object, see useDependencyGraph), so
// selecting, hovering, panning, zooming or opening the panel never place the map again.
// States (SDD Table 58): skeleton after 300 ms; "Nothing to map yet" when the application has only App (OnStart); "No
// results" when the filters leave nothing; the failure of the read inside the block with "Try again". An archived
// application is read normally: the page writes nothing.
import { Network, RotateCcw } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ApiError } from '../../api/ApiError';
import { getErrorMessage } from '../../api/messages';
import {
  Banner,
  Button,
  cx,
  EmptyState,
  ICON_STROKE_WIDTH,
  PageHero,
  SegmentedControl,
  Skeleton,
  SLOW_LOADING_MESSAGE,
  useDelayedLoading,
} from '../../components/ui';
import { countText } from '../variables/variableLabels';

import { exceedsAllLimit, buildAllScene, MAX_ALL_NODES } from './allScene';
import { buildFocusScene } from './focusScene';
import { GraphCanvas } from './GraphCanvas';
import { GraphToolbar } from './GraphToolbar';
import {
  isEmptyMap,
  onlyUntraced,
  sceneToFlow,
  type MapFlowEdge,
  type MapFlowNode,
} from './graphModel';
import type { GraphData, GraphNode } from './graphTypes';
import { computeHighlight, DIMMED_OPACITY } from './highlight';
import { HighlightContext, MapActionsContext, nodeButtonId } from './mapContext';
import {
  EMPTY_MAP_TEXT,
  EMPTY_MAP_TITLE,
  FOCUS_PATH_LABEL,
  LOAD_FAILED_LEAD,
  NO_RESULTS_TEXT,
  NO_RESULTS_TITLE,
  SHOW_SCREENS_VIEW,
  TOO_MANY_TITLE,
  tooManyText,
} from './mapTexts';
import { NodePanel } from './NodePanel';
import { indexGraph } from './panelModel';
import { buildScreensScene } from './screensScene';
import type { Scene } from './scene';
import {
  DEPTHS,
  parseFocus,
  type Depth,
  type GraphParams,
  type GraphParamsPatch,
} from './useGraphParams';

const FOCUS_ZOOM = 1;
const NO_COLUMNS: ReadonlySet<string> = new Set();
const MORE_PREFIX = 'more:';
/** How many steps the trail of the focus view keeps. */
export const MAX_TRAIL = 5;

export interface MapSource {
  status: 'loading' | 'ready' | 'error';
  /** The answer of the current request; null while it loads or after a failure. */
  data: GraphData | null;
  error: ApiError | null;
  reload: () => void;
}

export interface MapViewProps {
  source: MapSource;
  params: GraphParams;
  hasFilters: boolean;
  setParams: (patch: GraphParamsPatch) => void;
  clearAll: () => void;
  clearFilters: () => void;
  clearFocus: () => void;
  applicationId: number | null;
  zoomToKey?: string | null;
  zoomLevel?: number;
}

interface TrailEntry {
  key: string;
  name: string;
}

type SceneState = { kind: 'scene'; scene: Scene } | { kind: 'notice'; count: number } | null;

export function MapView({
  source,
  params,
  hasFilters,
  setParams,
  clearAll,
  clearFilters,
  clearFocus,
  applicationId,
  zoomToKey = null,
  zoomLevel = FOCUS_ZOOM,
}: MapViewProps) {
  const { setCenter } = useReactFlow();
  const [selection, setSelection] = useState<{ applicationId: number | null; key: string } | null>(
    null,
  );
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [keyboardKey, setKeyboardKey] = useState<string | null>(null);
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  // The columns of the focus view that were opened with "+N more"; it starts again with every new focus.
  const [opened, setOpened] = useState<{
    focus: string | null;
    columns: ReadonlySet<string>;
    // The column opened or closed last: the view frames it again (see buildFocusScene).
    framed: string | null;
  }>({ focus: null, columns: NO_COLUMNS, framed: null });

  // While another answer is on its way (a filter or the view changed) the map that is on screen stays, a little dimmed, and the new
  // one fades in when it arrives: a soft change instead of an empty canvas and a jump. Only for the same application: the map of
  // another one is never drawn under the selector of this one.
  const answer = source.data;
  const [held, setHeld] = useState<{ applicationId: number | null; data: GraphData } | null>(null);
  if (answer !== null && held?.data !== answer) setHeld({ applicationId, data: answer });
  const stale =
    answer === null &&
    source.status === 'loading' &&
    held !== null &&
    held.applicationId === applicationId;
  const data = stale ? held.data : answer;
  const focus = params.focus;
  const focusKey = focus?.key ?? null;
  const focused = focus !== null;
  const expanded = opened.focus === focusKey ? opened.columns : NO_COLUMNS;
  const framedColumn = opened.focus === focusKey ? opened.framed : null;
  const { showSkeleton, isSlow } = useDelayedLoading(source.status === 'loading');

  // "Show untraced only" is a filter of the All elements view.
  const shown = useMemo<GraphData | null>(
    () =>
      data !== null && params.untraced && !focused && params.view === 'all'
        ? onlyUntraced(data)
        : data,
    [data, params.untraced, params.view, focused],
  );
  const index = useMemo(() => (shown === null ? null : indexGraph(shown)), [shown]);

  const sceneState = useMemo<SceneState>(() => {
    if (shown === null) return null;
    if (focusKey !== null) {
      const scene = buildFocusScene(shown, focusKey, params.depth, expanded, framedColumn);
      return scene === null ? null : { kind: 'scene', scene };
    }
    if (params.view === 'all') {
      return exceedsAllLimit(shown)
        ? { kind: 'notice', count: shown.nodes.length }
        : { kind: 'scene', scene: buildAllScene(shown) };
    }
    return { kind: 'scene', scene: buildScreensScene(shown) };
  }, [shown, focusKey, params.depth, params.view, expanded, framedColumn]);
  const scene = sceneState?.kind === 'scene' ? sceneState.scene : null;
  const flow = useMemo(() => (scene === null ? null : sceneToFlow(scene)), [scene]);
  const sceneKeys = useMemo(() => new Set(scene?.nodes.map((box) => box.key) ?? []), [scene]);

  // In the focus view the panel shows the element in the middle; in the others, the node that was chosen.
  const selectedKey = focused
    ? focusKey
    : selection !== null && selection.applicationId === applicationId
      ? selection.key
      : null;
  const selectedNode = selectedKey === null ? null : (index?.nodesByKey.get(selectedKey) ?? null);

  // What is highlighted: the hovered node, else the one with the keyboard focus, else the selected one.
  const activeKey = hoverKey ?? keyboardKey ?? (focused ? null : selectedKey);
  const highlight = useMemo(
    () => (scene === null ? null : computeHighlight(scene, activeKey)),
    [scene, activeKey],
  );

  const nodes = useMemo<MapFlowNode[]>(() => {
    if (flow === null) return [];
    if (focused || selectedKey === null) return flow.nodes;
    return flow.nodes.map((node) => (node.id === selectedKey ? { ...node, selected: true } : node));
  }, [flow, focused, selectedKey]);
  const edges = useMemo<MapFlowEdge[]>(() => {
    if (flow === null) return [];
    if (highlight === null) return flow.edges;
    return flow.edges.map((edge) =>
      highlight.edges.has(edge.id)
        ? // A highlighted line shows its label, also when it does not touch the focused element.
          edge.data === undefined
          ? edge
          : { ...edge, data: { ...edge.data, labelShown: true } }
        : {
            ...edge,
            style: { ...edge.style, opacity: DIMMED_OPACITY },
          },
    );
  }, [flow, highlight]);

  // The trail: where the focus has been, up to five steps. It lives in memory; a focus reached any other way (a link, the
  // back button) starts a new one.
  const effectiveTrail = useMemo<TrailEntry[]>(() => {
    if (focusKey === null) return [];
    if (trail.at(-1)?.key === focusKey) return trail;
    return [{ key: focusKey, name: index?.nodesByKey.get(focusKey)?.name ?? focusKey }];
  }, [trail, focusKey, index]);

  const centerOn = useCallback(
    (key: string, zoom: number = FOCUS_ZOOM): Promise<boolean> => {
      const box = scene?.nodes.find((candidate) => candidate.key === key);
      if (!scene || !box) return Promise.resolve(false);
      const parent =
        box.parentKey === null
          ? null
          : scene.nodes.find((candidate) => candidate.key === box.parentKey);
      const x = box.x + (parent?.x ?? 0);
      const y = box.y + (parent?.y ?? 0);
      return setCenter(x + box.width / 2, y + box.height / 2, { zoom, duration: 0 });
    },
    [scene, setCenter],
  );

  const focusOn = useCallback(
    (node: GraphNode) => {
      setTrail([{ key: node.key, name: node.name }]);
      setParams({ focus: { type: node.type, id: node.id, key: node.key }, depth: 1 });
    },
    [setParams],
  );

  const recenter = useCallback(
    (node: GraphNode) => {
      setTrail([...effectiveTrail, { key: node.key, name: node.name }].slice(-MAX_TRAIL));
      setParams({ focus: { type: node.type, id: node.id, key: node.key } });
    },
    [effectiveTrail, setParams],
  );

  /** A node was chosen, on the canvas or in the panel: select it, or in the focus view put it in the middle. */
  const activate = useCallback(
    (key: string) => {
      if (key.startsWith(MORE_PREFIX)) {
        // The card "+N more" / "Show fewer": opens or closes the rest of a crowded column.
        const column = key.slice(MORE_PREFIX.length);
        const columns = new Set(expanded);
        if (!columns.delete(column)) columns.add(column);
        setOpened({ focus: focusKey, columns, framed: column });
        return;
      }
      const node = index?.nodesByKey.get(key);
      if (!node) return;
      if (focused) {
        if (key !== focusKey) recenter(node);
        return;
      }
      if (sceneKeys.has(key)) setSelection({ applicationId, key });
      else focusOn(node); // a node this view does not draw: look at it in the focus view
    },
    [index, focused, focusKey, sceneKeys, applicationId, recenter, focusOn, expanded],
  );
  const actions = useMemo(
    () => ({ activate, hover: setHoverKey, focusNode: setKeyboardKey }),
    [activate],
  );

  const pick = (key: string) => {
    activate(key);
    if (!focused && sceneKeys.has(key)) void centerOn(key);
  };

  // Development page only: center and zoom on a node once the map is placed (for the screenshots of the design).
  // Once per focus and view: a later scene (a column opened with "+N more") frames itself, see buildFocusScene.
  const zoomedFor = useRef<string | null>(null);
  useEffect(() => {
    if (zoomToKey === null || scene === null) return;
    const id = `${focusKey ?? ''}|${params.view}|${zoomToKey}`;
    if (zoomedFor.current === id) return;
    // Done only when React Flow moved the view (before it is ready it does not): the effect runs again when it changes.
    void centerOn(zoomToKey, zoomLevel).then((moved) => {
      if (moved) zoomedFor.current = id;
    });
  }, [zoomToKey, zoomLevel, scene, centerOn, focusKey, params.view]);

  const close = () => {
    const key = selectedKey;
    setSelection(null);
    if (key !== null) document.getElementById(nodeButtonId(key))?.focus();
  };

  const goToStep = (position: number) => {
    const entry = effectiveTrail[position];
    const target = entry === undefined ? null : parseFocus(entry.key);
    if (entry === undefined || target === null) return;
    setTrail(effectiveTrail.slice(0, position + 1));
    setParams({ focus: target });
  };

  const focusedNode = focusKey === null ? null : (index?.nodesByKey.get(focusKey) ?? null);
  const appOnly = shown !== null && !hasFilters && !focused && isEmptyMap(shown);
  const drawable = scene !== null && scene.nodes.length > 0 && !appOnly;
  const nothingToDraw = shown !== null && sceneState?.kind !== 'notice' && !drawable;
  const showEmpty = nothingToDraw && !hasFilters && !focused;
  const showNoResults = nothingToDraw && !showEmpty;

  const description =
    shown === null
      ? undefined
      : scene !== null && !focused && params.view === 'screens'
        ? `${countText(scene.nodes.length, 'screen')} · ${countText(
            scene.edges.reduce((sum, line) => sum + line.count, 0),
            'navigation',
          )}`
        : `${countText(shown.nodes.length, 'element')} · ${countText(shown.edges.length, 'relationship')}`;

  return (
    <MapActionsContext.Provider value={actions}>
      <HighlightContext.Provider value={highlight?.nodes ?? null}>
        <PageHero
          tone="map"
          compact
          icon={<Network size={18} strokeWidth={ICON_STROKE_WIDTH} />}
          title="Dependency map"
          description={
            <span key={description ?? ''} className="inline-block motion-safe:animate-fade-in">
              {description ?? 'How the screens, variables and collections depend on each other.'}
            </span>
          }
          className="py-3"
          actions={
            <Button
              size="sm"
              iconLeft={<RotateCcw aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />}
              onClick={() => {
                clearAll();
                setSelection(null);
                setTrail([]);
              }}
            >
              Reset view
            </Button>
          }
        />

        <GraphToolbar
          params={params}
          onChange={setParams}
          nodes={shown?.nodes ?? []}
          selectedKey={selectedKey}
          onPick={pick}
          disabled={shown === null}
          focused={focused}
        />

        {focus !== null && (
          <section
            aria-label="Focus"
            className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-modal border border-info-border bg-info-bg px-4 py-2.5 text-info-ink"
          >
            <div className="flex flex-wrap items-center gap-3 text-body-lg">
              <Network aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
              <span>
                Focused on{' '}
                <span className="font-mono font-semibold">{focusedNode?.name ?? focus.key}</span>
                {' · Depth'}
              </span>
              <SegmentedControl<`${Depth}`>
                name="map-depth"
                label="Depth"
                value={`${params.depth}`}
                options={DEPTHS.map((depth) => ({ value: `${depth}` as const, label: `${depth}` }))}
                onChange={(value) => {
                  setParams({ depth: Number(value) as Depth });
                }}
              />
              {effectiveTrail.length > 1 && (
                <nav aria-label={FOCUS_PATH_LABEL}>
                  <ol className="flex flex-wrap items-center gap-1 text-label">
                    {effectiveTrail.map((entry, position) => {
                      const last = position === effectiveTrail.length - 1;
                      return (
                        <li key={`${entry.key}:${position}`} className="flex items-center gap-1">
                          {position > 0 && <span aria-hidden="true">›</span>}
                          {last ? (
                            <span aria-current="step" className="font-mono font-semibold">
                              {entry.name}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                goToStep(position);
                              }}
                              className="rounded-chip font-mono text-identifier underline hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                            >
                              {entry.name}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setTrail([]);
                clearFocus();
              }}
            >
              Show full map
            </Button>
          </section>
        )}

        <div className="flex min-h-128 flex-1 gap-4">
          <div
            aria-busy={stale}
            className={cx(
              'relative min-w-0 flex-1 overflow-hidden rounded-modal border border-map-border bg-canvas shadow-card transition-opacity duration-200 motion-reduce:transition-none',
              stale && 'opacity-60',
            )}
          >
            {source.status === 'error' && (
              <div className="p-4">
                <Banner
                  tone="danger"
                  lead={LOAD_FAILED_LEAD}
                  actions={
                    <Button size="sm" onClick={source.reload}>
                      Try again
                    </Button>
                  }
                >
                  {source.error
                    ? (getErrorMessage(source.error, { element: 'dependency map' }) ?? '')
                    : ''}
                </Banner>
              </div>
            )}
            {source.status === 'loading' && showSkeleton && data === null && (
              <div role="status" aria-label="Loading" className="flex h-full flex-col gap-3 p-6">
                <Skeleton className="h-24 w-56" />
                <Skeleton className="h-full w-full" />
                {isSlow && <p className="text-body-lg text-ink-500">{SLOW_LOADING_MESSAGE}</p>}
              </div>
            )}
            {sceneState?.kind === 'notice' && (
              <EmptyState
                icon={<Network />}
                title={TOO_MANY_TITLE}
                description={tooManyText(sceneState.count, MAX_ALL_NODES)}
                className="h-full justify-center"
                action={
                  <span className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="primary"
                      onClick={() => {
                        setParams({ view: 'screens' });
                      }}
                    >
                      {SHOW_SCREENS_VIEW}
                    </Button>
                    {hasFilters && <Button onClick={clearFilters}>Clear filters</Button>}
                  </span>
                }
              />
            )}
            {showEmpty && (
              <EmptyState
                icon={<Network />}
                title={EMPTY_MAP_TITLE}
                description={EMPTY_MAP_TEXT}
                className="h-full justify-center"
              />
            )}
            {showNoResults && (
              <EmptyState
                icon={<Network />}
                title={NO_RESULTS_TITLE}
                description={NO_RESULTS_TEXT}
                className="h-full justify-center"
                action={<Button onClick={clearFilters}>Clear filters</Button>}
              />
            )}
            {drawable && index !== null && (
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                bounds={scene.bounds}
                fit={scene.fit}
                layoutKey={scene}
                index={index}
                onPaneClick={() => {
                  setSelection(null);
                }}
              />
            )}
          </div>
          {selectedNode !== null && index !== null && (
            <NodePanel
              node={selectedNode}
              index={index}
              focusedKey={focusKey}
              notDrawn={scene?.undrawn}
              onSelectNode={activate}
              onFocus={focusOn}
              onClose={focused ? undefined : close}
            />
          )}
        </div>
      </HighlightContext.Provider>
    </MapActionsContext.Provider>
  );
}
