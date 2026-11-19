// ApplicationFilters: the filter strip of the application list (S-07), in the look of the lists of Variables and Users: one
// centered row of pills on a soft green band. The search by name (the URL changes after the user stops typing,
// useSearchDraft) and the status as a pill select ("All" by default; it turns green when it is not).
// Props: params (current filters), setParams (writes the URL). Every control has an accessible name.
import { CircleDot, Search } from 'lucide-react';
import { useCallback } from 'react';

import { FilterSelect, ICON_STROKE_WIDTH, cx } from '../../components/ui';
import { useSearchDraft } from '../../hooks/useSearchDraft';

import type { ApplicationStatus } from './applicationLabels';
import type { ApplicationListParams } from './useApplicationListParams';

interface ApplicationFiltersProps {
  params: ApplicationListParams;
  setParams: (patch: Partial<ApplicationListParams>, options?: { replace?: boolean }) => void;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: ApplicationStatus | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const ICON = { size: 15, strokeWidth: ICON_STROKE_WIDTH } as const;

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
    <div className="flex flex-wrap items-center justify-center gap-2.5 border-b border-apps-border/60 bg-apps-soft/40 px-5 py-3">
      <label
        className={cx(
          'flex h-9 min-w-64 flex-1 items-center gap-2 rounded-pill border bg-surface pr-3.5 pl-3.5 text-ink-700 shadow-button transition-colors duration-150 motion-reduce:transition-none',
          text !== ''
            ? 'border-apps bg-apps-soft text-apps-ink'
            : 'border-border-subtle focus-within:border-apps focus-within:bg-apps-soft hover:border-apps-border hover:bg-apps-soft',
        )}
      >
        <Search aria-hidden="true" {...ICON} className="shrink-0" />
        <input
          type="search"
          aria-label="Search applications"
          placeholder="Search applications…"
          maxLength={100}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          className="min-w-0 flex-1 bg-transparent text-label font-semibold outline-none placeholder:font-medium placeholder:text-ink-500"
        />
      </label>
      <FilterSelect
        tone="apps"
        label="Status"
        icon={<CircleDot {...ICON} />}
        value={params.status}
        onChange={(next) => {
          setParams({ status: next as ApplicationStatus | '' });
        }}
        selectClassName="max-w-40"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>
    </div>
  );
}
