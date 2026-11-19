// ScreenFilters: the filter strip of the screen list (S-18): one centered row of pills on a soft indigo band: the Status
// select (the five statuses, "All" to take it off) and the "Authored by me" toggle (shows a check while on). There is no
// search by name here: the search of the top bar covers it (the `q` parameter of the URL still filters if a link carries
// it). "Clear filters" lives in the header of the list card. Props: params (current filters), setParams (writes the URL). Every control has an accessible name; the changes
// reach the URL, never a local copy.
import { CircleDot, UserRound } from 'lucide-react';

import { FilterSelect, FilterToggle, ICON_STROKE_WIDTH } from '../../components/ui';

import { isApiStatus, STATUS_FILTER_OPTIONS } from './screenLabels';
import type { ScreenListParams } from './useScreenListParams';

interface ScreenFiltersProps {
  params: ScreenListParams;
  setParams: (patch: Partial<ScreenListParams>, options?: { replace?: boolean }) => void;
}

const ICON = { size: 15, strokeWidth: ICON_STROKE_WIDTH } as const;

export function ScreenFilters({ params, setParams }: ScreenFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 border-b border-screen-border/60 bg-screen-soft/50 px-5 py-3">
      <FilterSelect
        label="Status"
        tone="screen"
        icon={<CircleDot {...ICON} />}
        value={params.status}
        onChange={(value) => {
          setParams({ status: isApiStatus(value) ? value : '' });
        }}
      >
        <option value="">All</option>
        {STATUS_FILTER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>
      <FilterToggle
        tone="screen"
        icon={<UserRound {...ICON} />}
        pressed={params.mine}
        onChange={(next) => {
          setParams({ mine: next });
        }}
      >
        Authored by me
      </FilterToggle>
    </div>
  );
}
