// GraphToolbar: the filter strip of the map (frame S-27), in the look of the other pages: one slim row of pills on a soft band, so the map
// keeps almost all the height of the page. In order: WHAT IS DRAWN (the view and the element types), HOW IT IS NARROWED (the
// environment and the untraced filter) and the search at the end. It is one row on a wide page (the search takes the room that is left) and wraps on a narrow one.
// Props: params (the filters of the URL), onChange(patch), nodes (the nodes of the graph shown, for the search), selectedKey,
// onPick(key) (a node was chosen in the search), disabled (the graph is not loaded), focused (the map shows the neighborhood of a node:
// the filters do not apply, the contract takes none there).
// Controls: the view ("Screens", the default, or "All elements") as a pill switch, one checkbox pill per node type (tinted and bold while on; the last one
// cannot be cleared: an empty list would mean every type), the environment and "Show untraced only" (a filter of the client). The type and untraced filters belong to the All elements view: the Screens view needs every type for its
// counters. A control that does not apply says why. "Find a node…" (NodeFinder) is the keyboard alternative to the canvas: it lists the nodes
// by name and choosing one selects it, centers it and opens its panel. "Reset view" lives in the header of the page (MapView).
import { Filter, Search, Server } from 'lucide-react';
import { useMemo } from 'react';

import {
  FilterSelect,
  FilterToggle,
  ICON_STROKE_WIDTH,
  PillSwitch,
  SearchPicker,
  cx,
  type SearchPickerOption,
} from '../../components/ui';

import { NODE_TYPE_LABEL, NODE_TYPE_PLURAL_LABEL } from './graphLabels';
import { NODE_TYPES, type GraphNode, type Environment, type NodeType } from './graphTypes';
import { ALL_VIEW_ONLY_REASON, FOCUSED_FILTERS_REASON, VIEW_LABEL } from './mapTexts';
import type { GraphParams, GraphParamsPatch, View } from './useGraphParams';

interface GraphToolbarProps {
  params: GraphParams;
  onChange: (patch: GraphParamsPatch) => void;
  nodes: readonly GraphNode[];
  selectedKey: string | null;
  onPick: (key: string) => void;
  disabled: boolean;
  focused: boolean;
}

const VIEW_OPTIONS: readonly { value: View; label: string }[] = [
  { value: 'screens', label: VIEW_LABEL.screens },
  { value: 'all', label: VIEW_LABEL.all },
];

/** A node type as a pill with a native checkbox inside (keyboard, focus and screen readers as a checkbox). */
function TypePill({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cx(
        'relative flex h-8 items-center gap-1.5 rounded-pill border px-2.5 text-label font-semibold whitespace-nowrap transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring motion-reduce:transition-none',
        checked
          ? 'border-map bg-map-soft font-bold text-map-ink'
          : 'border-border-subtle bg-surface text-ink-700 hover:border-map-border hover:bg-map-soft',
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="absolute inset-0 size-full cursor-[inherit] opacity-0"
      />
      {label}
    </label>
  );
}

/** "Find a node…": the keyboard alternative to the canvas, a search pill at the end of the second row of the toolbar. */
export function NodeFinder({
  nodes,
  selectedKey,
  onPick,
  disabled,
}: {
  nodes: readonly GraphNode[];
  selectedKey: string | null;
  onPick: (key: string) => void;
  disabled: boolean;
}) {
  const options = useMemo<SearchPickerOption[]>(
    () =>
      nodes.map((node) => ({
        value: node.key,
        label: node.name,
        detail: NODE_TYPE_LABEL[node.type],
      })),
    [nodes],
  );
  return (
    <div className="min-w-36 flex-1">
      <SearchPicker
        aria-label="Find a node"
        placeholder="Find a node…"
        options={options}
        value={selectedKey ?? ''}
        onChange={onPick}
        disabled={disabled}
        mono
        pill
        tone="map"
        chevron={false}
        icon={<Search size={15} strokeWidth={ICON_STROKE_WIDTH} />}
      />
    </div>
  );
}

export function GraphToolbar({
  params,
  onChange,
  nodes,
  selectedKey,
  onPick,
  disabled,
  focused,
}: GraphToolbarProps) {
  const toggleType = (type: NodeType, checked: boolean) => {
    const next = checked
      ? NODE_TYPES.filter((candidate) => candidate === type || params.types.includes(candidate))
      : params.types.filter((candidate) => candidate !== type);
    if (next.length > 0) onChange({ types: next });
  };
  const inScreens = params.view === 'screens';
  const environmentDisabled = disabled || focused;
  const allViewDisabled = disabled || focused || inScreens;
  const allViewReason = focused
    ? FOCUSED_FILTERS_REASON
    : inScreens
      ? ALL_VIEW_ONLY_REASON
      : undefined;
  const onlyOne = params.types.length === 1;

  return (
    <section
      aria-label="Map filters"
      className="flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-2 rounded-modal border border-map-border bg-map-soft/40 px-3.5 py-2.5 shadow-card"
    >
      <PillSwitch<View>
        name="map-view"
        label="View"
        tone="map"
        value={params.view}
        disabled={disabled}
        options={VIEW_OPTIONS}
        onChange={(view) => {
          // Choosing a view leaves the focus: the focus is a view of its own.
          onChange({ view, focus: null });
        }}
      />
      <fieldset title={allViewReason} className="flex flex-wrap items-center gap-1">
        <legend className="sr-only">Element types</legend>
        {NODE_TYPES.map((type) => {
          const checked = params.types.includes(type);
          return (
            <TypePill
              key={type}
              label={NODE_TYPE_PLURAL_LABEL[type]}
              checked={checked}
              disabled={allViewDisabled || (checked && onlyOne)}
              onChange={(next) => {
                toggleType(type, next);
              }}
            />
          );
        })}
      </fieldset>
      <FilterSelect
        tone="map"
        label="Environment"
        caption="Env"
        icon={<Server size={15} strokeWidth={ICON_STROKE_WIDTH} />}
        value={params.environment}
        disabled={environmentDisabled}
        title={focused ? FOCUSED_FILTERS_REASON : undefined}
        onChange={(next) => {
          onChange({ environment: next as Environment | '' });
        }}
      >
        <option value="">Any</option>
        <option value="DEV">DEV</option>
        <option value="PROD">PROD</option>
      </FilterSelect>
      <FilterToggle
        tone="map"
        pressed={params.untraced}
        disabled={allViewDisabled}
        title={allViewReason}
        ariaLabel="Show untraced only"
        icon={<Filter size={14} strokeWidth={ICON_STROKE_WIDTH} />}
        onChange={(next) => {
          onChange({ untraced: next });
        }}
      >
        Untraced only
      </FilterToggle>
      <NodeFinder nodes={nodes} selectedKey={selectedKey} onPick={onPick} disabled={disabled} />
    </section>
  );
}
