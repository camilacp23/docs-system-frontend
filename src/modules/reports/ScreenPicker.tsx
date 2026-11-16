// ScreenPicker: the "Screens" selector of the generate dialog (S-34, D-139). Several screens of the application, found
// by name on the server while the user types, 20 at a time with "Load more".
// Props: applicationId, value (the chosen screens, with their names), onChange(next), disabled (Screens and Components
// are not included: the selection does not apply), invalid, errorPositions (positions in `value` the API refused, D-140),
// describedBy (id of the error / help text), labelledBy (id of the label of the field; the button is named by it and by
// its own text), id (of the button that opens the list).
// Closed it looks like the select of the frame ("All screens", or "3 screens selected") and the chosen screens are chips
// under it, kept while the search changes. Open, it shows a search box and the matches as checkboxes in a list of at most 80 px
// that scrolls inside itself (the dialog never grows past the window); the keyboard moves through the checkboxes with Tab. Up to 500 screens
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
    <div className="flex flex-col gap-2">
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
          className="shrink-0 text-ink-500"
        />
      </button>

      {open && !disabled && (
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
          className="flex flex-col gap-2 rounded-control border border-border-subtle bg-surface p-2 shadow-card"
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
          <ul aria-label={SCREEN_LIST_LABEL} className="flex max-h-20 flex-col overflow-y-auto">
            {results.items.map((screen) => (
              <li key={screen.id} className="px-1 py-1">
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
            {results.status === 'error' && results.error && (getErrorMessage(results.error) ?? '')}
            {results.status === 'ready' && results.items.length === 0 && SCREEN_NONE_TEXT}
          </div>
          {limitReached && (
            <p role="alert" className="px-1 text-small text-danger">
              {SCREEN_LIMIT_TEXT}
            </p>
          )}
          {results.hasMore && (
            <div>
              <Button size="sm" loading={results.loadingMore} onClick={results.loadMore}>
                {LOAD_MORE_LABEL}
              </Button>
            </div>
          )}
        </div>
      )}

      {value.length > 0 && (
        <ul aria-label="Selected screens" className="flex flex-wrap items-center gap-2">
          {value.map((screen, position) => (
            <li
              key={screen.id}
              className={cx(
                'inline-flex h-7 items-center gap-1 rounded-pill border bg-empty-icon-bg pr-1 pl-3 text-label font-medium text-primary',
                errorPositions?.has(position) ? 'border-danger' : 'border-primary',
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
                className="flex size-5 items-center justify-center rounded-pill"
              >
                <X aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
              </button>
            </li>
          ))}
          <li>
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
      )}
    </div>
  );
}
