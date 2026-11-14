// MapView: everything the dependency map shows and does once it has a source of data (FR-15, FR-16, NFR-11; frames S-27,
// S-27b, S-27c, S-28): the header, the toolbar, the canvas, the side panel and the states.
// Props: source ({ status, data, error, reload }: the graph, from the API in the page and from test data in /dev/map),
// params / setParams / clearAll / clearFocus (the filters and the focus, see useGraphParams), applicationId (the
// selection belongs to the application it was made in), zoomToKey (development only: center and zoom on a node on load).
// Placement: the layout runs once per answer (same data, same ETag: same object, see useDependencyGraph), so selecting,
// panning, zooming or opening the panel never places the map again.
// States (SDD Table 58): skeleton after 300 ms; "Nothing to map yet" when the application has only App (OnStart); "No
// results" when the filters leave nothing; the failure of the read inside the block with "Try again". An archived
// application is read normally: the page writes nothing.
import { Network } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ApiError } from '../../api/ApiError';
import { getErrorMessage } from '../../api/messages';
import {
  Banner,
  Button,
  EmptyState,
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
import { DEPTHS, type Depth, type GraphParams, type GraphParamsPatch } from './useGraphParams';

const FOCUS_ZOOM = 1;

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
  clearFocus: () => void;
  applicationId: number | null;
  zoomToKey?: string | null;
}

export function MapView({
  source,
  params,
  hasFilters,
  setParams,
  clearAll,
  clearFocus,
  applicationId,
  zoomToKey = null,
}: MapViewProps) {
  const { setCenter } = useReactFlow();
  const [selection, setSelection] = useState<{ applicationId: number | null; key: string } | null>(
    null,
  );
  const selectedKey =
    selection !== null && selection.applicationId === applicationId ? selection.key : null;

  const data = source.data;
  const focused = params.focus !== null;
  const { showSkeleton, isSlow } = useDelayedLoading(source.status === 'loading');

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
      setSelection({ applicationId, key });
    },
    [applicationId],
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

  // Development page only: center and zoom on a node once the map is placed (for the screenshots of the design).
  useEffect(() => {
    if (zoomToKey === null || layout === null) return;
    const node = index?.nodesByKey.get(zoomToKey);
    const position = layout.positions.get(zoomToKey);
    if (node && position) {
      const size = NODE_SIZE[node.type];
      void setCenter(position.x + size.width / 2, position.y + size.height / 2, {
        zoom: FOCUS_ZOOM,
        duration: 0,
      });
    }
  }, [zoomToKey, layout, index, setCenter]);

  const close = () => {
    const key = selectedKey;
    setSelection(null);
    if (key !== null) document.getElementById(nodeButtonId(key))?.focus();
  };

  const focusOn = (node: GraphNode) => {
    setParams({ focus: { type: node.type, id: node.id, key: node.key }, depth: 1 });
  };

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
          {source.status === 'loading' && showSkeleton && (
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
