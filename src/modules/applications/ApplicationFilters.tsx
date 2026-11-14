// ApplicationFilters: the filter bar of the application list (S-07): search by name (the URL changes after the user
// stops typing, useSearchDraft) and the status ("Status: All" by default).
// Props: params (current filters), setParams (writes the URL). Every control has an accessible name.
import { Search } from 'lucide-react';
import { useCallback } from 'react';

import { ICON_STROKE_WIDTH, Select, TextField } from '../../components/ui';
import { useSearchDraft } from '../../hooks/useSearchDraft';

import type { ApplicationStatus } from './applicationLabels';
import type { ApplicationListParams } from './useApplicationListParams';

interface ApplicationFiltersProps {
  params: ApplicationListParams;
  setParams: (patch: Partial<ApplicationListParams>, options?: { replace?: boolean }) => void;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: ApplicationStatus | ''; label: string }> = [
  { value: '', label: 'Status: All' },
  { value: 'ACTIVE', label: 'Status: Active' },
  { value: 'ARCHIVED', label: 'Status: Archived' },
];

export function ApplicationFilters({ params, setParams }: ApplicationFiltersProps) {
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
          aria-label="Search applications"
          placeholder="Search applications…"
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
          setParams({ status: event.target.value as ApplicationStatus | '' });
        }}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
