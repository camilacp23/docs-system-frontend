// QuickSearchPreview: development page /dev/quick-search. It draws the panel of the quick search (QuickSearchPanel) under
// the search field of the static shell of the frames, with no session and no API, so S-30 can be looked at and
// photographed in every state.
// Query: state=results (default, the frame S-30) | help | empty | error | loading | long ; text=<text> (default "cli";
// the field and the marks follow it); active=<n> (the n-th option, from 1, drawn as the keyboard has it).
// The rows are the ones of the frame: Inicio (approved), colClientes, galClientes (screen Inicio) and gRegistroSel
// (matched in its description). Like /dev/ui it only exists in development (see devRoutes.ts).
import { useSearchParams } from 'react-router';

import { Banner, PageHeader } from '../components/ui';
import { QuickSearchPanel } from '../layout/QuickSearchPanel';
import { QUICK_ALL_KEY, groupQuickResults, quickResultKey } from '../layout/quickSearchModel';
import type { QuickPhase } from '../layout/useQuickSearch';
import type { SearchResult } from '../modules/search/searchTypes';

import { MockShell } from './MockShell';

const ROWS: SearchResult[] = [
  {
    type: 'SCREEN',
    id: 12,
    name: 'Inicio',
    matchedIn: 'template',
    snippet: null,
    documentationStatus: 'APPROVED',
  },
  {
    type: 'COLLECTION',
    id: 21,
    name: 'colClientes',
    matchedIn: 'name',
    snippet: null,
    environments: ['DEV', 'PROD'],
  },
  {
    type: 'COMPONENT',
    id: 31,
    name: 'galClientes',
    matchedIn: 'name',
    snippet: null,
    screen: { id: 12, name: 'Inicio' },
  },
  {
    type: 'VARIABLE',
    id: 7,
    name: 'gRegistroSel',
    matchedIn: 'description',
    snippet: null,
    scope: 'GLOBAL',
    environments: ['DEV', 'PROD'],
  },
] as SearchResult[];

const STATES = ['results', 'help', 'empty', 'error', 'loading', 'long'] as const;
type PreviewState = (typeof STATES)[number];

const PHASE: Record<PreviewState, QuickPhase> = {
  results: 'results',
  help: 'help',
  empty: 'empty',
  error: 'error',
  loading: 'loading',
  long: 'tooLong',
};

const NO_OP = () => undefined;

export function QuickSearchPreview() {
  const [search] = useSearchParams();
  const asked = search.get('state');
  const state: PreviewState = STATES.find((s) => s === asked) ?? 'results';
  const text = search.get('text') ?? (state === 'help' ? 'c' : state === 'empty' ? 'zzz' : 'cli');
  const phase = PHASE[state];
  const groups = phase === 'results' ? groupQuickResults(ROWS) : [];
  const keys = [...groups.flatMap((group) => group.rows.map(quickResultKey)), QUICK_ALL_KEY];
  const active = Number(search.get('active') ?? 0);
  const activeKey = active >= 1 && phase === 'results' ? (keys[active - 1] ?? null) : null;

  return (
    <MockShell
      activeLabel="Dependency map"
      pageName="Dependency map"
      searchText={state === 'long' ? 'a'.repeat(101) : text}
    >
      <PageHeader
        title="Dependency map"
        description="13 elements · 17 relationships · sample data"
      />
      <Banner tone="info">
        The page under the panel is only here to give the photograph its frame.
      </Banner>
      <div className="relative">
        {/* The panel hangs from the field of the top bar: 508 px from the left of the window, 52 px from the top. */}
        <div className="fixed top-[44px] left-[508px] w-120">
          <div className="relative">
            <QuickSearchPanel
              phase={phase}
              groups={groups}
              total={state === 'results' ? 11 : 0}
              pageText={text}
              showSkeleton
              busy={false}
              text={text}
              applicationName="SAR"
              errorMessage="Something went wrong on our side. Try again in a moment. Reference: req-4f2a."
              activeKey={activeKey}
              panelId="preview-panel"
              listboxId="preview-list"
              optionId={(key) => `preview-option-${key}`}
              onPick={NO_OP}
            />
          </div>
        </div>
      </div>
    </MockShell>
  );
}
