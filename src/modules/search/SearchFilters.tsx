// SearchFilters: what narrows the advanced search besides the text (S-29): the chips of the element types with their
// totals, and the three filters (Environment, Status, Scope) as native selects with a note saying which types each one
// applies to. "Clear all" removes the text and everything chosen.
// Props: params, setParams, totals (one reading per type), searching (false while nothing is asked: the totals show "—"),
// canClear, onClearAll.
// Chips: "All" clears the selection of types; each type is a toggle button (aria-pressed) and several can be on. The
// number of a chip is the total of ITS type with the text and the filters, whatever types are selected; "All" is the
// sum of the four ("—" while it is not known). The filters restrict only the types they apply to (D-48): the notes say
// so, and the other types stay in the results and in the totals.
import { Button, FormField, ICON_STROKE_WIDTH, Select, Skeleton, cx } from '../../components/ui';
import type { ApiResource } from '../../api/useApiResource';
import { X } from 'lucide-react';

import { STATUS_FILTER_OPTIONS, isApiStatus } from '../screens/screenLabels';
import { SCOPE_LABEL } from '../variables/variableLabels';

import { NOTE_ENVIRONMENT, NOTE_SCOPE, NOTE_STATUS, TYPE_PLURAL } from './searchLabels';
import { SEARCH_ENVIRONMENTS, SEARCH_TYPES, type SearchElementType } from './searchTypes';
import { sumOfTotals, type SearchTotals } from './useSearchResults';
import type { SearchListParams } from './useSearchListParams';

interface SearchFiltersProps {
  params: SearchListParams;
  setParams: (patch: Partial<SearchListParams>) => void;
  totals: SearchTotals;
  searching: boolean;
  canClear: boolean;
  onClearAll: () => void;
}

function CountText({ resource, searching }: { resource: ApiResource<number>; searching: boolean }) {
  if (!searching || resource.status === 'error') return <span>—</span>;
  if (resource.status === 'loading') return <Skeleton className="h-3.5 w-4" />;
  return <span>{resource.data}</span>;
}

const CHIP_CLASS =
  'inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-label font-semibold transition-colors motion-reduce:transition-none';

function chipClass(pressed: boolean): string {
  return cx(
    CHIP_CLASS,
    pressed
      ? 'border-primary bg-empty-icon-bg text-primary'
      : 'border-border-control bg-surface text-ink-900 hover:bg-control-hover',
  );
}

export function SearchFilters({
  params,
  setParams,
  totals,
  searching,
  canClear,
  onClearAll,
}: SearchFiltersProps) {
  const all = sumOfTotals(totals);
  const toggle = (type: SearchElementType) => {
    const next = params.types.includes(type)
      ? params.types.filter((chosen) => chosen !== type)
      : [...params.types, type];
    setParams({ types: next });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Element types" className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={params.types.length === 0}
            className={chipClass(params.types.length === 0)}
            onClick={() => {
              setParams({ types: [] });
            }}
          >
            <span>All</span>{' '}
            <span className="font-normal text-ink-500">
              {searching && all !== null ? all : '—'}
            </span>
          </button>
          {SEARCH_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={params.types.includes(type)}
              className={chipClass(params.types.includes(type))}
              onClick={() => {
                toggle(type);
              }}
            >
              <span>{TYPE_PLURAL[type]}</span>{' '}
              <span className="font-normal text-ink-500">
                <CountText resource={totals[type]} searching={searching} />
              </span>
            </button>
          ))}
        </div>
        {canClear && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            iconLeft={<X aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />}
            onClick={onClearAll}
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Environment" help={NOTE_ENVIRONMENT}>
          {(control) => (
            <Select
              {...control}
              value={params.environment}
              onChange={(event) => {
                const value = event.target.value;
                setParams({ environment: SEARCH_ENVIRONMENTS.find((env) => env === value) ?? '' });
              }}
            >
              <option value="">Any</option>
              {SEARCH_ENVIRONMENTS.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Status" help={NOTE_STATUS}>
          {(control) => (
            <Select
              {...control}
              value={params.status}
              onChange={(event) => {
                const value = event.target.value;
                setParams({ status: isApiStatus(value) ? value : '' });
              }}
            >
              <option value="">Any</option>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Scope" help={NOTE_SCOPE}>
          {(control) => (
            <Select
              {...control}
              value={params.scope}
              onChange={(event) => {
                const value = event.target.value;
                setParams({ scope: value === 'GLOBAL' || value === 'CONTEXT' ? value : '' });
              }}
            >
              <option value="">Any</option>
              <option value="GLOBAL">{SCOPE_LABEL.GLOBAL}</option>
              <option value="CONTEXT">{SCOPE_LABEL.CONTEXT}</option>
            </Select>
          )}
        </FormField>
      </div>
    </>
  );
}
