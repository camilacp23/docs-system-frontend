// ScreenFilters: the filter bar of the screen list (S-18): search by name (the URL changes after the user stops
// typing, useSearchDraft), the Status select and the "Authored by me" toggle. "Clear filters" lives in the header
// of the list card. Props: params (current filters), setParams (writes the URL). Every control has an accessible
// name; the changes reach the URL, never a local copy.
import { Funnel, Search } from 'lucide-react';
import { useCallback } from 'react';

import { Button, ICON_STROKE_WIDTH, Select, TextField } from '../../components/ui';
import { useSearchDraft } from '../../hooks/useSearchDraft';

import { isApiStatus, STATUS_FILTER_OPTIONS } from './screenLabels';
import type { ScreenListParams } from './useScreenListParams';

interface ScreenFiltersProps {
  params: ScreenListParams;
  setParams: (patch: Partial<ScreenListParams>, options?: { replace?: boolean }) => void;
}

export function ScreenFilters({ params, setParams }: ScreenFiltersProps) {
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
          placeholder="Search screens by name…"
          maxLength={100}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      </div>
      <Select
        aria-label="Status"
        className="w-44"
        value={params.status}
        onChange={(event) => {
          const value = event.target.value;
          setParams({ status: isApiStatus(value) ? value : '' });
        }}
      >
        <option value="">Status</option>
        {STATUS_FILTER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Button
        aria-pressed={params.mine}
        iconLeft={<Funnel aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        onClick={() => {
          setParams({ mine: !params.mine });
        }}
      >
        Authored by me
      </Button>
    </div>
  );
}
