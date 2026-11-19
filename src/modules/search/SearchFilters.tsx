// SearchFilters: what narrows the advanced search besides the text (S-29), on a soft band under the text box: the pills of
// the element types with their totals, and the three filters (Environment, Status, Scope) as pill selects, with one note
// saying which types each one applies to. (The "Clear all" button is in the hero of the page.)
// Props: params, setParams, totals (one reading per type), searching (false while nothing is asked: the totals show "—").
// Layout: Types and Filters, each with its title at the left, in one line when the card is wide enough (about 1290 px, e.g.
// with the sidebar collapsed) and in two rows, the pills aligned, when it is not; the note goes under them.
// Types: "All" clears the selection of types; each type is a toggle button (aria-pressed) in the color of its type and
// several can be on. The number of a pill is the total of ITS type with the text and the filters, whatever types are
// selected; "All" is the sum of the four ("—" while it is not known). The filters restrict only the types they apply to
// (D-48): the note says so, and the other types stay in the results and in the totals.
import { Info, Layers3, ShieldCheck } from 'lucide-react';
import { CircleDot, Server } from 'lucide-react';

import { FilterSelect, ICON_STROKE_WIDTH, Skeleton, cx } from '../../components/ui';
import type { ApiResource } from '../../api/useApiResource';

import { STATUS_FILTER_OPTIONS, isApiStatus } from '../screens/screenLabels';
import { SCOPE_LABEL } from '../variables/variableLabels';

import {
  FILTER_NOTE,
  NOTE_ENVIRONMENT,
  NOTE_SCOPE,
  NOTE_STATUS,
  TYPE_PLURAL,
} from './searchLabels';
import { SEARCH_ENVIRONMENTS, SEARCH_TYPES, type SearchElementType } from './searchTypes';
import { sumOfTotals, type SearchTotals } from './useSearchResults';
import type { SearchListParams } from './useSearchListParams';

interface SearchFiltersProps {
  params: SearchListParams;
  setParams: (patch: Partial<SearchListParams>) => void;
  totals: SearchTotals;
  searching: boolean;
}

function CountText({ resource, searching }: { resource: ApiResource<number>; searching: boolean }) {
  if (!searching || resource.status === 'error') return <span>—</span>;
  if (resource.status === 'loading') return <Skeleton className="h-3.5 w-4" />;
  return <span>{resource.data}</span>;
}

const PILL_CLASS =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-pill border px-3 text-label font-semibold shadow-button transition-colors duration-150 motion-reduce:transition-none';

/** The color of each type when its pill is on (the same as its module), written out so Tailwind finds the classes. */
const TYPE_ON: Record<SearchElementType | 'ALL', string> = {
  ALL: 'border-find bg-find-soft text-find-ink',
  SCREEN: 'border-screen bg-screen-soft text-screen-ink',
  VARIABLE: 'border-variable bg-variable-soft text-variable-ink',
  COLLECTION: 'border-collection bg-collection-soft text-collection-ink',
  COMPONENT: 'border-primary bg-empty-icon-bg text-primary',
};

function pillClass(pressed: boolean, type: SearchElementType | 'ALL'): string {
  return cx(
    PILL_CLASS,
    pressed
      ? TYPE_ON[type]
      : 'border-border-subtle bg-surface text-ink-700 hover:border-find-border hover:bg-find-soft',
  );
}

const ICON = { size: 15, strokeWidth: ICON_STROKE_WIDTH } as const;

export function SearchFilters({ params, setParams, totals, searching }: SearchFiltersProps) {
  const all = sumOfTotals(totals);
  const toggle = (type: SearchElementType) => {
    const next = params.types.includes(type)
      ? params.types.filter((chosen) => chosen !== type)
      : [...params.types, type];
    setParams({ types: next });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-find-border/60 bg-find-soft/40 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="w-12 shrink-0 text-micro font-bold tracking-wider text-find-ink uppercase">
            Types
          </span>
          <div
            role="group"
            aria-label="Element types"
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              aria-pressed={params.types.length === 0}
              className={pillClass(params.types.length === 0, 'ALL')}
              onClick={() => {
                setParams({ types: [] });
              }}
            >
              <Layers3 aria-hidden="true" {...ICON} />
              <span>All</span>{' '}
              <span className="font-normal opacity-75">
                {searching && all !== null ? all : '—'}
              </span>
            </button>
            {SEARCH_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={params.types.includes(type)}
                className={pillClass(params.types.includes(type), type)}
                onClick={() => {
                  toggle(type);
                }}
              >
                <span>{TYPE_PLURAL[type]}</span>{' '}
                <span className="font-normal opacity-75">
                  <CountText resource={totals[type]} searching={searching} />
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="w-12 shrink-0 text-micro font-bold tracking-wider text-find-ink uppercase">
            Filters
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            <FilterSelect
              label="Environment"
              tone="find"
              description={NOTE_ENVIRONMENT}
              icon={<Server aria-hidden="true" {...ICON} />}
              value={params.environment}
              onChange={(value) => {
                setParams({ environment: SEARCH_ENVIRONMENTS.find((env) => env === value) ?? '' });
              }}
            >
              <option value="">Any</option>
              {SEARCH_ENVIRONMENTS.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Status"
              tone="find"
              description={NOTE_STATUS}
              icon={<CircleDot aria-hidden="true" {...ICON} />}
              value={params.status}
              onChange={(value) => {
                setParams({ status: isApiStatus(value) ? value : '' });
              }}
            >
              <option value="">Any</option>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Scope"
              tone="find"
              description={NOTE_SCOPE}
              icon={<ShieldCheck aria-hidden="true" {...ICON} />}
              value={params.scope}
              onChange={(value) => {
                setParams({ scope: value === 'GLOBAL' || value === 'CONTEXT' ? value : '' });
              }}
            >
              <option value="">Any</option>
              <option value="GLOBAL">{SCOPE_LABEL.GLOBAL}</option>
              <option value="CONTEXT">{SCOPE_LABEL.CONTEXT}</option>
            </FilterSelect>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-small text-ink-500">
        <Info aria-hidden="true" size={13} strokeWidth={ICON_STROKE_WIDTH} className="shrink-0" />
        {FILTER_NOTE}
      </p>
    </div>
  );
}
