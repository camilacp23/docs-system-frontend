// DependencyMapPage: /dependency-map (FR-15, FR-16, NFR-11; frames S-27, S-27b, S-27c, S-28). Loaded lazily (React.lazy),
// so React Flow and dagre are not part of the main bundle.
// The graph of the selected application (GET /dependencies/graph) drawn with React Flow; the filters (types,
// environment, untraced) and the focus on a node with its depth (GET /dependencies/{type}/{id}) live in the URL. The
// side panel of the selected node (kept in the page, not in the URL) lists its connections and links to its page.
// "Find a node…" is the keyboard alternative to the canvas. Changing the application in the sidebar reloads the map and
// drops the focus (the focused element belongs to the other application, D-78).
// Placement: computeLayout runs once per answer (same data, same ETag: same object, see useDependencyGraph), so
// selecting, panning, zooming or opening the panel never places the map again.
// States (SDD Table 58): skeleton after 300 ms; "Nothing to map yet" when the application has only App (OnStart); "No
// results" when the filters leave nothing; the failure of the read inside the block with "Try again"; "doesn't
// exist" for an unknown application or element (S-41a). An archived application is read normally: the page writes nothing.
import { Network } from 'lucide-react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { getErrorMessage } from '../../api/messages';
import { useApplication } from '../../application/useApplication';
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHeader,
  SegmentedControl,
  Skeleton,
  SLOW_LOADING_MESSAGE,
  useDelayedLoading,
} from '../../components/ui';
import { countText } from '../variables/variableLabels';

import { GraphCanvas } from './GraphCanvas';
import { GraphToolbar } from './GraphToolbar';
import { isEmptyMap, onlyUntraced, toFlowGraph, type MapFlowNode } from './graphModel';
import type { GraphData, GraphNode } from './graphTypes';
import { computeLayout, NODE_SIZE } from './layout';
import { MapActionsContext, nodeButtonId } from './mapContext';
import {
  EMPTY_MAP_TEXT,
  EMPTY_MAP_TITLE,
  LOAD_FAILED_LEAD,
  NO_RESULTS_TEXT,
  NO_RESULTS_TITLE,
} from './mapTexts';
import { NodePanel } from './NodePanel';
import { indexGraph } from './panelModel';
import { DEPTHS, useGraphParams, type Depth } from './useGraphParams';
import { useDependencyGraph } from './useDependencyGraph';

const FOCUS_ZOOM = 1;

