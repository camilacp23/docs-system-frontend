// CollectionFilters: the filter bar of the collection list (S-14): search by name (the URL changes after the user
// stops typing, useSearchDraft), environment and the "Not linked to any screen" toggle, all in one row (the search is the longest).
// "Clear filters" lives in the header of the list card. Props: params (current filters), setParams (writes the
// URL). Every control has an accessible name; the changes reach the URL, never a local copy.
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
}

export function CollectionFilters({ params, setParams }: CollectionFiltersProps) {
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
          placeholder="Search collections by name…"
          maxLength={100}
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
    </div>
  );
}
