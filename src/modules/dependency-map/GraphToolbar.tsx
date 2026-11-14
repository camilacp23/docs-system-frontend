// GraphToolbar: the filter bar of the map (frame S-27).
// Props: params (the filters of the URL), onChange(patch), nodes (the nodes of the graph shown, for the search), selectedKey,
// onPick(key) (a node was chosen in the search), onReset, disabled (the graph is not loaded), focused (the map shows
// the neighborhood of a node: the filters do not apply, the contract takes none there).
// Controls: the view ("Screens", the default, or "All elements"), one checkbox per node type (the last one cannot be
// cleared: an empty list would mean every type), the environment, "Find a node…" (the keyboard alternative to the canvas: it
// lists the nodes by name and choosing one selects it, centers it and opens its panel), "Show untraced only" (a filter of the
// client) and "Reset view" (at the end of the same row). The type and untraced filters belong to the All elements view: the Screens view needs every type
// for its counters. A control that does not apply says why.
import { Filter } from 'lucide-react';
import { useMemo } from 'react';

import {
  Button,
  Checkbox,
  ICON_STROKE_WIDTH,
  SearchPicker,
  SegmentedControl,
  Select,
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
  onReset: () => void;
  disabled: boolean;
  focused: boolean;
}

export function GraphToolbar({
  params,
  onChange,
  nodes,
  selectedKey,
  onPick,
  onReset,
  disabled,
  focused,
}: GraphToolbarProps) {
  const options = useMemo<SearchPickerOption[]>(
    () =>
      nodes.map((node) => ({
        value: node.key,
        label: node.name,
        detail: NODE_TYPE_LABEL[node.type],
      })),
    [nodes],
  );
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
      className="flex flex-col gap-2 rounded-card border border-border-subtle bg-surface px-4 py-3 shadow-card"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <SegmentedControl<View>
          name="map-view"
          label="View"
          value={params.view}
          disabled={disabled}
          options={[
            { value: 'screens', label: VIEW_LABEL.screens },
            { value: 'all', label: VIEW_LABEL.all },
          ]}
          onChange={(view) => {
            // Choosing a view leaves the focus: the focus is a view of its own.
            onChange({ view, focus: null });
          }}
        />
        <fieldset title={allViewReason} className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <legend className="sr-only">Element types</legend>
          {NODE_TYPES.map((type) => {
            const checked = params.types.includes(type);
            return (
              <Checkbox
                key={type}
                label={NODE_TYPE_PLURAL_LABEL[type]}
                checked={checked}
                disabled={allViewDisabled || (checked && onlyOne)}
                onChange={(event) => {
                  toggleType(type, event.target.checked);
                }}
              />
            );
          })}
        </fieldset>
        <div className="w-44" title={focused ? FOCUSED_FILTERS_REASON : undefined}>
          <Select
            aria-label="Environment"
            value={params.environment}
            disabled={environmentDisabled}
            onChange={(event) => {
              onChange({ environment: event.target.value as Environment | '' });
            }}
          >
            <option value="">Environment: Any</option>
            <option value="DEV">Environment: DEV</option>
            <option value="PROD">Environment: PROD</option>
          </Select>
        </div>
        <div className="w-60">
          <SearchPicker
            aria-label="Find a node"
            placeholder="Find a node…"
            options={options}
            value={selectedKey ?? ''}
            onChange={onPick}
            disabled={disabled}
            mono
          />
        </div>
        <Button
          aria-pressed={params.untraced}
          disabled={allViewDisabled}
          title={allViewReason}
          className={
            params.untraced ? '!border-accent !bg-accent-soft !text-accent-ink' : undefined
          }
          iconLeft={<Filter aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />}
          onClick={() => {
            onChange({ untraced: !params.untraced });
          }}
        >
          Show untraced only
        </Button>
        <Button variant="ghost" onClick={onReset} className="ml-auto">
          Reset view
        </Button>
      </div>
    </section>
  );
}
