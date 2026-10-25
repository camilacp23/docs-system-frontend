// CollectionFilters: the filter bar of the collection list (S-14): search by name (the URL changes after the user
// stops typing, useSearchDraft), environment and the "Not linked to any screen" toggle, and "Clear filters" when any
// is set. Props: params (current filters), setParams (writes the URL), hasFilters, onClear. Every control has an
// accessible name; the changes reach the URL, never a local copy.
import { Funnel, Search } from 'lucide-react';
import { useCallback } from 'react';

import { Button, ICON_STROKE_WIDTH, Select, TextField } from '../../components/ui';
import { useSearchDraft } from '../../hooks/useSearchDraft';
import { ENVIRONMENTS } from '../variables/variableLabels';
import type { Environment } from '../variables/variableTypes';

import type { CollectionListParams } from './useCollectionListParams';

interface CollectionFiltersProps {
  params: CollectionListParams;
  setParams: (patch: Partial<CollectionListParams>, options?: { replace?: boolean }) => void;
  hasFilters: boolean;
  onClear: () => void;
}

export function CollectionFilters({
  params,
  setParams,
  hasFilters,
  onClear,
}: CollectionFiltersProps) {
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
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="relative w-65">
        <Search
          aria-hidden="true"
          size={16}
          strokeWidth={ICON_STROKE_WIDTH}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-500"
        />
        <TextField
          type="search"
          aria-label="Search by name"
          placeholder="Search by name…"
          maxLength={100}
          className="pl-9"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      </div>
      <Select
        aria-label="Environment"
        className="w-40"
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
      <Button
        aria-pressed={params.undocumented}
        iconLeft={<Funnel aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        onClick={() => {
          setParams({ undocumented: !params.undocumented });
        }}
      >
        Not linked to any screen
      </Button>
      {hasFilters && (
        <Button variant="ghost" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
