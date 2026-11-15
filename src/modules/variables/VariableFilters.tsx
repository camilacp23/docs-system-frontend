// VariableFilters: the filter bar of the variable list (S-10). One row: the search by name (the longest control; the URL changes after
// the user stops typing, useSearchDraft), scope tabs, data type, environment, origin screen. "Clear filters" lives in the
// header of the list card, so this row never changes size. On narrow widths the row wraps.
// Props: params (current filters), setParams (writes the URL), screens (origin screen options). Every control has an accessible name; the changes reach the URL, never a local copy.
import { Search } from 'lucide-react';
import { useCallback } from 'react';

import { ICON_STROKE_WIDTH, SegmentedControl, Select, TextField } from '../../components/ui';
import { useSearchDraft } from '../../hooks/useSearchDraft';

import type { VariableListParams } from './useVariableListParams';
import { DATA_TYPES, DATA_TYPE_LABEL, ENVIRONMENTS } from './variableLabels';
import type { DataType, Environment, ScreenSummary, VariableScope } from './variableTypes';

interface VariableFiltersProps {
  params: VariableListParams;
  setParams: (patch: Partial<VariableListParams>, options?: { replace?: boolean }) => void;
  screens: readonly ScreenSummary[];
}

type ScopeTab = VariableScope | 'ALL';

export function VariableFilters({ params, setParams, screens }: VariableFiltersProps) {
  const [text, setText] = useSearchDraft(
    params.q,
    useCallback(
      (q: string) => {
        setParams({ q }, { replace: true });
      },
      [setParams],
    ),
  );

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-divider bg-search-bg/60 p-4">
      <div className="min-w-64 flex-1">
        <TextField
          type="search"
          icon={<Search size={16} strokeWidth={ICON_STROKE_WIDTH} />}
          aria-label="Search by name"
          placeholder="Search variables by name…"
          maxLength={100}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      </div>
      <SegmentedControl<ScopeTab>
        name="scope-filter"
        label="Scope"
        value={params.scope === '' ? 'ALL' : params.scope}
        onChange={(value) => {
          setParams({ scope: value === 'ALL' ? '' : value });
        }}
        options={[
          { value: 'ALL', label: 'All' },
          { value: 'GLOBAL', label: 'Global' },
          { value: 'CONTEXT', label: 'Context' },
        ]}
      />
      <Select
        aria-label="Data type"
        className="w-36"
        value={params.dataType}
        onChange={(event) => {
          setParams({ dataType: event.target.value as DataType | '' });
        }}
      >
        <option value="">Data type</option>
        {DATA_TYPES.map((type) => (
          <option key={type} value={type}>
            {DATA_TYPE_LABEL[type]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Environment"
        className="w-36"
        value={params.environment}
        onChange={(event) => {
          setParams({ environment: event.target.value as Environment | '' });
        }}
      >
        <option value="">Environment</option>
        {ENVIRONMENTS.map((environment) => (
          <option key={environment} value={environment}>
            {environment}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Origin screen"
        className="w-40"
        value={params.originScreenId}
        onChange={(event) => {
          setParams({ originScreenId: event.target.value });
        }}
      >
        <option value="">Origin screen</option>
        {screens.map((screen) => (
          <option key={screen.id} value={screen.id}>
            {screen.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