function MapContent() {
  const navigate = useNavigate();
  const { currentApplicationId } = useApplication();
  const { params, setParams, clearAll, clearFocus, hasFilters } = useGraphParams();
  const { setCenter } = useReactFlow();
  const [selection, setSelection] = useState<{ applicationId: number | null; key: string } | null>(
    null,
  );
  const selectedKey =
    selection !== null && selection.applicationId === currentApplicationId ? selection.key : null;

  // The selected application changed from the sidebar: the focus belongs to the other application, so it goes (the
  // selection already ignores it: it is tied to the application it was made in).
  const previousApplication = useRef(currentApplicationId);
  useEffect(() => {
    if (previousApplication.current !== currentApplicationId) {
      if (previousApplication.current !== null) clearFocus();
      previousApplication.current = currentApplicationId;
    }
  }, [currentApplicationId, clearFocus]);

  const { resource, data } = useDependencyGraph({ applicationId: currentApplicationId, params });
  const focused = params.focus !== null;
  const { showSkeleton, isSlow } = useDelayedLoading(resource.loading);

  const shown = useMemo<GraphData | null>(
    () => (data !== null && params.untraced && !focused ? onlyUntraced(data) : data),
    [data, params.untraced, focused],
  );
  const index = useMemo(() => (shown === null ? null : indexGraph(shown)), [shown]);
  const layout = useMemo(() => (shown === null ? null : computeLayout(shown)), [shown]);
  const flow = useMemo(
    () => (shown === null || layout === null ? null : toFlowGraph(shown, layout.positions)),
    [shown, layout],
  );
  const nodes = useMemo<MapFlowNode[]>(() => {
    if (flow === null) return [];
    if (selectedKey === null) return flow.nodes;
    return flow.nodes.map((node) => (node.id === selectedKey ? { ...node, selected: true } : node));
  }, [flow, selectedKey]);

  const selectedNode = selectedKey === null ? null : (index?.nodesByKey.get(selectedKey) ?? null);

  const select = useCallback(
    (key: string) => {
      setSelection({ applicationId: currentApplicationId, key });
    },
    [currentApplicationId],
  );
  const actions = useMemo(() => ({ select }), [select]);

  const pick = (key: string) => {
    select(key);
    const node = index?.nodesByKey.get(key);
    const position = layout?.positions.get(key);
    if (node && position) {
      const size = NODE_SIZE[node.type];
      void setCenter(position.x + size.width / 2, position.y + size.height / 2, {
        zoom: FOCUS_ZOOM,
        duration: 0,
      });
    }
  };

  const close = () => {
    const key = selectedKey;
    setSelection(null);
    if (key !== null) document.getElementById(nodeButtonId(key))?.focus();
  };

  const focusOn = (node: GraphNode) => {
    setParams({ focus: { type: node.type, id: node.id, key: node.key }, depth: 1 });
  };

  if (resource.error?.code === 'NOT_FOUND') {
    return focused ? (
      <ErrorState
        variant="not-found"
        element="element"
        listLabel="Dependency map"
        className="flex-1"
        onAction={clearFocus}
      />
    ) : (
      <ErrorState
        variant="not-found"
        element="application"
        listLabel="Dashboard"
        className="flex-1"
        onAction={() => {
          void navigate('/dashboard');
        }}
      />
    );
  }

  const focusedNode =
    params.focus === null ? null : (index?.nodesByKey.get(params.focus.key) ?? null);
  const empty = shown !== null && !hasFilters && !focused && isEmptyMap(shown);
  const noResults = shown !== null && shown.nodes.length === 0 && (hasFilters || focused);

  return (
    <MapActionsContext.Provider value={actions}>
      <PageHeader
        icon={<Network size={20} strokeWidth={ICON_STROKE_WIDTH} />}
        title="Dependency map"
        description={
          shown === null
            ? undefined
            : `${countText(shown.nodes.length, 'element')} · ${countText(shown.edges.length, 'relationship')}`
        }
      />

      <GraphToolbar
        params={params}
        onChange={setParams}
        nodes={shown?.nodes ?? []}
        selectedKey={selectedKey}
        onPick={pick}
        onReset={() => {
          clearAll();
          setSelection(null);
        }}
        disabled={shown === null}
        focused={focused}
      />

      {params.focus !== null && (
        <section
          aria-label="Focus"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-info-border bg-info-bg px-4 py-2.5 text-info-ink"
        >
          <div className="flex flex-wrap items-center gap-3 text-body-lg">
            <Network aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
            <span>
              Focused on{' '}
              <span className="font-mono font-semibold">
                {focusedNode?.name ?? params.focus.key}
              </span>
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
          </div>
          <Button variant="ghost" onClick={clearFocus}>
            Show full map
          </Button>
        </section>
      )}

      <div className="flex min-h-128 flex-1 gap-4">
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-card border border-border-subtle bg-canvas">
          {resource.status === 'error' && (
            <div className="p-4">
              <Banner
                tone="danger"
                lead={LOAD_FAILED_LEAD}
                actions={
                  <Button size="sm" onClick={resource.reload}>
                    Try again
                  </Button>
                }
              >
                {resource.error
                  ? (getErrorMessage(resource.error, { element: 'dependency map' }) ?? '')
                  : ''}
              </Banner>
            </div>
          )}
          {resource.loading && showSkeleton && (
            <div role="status" aria-label="Loading" className="flex h-full flex-col gap-3 p-6">
              <Skeleton className="h-24 w-56" />
              <Skeleton className="h-full w-full" />
              {isSlow && <p className="text-body-lg text-ink-500">{SLOW_LOADING_MESSAGE}</p>}
            </div>
          )}
          {empty && (
            <EmptyState
              icon={<Network />}
              title={EMPTY_MAP_TITLE}
              description={EMPTY_MAP_TEXT}
              className="h-full justify-center"
            />
          )}
          {noResults && (
            <EmptyState
              icon={<Network />}
              title={NO_RESULTS_TITLE}
              description={NO_RESULTS_TEXT}
              className="h-full justify-center"
              action={
                <Button
                  onClick={() => {
                    clearAll();
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )}
          {shown !== null && index !== null && !empty && !noResults && (
            <GraphCanvas
              nodes={nodes}
              edges={flow?.edges ?? []}
              layoutKey={layout}
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
            focusedKey={params.focus?.key ?? null}
            onSelectNode={select}
            onFocus={focusOn}
            onClose={close}
          />
        )}
      </div>
    </MapActionsContext.Provider>
  );
}

export function DependencyMapPage() {
  return (
    <ReactFlowProvider>
      <MapContent />
    </ReactFlowProvider>
  );
}
