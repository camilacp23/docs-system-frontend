// VariableFilters: the filter strip of the variable list (S-10). One centered row of pills on a soft cerulean band: the scope as a
// pill switch (All / Global / Context) and three pill selects (data type, environment, origin screen). A select with a
// value turns cerulean, so the active filters can be seen at a glance. There is no search by name here: the search of the
// top bar covers it (the `q` parameter of the URL still filters if a link carries it). "Clear filters" lives in the header
// of the list card, so this row never changes size. On narrow widths the row wraps.
// Props: params (current filters), setParams (writes the URL), screens (origin screen options). Every control has an
// accessible name; the changes reach the URL, never a local copy.
import { Braces, Monitor, Server } from 'lucide-react';

import { cx, FilterSelect, ICON_STROKE_WIDTH } from '../../components/ui';

import type { VariableListParams } from './useVariableListParams';
import { DATA_TYPES, DATA_TYPE_LABEL, ENVIRONMENTS } from './variableLabels';
import type { DataType, Environment, ScreenSummary, VariableScope } from './variableTypes';

interface VariableFiltersProps {
  params: VariableListParams;
  setParams: (patch: Partial<VariableListParams>, options?: { replace?: boolean }) => void;
  screens: readonly ScreenSummary[];
}

type ScopeTab = VariableScope | 'ALL';

const SCOPE_OPTIONS: readonly { value: ScopeTab; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'GLOBAL', label: 'Global' },
  { value: 'CONTEXT', label: 'Context' },
];

/** The scope as a pill switch: native radios (arrow keys, focus and screen readers as a radio group). */
function ScopeSwitch({ value, onChange }: { value: ScopeTab; onChange: (next: ScopeTab) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Scope"
      className="inline-flex gap-0.5 rounded-pill border border-border-subtle bg-surface p-0.5 shadow-button"
    >
      {SCOPE_OPTIONS.map((option) => (
        <label
          key={option.value}
          className={cx(
            'relative flex h-8 cursor-pointer items-center justify-center rounded-pill px-4 text-label font-semibold whitespace-nowrap transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring motion-reduce:transition-none',
            value === option.value
              ? 'bg-variable text-on-primary shadow-button'
              : 'text-ink-700 hover:bg-variable-soft hover:text-variable-ink',
          )}
        >
          <input
            type="radio"
            name="scope-filter"
            value={option.value}
            checked={value === option.value}
            onChange={() => {
              onChange(option.value);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

const ICON = { size: 15, strokeWidth: ICON_STROKE_WIDTH } as const;

export function VariableFilters({ params, setParams, screens }: VariableFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 border-b border-variable-border/60 bg-variable-soft/40 px-5 py-3">
      <ScopeSwitch
        value={params.scope === '' ? 'ALL' : params.scope}
        onChange={(value) => {
          setParams({ scope: value === 'ALL' ? '' : value });
        }}
      />
      <FilterSelect
        tone="variable"
        label="Data type"
        icon={<Braces {...ICON} />}
        value={params.dataType}
        onChange={(next) => {
          setParams({ dataType: next as DataType | '' });
        }}
      >
        <option value="">All</option>
        {DATA_TYPES.map((type) => (
          <option key={type} value={type}>
            {DATA_TYPE_LABEL[type]}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        tone="variable"
        label="Environment"
        icon={<Server {...ICON} />}
        value={params.environment}
        onChange={(next) => {
          setParams({ environment: next as Environment | '' });
        }}
      >
        <option value="">All</option>
        {ENVIRONMENTS.map((environment) => (
          <option key={environment} value={environment}>
            {environment}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        tone="variable"
        label="Origin screen"
        icon={<Monitor {...ICON} />}
        value={params.originScreenId}
        onChange={(next) => {
          setParams({ originScreenId: next });
        }}
      >
        <option value="">All</option>
        {screens.map((screen) => (
          <option key={screen.id} value={screen.id}>
            {screen.name}
          </option>
        ))}
      </FilterSelect>
    </div>
  );
}
