// QuickSearchPanel: the 480 px panel under the quick search field (S-30, D-133). It only draws; QuickSearch holds the
// behavior and the development page /dev/quick-search draws it in every state.
// Props: phase / groups / total / pageText / showSkeleton / busy (what useQuickSearch gives), text (the trimmed text of
// the field), applicationName, errorMessage (catalog text of the failed call), activeKey (the row the keyboard is on, or
// null), panelId / listboxId / optionId(key) (ids shared with the combobox), onPick(href).
// The rows are `option`s of one `listbox`, grouped with `group` and their heading; the footer "See all results for …"
// is the last option (key QUICK_ALL_KEY). Texts that are not rows (help, error, "No results") sit above the listbox, so
// the listbox only ever holds options. The matches are marked with the rules of the API (Highlighted).
import { ElementTypeIcon, Skeleton, StatusTag, cx } from '../components/ui';
import { Highlighted } from '../modules/search/Highlighted';
import { TYPE_ICON, TYPE_PLURAL } from '../modules/search/searchLabels';
import { toTagStatus } from '../modules/screens/screenLabels';
import { countText } from '../modules/variables/variableLabels';

import {
  QUICK_ALL_KEY,
  QUICK_EMPTY_TITLE,
  QUICK_FIELD_LABEL,
  QUICK_HELP_TEXT,
  QUICK_TOO_LONG_TEXT,
  quickAllText,
  quickEmptyText,
  quickResultHref,
  quickResultKey,
  quickResultNote,
  searchAllHref,
  type QuickGroup,
} from './quickSearchModel';
import type { QuickPhase } from './useQuickSearch';

interface QuickSearchPanelProps {
  phase: QuickPhase;
  groups: QuickGroup[];
  total: number;
  pageText: string;
  showSkeleton: boolean;
  busy: boolean;
  text: string;
  applicationName: string;
  errorMessage: string | null;
  activeKey: string | null;
  panelId: string;
  listboxId: string;
  optionId: (key: string) => string;
  onPick: (href: string) => void;
}

const ROW_CLASS =
  'flex cursor-pointer items-center gap-2 rounded-chip px-2.5 py-2 text-body text-ink-900 hover:bg-control-hover aria-selected:bg-control-hover';

export function QuickSearchPanel({
  phase,
  groups,
  total,
  pageText,
  showSkeleton,
  busy,
  text,
  applicationName,
  errorMessage,
  activeKey,
  panelId,
  listboxId,
  optionId,
  onPick,
}: QuickSearchPanelProps) {
  const hasFooter = phase === 'results' || phase === 'empty';
  return (
    <div
      id={panelId}
      role="presentation"
      // The field keeps the focus: a press inside the panel must not take it.
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      className="absolute top-full left-0 z-30 mt-2 max-h-[70dvh] w-120 max-w-full overflow-y-auto rounded-card border border-border-subtle bg-surface p-1.75 text-left shadow-modal"
    >
      {phase === 'help' && <p className="px-2.5 py-2 text-body text-ink-500">{QUICK_HELP_TEXT}</p>}
      {phase === 'tooLong' && (
        <p className="px-2.5 py-2 text-body text-danger">{QUICK_TOO_LONG_TEXT}</p>
      )}
      {phase === 'loading' && showSkeleton && (
        <div className="flex flex-col gap-2 px-2.5 py-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      )}
      {phase === 'error' && (
        <p role="alert" className="px-2.5 py-2 text-body text-danger">
          {errorMessage}
        </p>
      )}
      {phase === 'empty' && (
        <div className="px-2.5 py-2">
          <p className="text-body font-bold text-ink-900">{QUICK_EMPTY_TITLE}</p>
          <p className="mt-0.5 text-body text-ink-500">{quickEmptyText(applicationName, text)}</p>
        </div>
      )}
      <div
        id={listboxId}
        role="listbox"
        aria-label={QUICK_FIELD_LABEL}
        aria-busy={busy || undefined}
        className={cx(!hasFooter && 'hidden')}
      >
        {groups.map((group) => {
          const headingId = `${listboxId}-${group.type}`;
          return (
            <div key={group.type} role="group" aria-labelledby={headingId}>
              <div
                id={headingId}
                className="px-2.5 pt-1.5 pb-1 text-tag font-bold tracking-wide text-ink-500"
              >
                {TYPE_PLURAL[group.type]}
              </div>
              {group.rows.map((row) => {
                const key = quickResultKey(row);
                const note = quickResultNote(row);
                return (
                  <div
                    key={key}
                    id={optionId(key)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={activeKey === key}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onPick(quickResultHref(row));
                    }}
                    className={ROW_CLASS}
                  >
                    <ElementTypeIcon type={TYPE_ICON[row.type]} size={14} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-mono font-semibold">
                      <Highlighted text={row.name} query={pageText} />
                    </span>
                    {row.type === 'SCREEN' && (
                      <StatusTag status={toTagStatus(row.documentationStatus)} />
                    )}
                    {note !== null && (
                      <span className="max-w-40 shrink-0 truncate text-small text-ink-500">
                        {note}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {hasFooter && (
          <div
            id={optionId(QUICK_ALL_KEY)}
            role="option"
            tabIndex={-1}
            aria-selected={activeKey === QUICK_ALL_KEY}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(searchAllHref(text));
            }}
            className={cx(ROW_CLASS, 'mt-1 rounded-t-none border-t border-divider')}
          >
            <span className="min-w-0 truncate font-semibold text-primary">
              {quickAllText(text)}
            </span>
            <span className="shrink-0 text-small text-ink-500">· Enter</span>
            {phase === 'results' && (
              <span className="ml-auto shrink-0 text-small text-ink-500">
                {countText(total, 'result')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
