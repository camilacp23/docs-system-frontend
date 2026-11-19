// CollectionFilters: the filter strip of the collection list (S-14): one centered pill, the environment select, on a soft
// royal-blue band. The "Not linked to any screen" filter is the last counter card above the list (CollectionKpis). There is
// no search by name here: the search of the top bar covers it (the `q` parameter of the URL still filters if a link
// carries it). "Clear filters" lives in the header of the list card.
// Props: params (current filters), setParams (writes the URL). Every control has an accessible name; the changes reach the
// URL, never a local copy.
import { Server } from 'lucide-react';

import { FilterSelect, ICON_STROKE_WIDTH } from '../../components/ui';
import { ENVIRONMENTS } from '../variables/variableLabels';
import type { Environment } from '../variables/variableTypes';

import type { CollectionListParams } from './useCollectionListParams';

interface CollectionFiltersProps {
  params: CollectionListParams;
  setParams: (patch: Partial<CollectionListParams>, options?: { replace?: boolean }) => void;
}

export function CollectionFilters({ params, setParams }: CollectionFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 border-b border-collection-border/60 bg-collection-soft/50 px-5 py-3">
      <FilterSelect
        label="Environment"
        tone="collection"
        icon={<Server size={15} strokeWidth={ICON_STROKE_WIDTH} />}
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
    </div>
  );
}
