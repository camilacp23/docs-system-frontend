// ScreenPicker: the "Screens" selector of the generate dialog (S-34, D-139). Several screens of the application, found
// by name on the server while the user types, 20 at a time with "Load more".
// Props: applicationId, value (the chosen screens, with their names), onChange(next), disabled (Screens and Components
// are not included: the selection does not apply), invalid, errorPositions (positions in `value` the API refused, D-140),
// describedBy (id of the error / help text), labelledBy (id of the label of the field; the button is named by it and by
// its own text), id (of the button that opens the list).
// Closed it looks like the select of the frame ("All screens", or "3 screens selected"). The chosen screens are chips in ONE row of a
// fixed height under it (it scrolls sideways when there are many; it says so when there is none), so the dialog never changes size.
// Open, the list is a panel that floats ABOVE the field, over the dialog, with a search box and the matches as checkboxes (it scrolls
// inside, 20 at a time with "Load more"). Up to 500 screens
// (the contract's limit): a 501st is refused with a message. Escape closes the list and returns to the button, without
// closing the dialog. Nothing is read from the API until the list is opened.
import { ChevronDown, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { getErrorMessage } from '../../api/messages';
import { Button, Checkbox, cx, ICON_STROKE_WIDTH, TextField } from '../../components/ui';
import { SEARCH_DEBOUNCE_MS } from '../../hooks/useSearchDraft';

import { SCREEN_LIMIT, type PickedScreen } from './reportForm';
import {
  CLEAR_SCREENS_LABEL,
  LOAD_MORE_LABEL,
  REMOVE_SCREEN,
  SCREEN_LIMIT_TEXT,
  SCREEN_LIST_LABEL,
  SCREEN_LOADING_TEXT,
  SCREEN_NONE_TEXT,
  SCREEN_PANEL_LABEL,
  SCREEN_SEARCH_LABEL,
  SCREENS_EMPTY_BOX_TEXT,
  SCREENS_PLACEHOLDER,
  screensSelected,
} from './reportTexts';
import { useScreenSearch } from './useScreenSearch';

export interface ScreenPickerProps {
  applicationId: number | null;
  value: readonly PickedScreen[];
  onChange: (next: PickedScreen[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  errorPositions?: ReadonlySet<number>;
  describedBy?: string;
  labelledBy?: string;
  id?: string;
}

export function ScreenPicker({
  applicationId,
  value,
  onChange,
  disabled = false,
  invalid = false,
  errorPositions,
  describedBy,
  labelledBy,
  id,
}: ScreenPickerProps) {
  const generated = useId();
  const buttonId = id ?? `${generated}-button`;
  const panelId = `${generated}-panel`;
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [limitReached, setLimitReached] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typed.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [typed]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const results = useScreenSearch(applicationId, search, open && !disabled);
  const chosen = new Set(value.map((screen) => screen.id));

  const toggle = (screen: PickedScreen, on: boolean) => {
    if (on) {
      if (value.length >= SCREEN_LIMIT) {
        setLimitReached(true);
        return;
      }
      setLimitReached(false);
      onChange([...value, { id: screen.id, name: screen.name }]);
    } else {
      setLimitReached(false);
      onChange(value.filter((item) => item.id !== screen.id));
    }
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="relative flex flex-col gap-2">
      <button
        ref={buttonRef}
        type="button"
        id={buttonId}
        disabled={disabled}
        aria-expanded={open && !disabled}
        aria-controls={open && !disabled ? panelId : undefined}
        aria-labelledby={labelledBy ? `${labelledBy} ${buttonId}` : undefined}
        aria-describedby={describedBy}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={cx(
          'flex h-10 w-full items-center justify-between gap-2 rounded-control border-2 bg-surface px-3 text-left text-body-lg disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:opacity-45',
          invalid
            ? 'border-danger'
            : 'border-border-control enabled:hover:border-border-control-hover',
          value.length === 0 ? 'text-ink-500' : 'text-ink-900',
        )}
      >
        <span>{value.length === 0 ? SCREENS_PLACEHOLDER : screensSelected(value.length)}</span>
        <ChevronDown
          aria-hidden="true"
          size={16}
          strokeWidth={ICON_STROKE_WIDTH}
          className={cx(
            'shrink-0 text-ink-500 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && !disabled && (
        // The list opens ABOVE the field, over the dialog, instead of pushing it: the dialog keeps its size.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the keys come from the controls inside; the group itself is not interactive
        <div
          id={panelId}
          role="group"
          aria-label={SCREEN_PANEL_LABEL}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            // Closes the list only: the dialog around it stays.
            event.stopPropagation();
            event.preventDefault();
            close();
          }}
          className="absolute right-0 bottom-full left-0 z-30 mb-2 flex max-h-72 flex-col gap-2 rounded-card border border-border-subtle bg-surface p-2.5 shadow-modal motion-safe:animate-fade-in"
        >
          <TextField
            ref={searchRef}
            aria-label={SCREEN_SEARCH_LABEL}
            autoComplete="off"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
          />
          <div className="flex min-h-0 flex-1 [scrollbar-width:thin] flex-col overflow-y-auto">
            <ul aria-label={SCREEN_LIST_LABEL} className="flex flex-col">
              {results.items.map((screen) => (
                <li key={screen.id} className="rounded-chip px-1.5 py-1 hover:bg-report-soft">
                  <Checkbox
                    label={screen.name}
                    checked={chosen.has(screen.id)}
                    onChange={(event) => {
                      toggle({ id: screen.id, name: screen.name }, event.target.checked);
                    }}
                  />
                </li>
              ))}
            </ul>
            <div role="status" className="px-1 text-small text-ink-500 empty:hidden">
              {results.status === 'loading' && SCREEN_LOADING_TEXT}
              {results.status === 'error' &&
                results.error &&
                (getErrorMessage(results.error) ?? '')}
              {results.status === 'ready' && results.items.length === 0 && SCREEN_NONE_TEXT}
            </div>
            {limitReached && (
              <p role="alert" className="px-1 text-small text-danger">
                {SCREEN_LIMIT_TEXT}
              </p>
            )}
            {results.hasMore && (
              <div className="px-1 py-1">
                <Button size="sm" loading={results.loadingMore} onClick={results.loadMore}>
                  {LOAD_MORE_LABEL}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* The chosen screens: ONE row that scrolls sideways, of a fixed height, so choosing any number never changes the size of the dialog. */}
      {value.length > 0 ? (
        <ul
          aria-label="Selected screens"
          className="flex h-11 [scrollbar-width:thin] items-center gap-2 overflow-x-auto rounded-card border border-border-subtle bg-surface px-2"
        >
          {value.map((screen, position) => (
            <li
              key={screen.id}
              className={cx(
                'inline-flex h-7 shrink-0 items-center gap-1 rounded-pill border bg-report-soft pr-1 pl-3 text-label font-medium text-report-ink',
                errorPositions?.has(position) ? 'border-danger' : 'border-report-border',
              )}
            >
              <span>{screen.name}</span>
              <button
                type="button"
                aria-label={REMOVE_SCREEN(screen.name)}
                disabled={disabled}
                onClick={() => {
                  toggle(screen, false);
                }}
                className="flex size-5 items-center justify-center rounded-pill hover:bg-surface"
              >
                <X aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
              </button>
            </li>
          ))}
          <li className="shrink-0">
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => {
                setLimitReached(false);
                onChange([]);
              }}
            >
              {CLEAR_SCREENS_LABEL}
            </Button>
          </li>
        </ul>
      ) : (
        <div className="flex h-11 items-center rounded-card border border-dashed border-border-subtle px-3 text-small text-ink-500">
          {SCREENS_EMPTY_BOX_TEXT}
        </div>
      )}
    </div>
  );
}
