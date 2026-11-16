// QuickSearch: the search field of the top bar and its panel (S-30, D-48, D-133, flow 4 of Table 57).
// Props: none (the application comes from ApplicationProvider; the pages are reached with the router).
// Pattern: WAI-ARIA 1.2 combobox with a listbox popup. The field is the combobox (role="combobox", aria-expanded,
// aria-controls, aria-activedescendant) and the 480 px panel under it is the listbox, with an `option` per row and a
// `group` with its heading per type. The focus NEVER leaves the field while the arrows move through the rows
// (aria-activedescendant). aria-live="polite" announces the number of results.
// Keys: Ctrl+K or Cmd+K focus the field and open the panel; Down / Up move through the rows (and the footer); Enter
// opens the active row, or, with no active row, the advanced search with the text (/search?q=…); Esc closes the panel
// and leaves the focus in the field; Tab, and a click outside, close it too.
// What is asked, when and how an old answer is dropped: useQuickSearch. What the panel draws: QuickSearchPanel.
import { Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';

import { getErrorMessage } from '../api/messages';
import { useApplication } from '../application/useApplication';
import { cx, ICON_STROKE_WIDTH } from '../components/ui';
import { validateSearchText } from '../modules/search/searchQuery';
import { countText } from '../modules/variables/variableLabels';

import {
  QUICK_ALL_KEY,
  QUICK_EMPTY_TITLE,
  QUICK_FIELD_LABEL,
  QUICK_PLACEHOLDER,
  quickResultHref,
  quickResultKey,
  searchAllHref,
  shortcutHint,
} from './quickSearchModel';
import { QuickSearchPanel } from './QuickSearchPanel';
import { useQuickSearch } from './useQuickSearch';

export function QuickSearch() {
  const navigate = useNavigate();
  const { currentApplication, currentApplicationId } = useApplication();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const listboxId = `${baseId}-list`;
  const optionId = (key: string) => `${baseId}-option-${key}`;
  const disabled = currentApplication === null;

  const search = useQuickSearch(currentApplicationId, text);
  const trimmed = text.trim();
  const askable = trimmed !== '' && validateSearchText(trimmed) === null;
  const hasFooter = search.phase === 'results' || search.phase === 'empty';
  const keys = [
    ...search.groups.flatMap((group) => group.rows.map(quickResultKey)),
    ...(hasFooter ? [QUICK_ALL_KEY] : []),
  ];
  const active = activeKey !== null && keys.includes(activeKey) ? activeKey : null;

  // Ctrl+K / Cmd+K from anywhere in the shell (the browser's own use of the key is cancelled).
  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
      if (event.altKey || event.shiftKey) return;
      event.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [disabled]);

  const go = (href: string) => {
    setOpen(false);
    setText('');
    setActiveKey(null);
    void navigate(href);
  };

  const move = (delta: 1 | -1) => {
    if (keys.length === 0) return;
    const index = active === null ? -1 : keys.indexOf(active);
    const next =
      index === -1
        ? delta === 1
          ? 0
          : keys.length - 1
        : (index + delta + keys.length) % keys.length;
    setActiveKey(keys[next] ?? null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      if (event.nativeEvent.isComposing) return;
      event.preventDefault();
      const row = search.groups
        .flatMap((group) => group.rows)
        .find((r) => quickResultKey(r) === active);
      if (row !== undefined) go(quickResultHref(row));
      else if (askable) go(searchAllHref(trimmed));
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setActiveKey(null);
    }
  };

  const message =
    search.error === null ? null : getErrorMessage(search.error, { element: 'application' });
  const announcement = !open
    ? ''
    : search.phase === 'results'
      ? countText(search.total, 'result')
      : search.phase === 'empty'
        ? QUICK_EMPTY_TITLE
        : '';

  return (
    <div
      ref={containerRef}
      className="relative h-10 w-full max-w-132 min-w-0"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget)) {
          setOpen(false);
          setActiveKey(null);
        }
      }}
    >
      <div
        className={cx(
          'flex h-full items-center gap-2.5 overflow-hidden rounded-card border border-border bg-search-bg pr-2 pl-3.5 shadow-field-inset focus-within:border-accent focus-within:ring-2 focus-within:ring-focus-ring',
          disabled && 'opacity-60',
        )}
      >
        <Search
          size={18}
          strokeWidth={ICON_STROKE_WIDTH}
          aria-hidden="true"
          className="shrink-0 text-ink-500"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={QUICK_FIELD_LABEL}
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={open && active !== null ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-keyshortcuts="Control+K Meta+K"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={QUICK_PLACEHOLDER}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActiveKey(null);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onClick={() => {
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-body-lg text-ink-900 outline-none placeholder:text-ink-500"
        />
        {currentApplication !== null && (
          <span
            aria-hidden="true"
            className="max-w-32 shrink-0 truncate rounded-chip border border-border bg-surface px-2 py-0.75 text-small/5 font-semibold text-ink-700"
          >
            in {currentApplication.name}
          </span>
        )}
        <kbd
          aria-hidden="true"
          className="shrink-0 rounded-keycap border border-b-2 border-border bg-surface px-1.75 py-1.25 font-mono text-micro/[11px] font-semibold whitespace-nowrap text-ink-700"
        >
          {shortcutHint()}
        </kbd>
      </div>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      {open && (
        <QuickSearchPanel
          phase={search.phase}
          groups={search.groups}
          total={search.total}
          pageText={search.pageText}
          showSkeleton={search.showSkeleton}
          busy={search.busy}
          text={trimmed}
          applicationName={currentApplication?.name ?? ''}
          errorMessage={message}
          activeKey={active}
          panelId={panelId}
          listboxId={listboxId}
          optionId={optionId}
          onPick={go}
        />
      )}
    </div>
  );
}
