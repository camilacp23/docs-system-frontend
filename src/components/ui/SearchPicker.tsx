// SearchPicker: a searchable single choice (combobox, WAI-ARIA 1.2 "editable combobox with list autocomplete").
// Props: options ({ value, label, detail?, disabled? }), value (the chosen option value, '' = none), onChange(value),
// placeholder, emptyText (shown when nothing matches), loading (the options are still being read), mono (IBM Plex
// Mono, for Power Apps identifiers), invalid, disabled, plus aria-label / aria-labelledby / aria-describedby /
// aria-required and id for the input. Normally rendered inside FormField or a table cell that names it.
// The input shows the chosen label; typing filters the options by label and detail (case-insensitive). Arrow keys
// move through the enabled options, Enter chooses, Escape closes and restores the chosen label, Tab leaves. A
// disabled option stays in the list (aria-disabled) with its `detail` as the reason, so it can be read but not
// chosen. The list is drawn in a portal with fixed coordinates taken from the input, so no ancestor with `overflow`
// (a scrolling table) clips it; it opens below the input, or above when there is no room, and closes on resize or
// on a scroll outside the list.
// onQueryChange(text) reports what is typed ('' when typing ends) and filterOptions={false} keeps the options as the
// caller gave them, for a list that is searched somewhere else (the audit log's user filter asks the server).
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cx, ICON_STROKE_WIDTH } from './cx';
import { fieldBorderClass } from './fieldStyles';
import { FILTER_TONE_HOVER, FILTER_TONE_INPUT_FOCUS, type FilterTone } from './filterTones';

export interface SearchPickerOption {
  value: string;
  label: string;
  /** Secondary text at the right of the label; for a disabled option it is the reason. */
  detail?: string;
  /** A small decorative element before the label (the initials of a person). */
  leading?: ReactNode;
  disabled?: boolean;
}

export interface SearchPickerProps extends Pick<
  ComponentProps<'input'>,
  'id' | 'placeholder' | 'aria-label' | 'aria-labelledby' | 'aria-describedby' | 'aria-required'
> {
  options: readonly SearchPickerOption[];
  value: string;
  onChange: (value: string) => void;
  emptyText?: string;
  loading?: boolean;
  mono?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  /** A pill (rounded, with a soft shadow) for a filter bar, in the teal of the audit page, instead of the form field. */
  pill?: boolean;
  /** With `pill`: a decorative icon at the start of the input. */
  icon?: ReactNode;
  /** With `pill`: the color of its page (default the teal of the audit page). */
  tone?: FilterTone;
  /** Without the arrow of a select: a search box that lists matches as the user types. Default true. */
  chevron?: boolean;
  /** Called with what the user types, and with '' when the typing ends (a choice, Escape, leaving the input). */
  onQueryChange?: (query: string) => void;
  /** false: show `options` as they are, because the caller already searched them (for example on the server). */
  filterOptions?: boolean;
}

const EDGE_GAP = 8;
const LIST_GAP = 4;
const LIST_MAX_HEIGHT = 240;

export function SearchPicker({
  options,
  value,
  onChange,
  emptyText = 'No matches.',
  loading = false,
  mono = false,
  invalid = false,
  disabled = false,
  pill = false,
  icon,
  tone = 'audit',
  chevron = true,
  onQueryChange,
  filterOptions = true,
  placeholder,
  ...inputProps
}: SearchPickerProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  // What the user typed; null while they are not searching (the input then shows the chosen label).
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  // The latest onQueryChange, read by close() (which the effects below call from old renders).
  const queryChangeRef = useRef(onQueryChange);
  useEffect(() => {
    queryChangeRef.current = onQueryChange;
  });

  const chosen = options.find((option) => option.value === value);
  const text = query ?? chosen?.label ?? '';
  const needle = (query ?? '').trim().toLowerCase();
  const shown =
    needle === '' || !filterOptions
      ? options
      : options.filter((option) =>
          `${option.label} ${option.detail ?? ''}`.toLowerCase().includes(needle),
        );
  const enabled = shown.filter((option) => !option.disabled);
  const activeOption = enabled.find((option) => option.value === active) ?? enabled[0];
  const optionId = (optionValue: string) => `${listId}-option-${optionValue}`;

  const close = () => {
    setOpen(false);
    queryChangeRef.current?.('');
    setQuery(null);
    setActive(null);
  };

  const choose = (option: SearchPickerOption) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
  };

  // Put the list next to the input before the first paint.
  useLayoutEffect(() => {
    const list = listRef.current;
    const input = inputRef.current?.getBoundingClientRect();
    if (!open || list === null || input === undefined) return;
    const height = Math.min(list.offsetHeight, LIST_MAX_HEIGHT);
    const below = input.bottom + LIST_GAP;
    const fitsBelow = below + height <= window.innerHeight - EDGE_GAP;
    list.style.top = `${fitsBelow ? below : Math.max(EDGE_GAP, input.top - LIST_GAP - height)}px`;
    list.style.left = `${input.left}px`;
    list.style.width = `${input.width}px`;
    list.style.visibility = 'visible';
  }, [open, shown.length]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      close();
    };
    const onScroll = (event: Event) => {
      if (listRef.current?.contains(event.target as Node) !== true) close();
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // Keep the active option in view while moving with the arrow keys.
  useEffect(() => {
    if (!open || activeOption === undefined) return;
    document.getElementById(optionId(activeOption.value))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionId only depends on listId
  }, [open, activeOption?.value]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const position = activeOption === undefined ? -1 : enabled.indexOf(activeOption);
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (enabled.length === 0) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive(enabled[(position + step + enabled.length) % enabled.length]?.value ?? null);
        return;
      }
      case 'Home':
      case 'End':
        if (!open || enabled.length === 0) return;
        event.preventDefault();
        setActive(enabled[event.key === 'Home' ? 0 : enabled.length - 1]?.value ?? null);
        return;
      case 'Enter':
        if (!open) return;
        // An open list owns Enter: it must not submit the form.
        event.preventDefault();
        if (activeOption !== undefined) choose(activeOption);
        return;
      case 'Escape':
        if (!open) return;
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      case 'Tab':
        close();
        return;
      default:
    }
  };

  return (
    <div
      className="relative"
      onBlur={(event) => {
        // Focus left the picker (the options never take it: they are chosen with the mouse down).
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <input
        {...inputProps}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && activeOption ? optionId(activeOption.value) : undefined}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setQuery(event.target.value);
          onQueryChange?.(event.target.value);
          setActive(null);
          setOpen(true);
        }}
        onClick={() => {
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={cx(
          pill
            ? 'h-9 w-full rounded-pill border bg-surface pr-9 text-label font-semibold text-ink-900 shadow-button placeholder:font-medium placeholder:text-ink-700 disabled:cursor-not-allowed disabled:opacity-45'
            : 'h-9 w-full rounded-control border-2 bg-surface pr-9 pl-3 text-ink-900 placeholder:text-ink-500 disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:opacity-45',
          pill ? false : mono ? 'font-mono text-label' : 'text-body-lg',
          pill && (icon === undefined ? 'pl-4' : 'pl-9'),
          pill
            ? invalid
              ? 'border-danger'
              : cx(
                  'border-border-subtle focus:outline-none',
                  FILTER_TONE_HOVER[tone],
                  FILTER_TONE_INPUT_FOCUS[tone],
                )
            : fieldBorderClass(invalid),
        )}
      />
      {pill && icon !== undefined && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-700"
        >
          {icon}
        </span>
      )}
      {chevron && (
        <ChevronDown
          aria-hidden="true"
          size={16}
          strokeWidth={ICON_STROKE_WIDTH}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-500"
        />
      )}
      {open &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={inputProps['aria-label']}
            aria-labelledby={inputProps['aria-labelledby']}
            style={{ top: 0, left: 0, visibility: 'hidden', maxHeight: LIST_MAX_HEIGHT }}
            className={cx(
              'fixed z-40 overflow-y-auto rounded-card border border-border-subtle bg-surface p-1.5 shadow-modal',
              pill && 'min-w-80',
            )}
          >
            {shown.length === 0 && (
              <li role="presentation" className="px-3 py-2 text-body text-ink-500">
                {loading ? 'Loading…' : emptyText}
              </li>
            )}
            {shown.map((option) => {
              const isActive = option.value === activeOption?.value;
              return (
                <li
                  key={option.value}
                  id={optionId(option.value)}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  title={option.disabled ? option.detail : undefined}
                  // Mouse down, not click: the input keeps the focus, so the list does not close before the choice.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                  className={cx(
                    'flex items-baseline justify-between gap-3 rounded-chip px-3 py-2',
                    option.disabled
                      ? 'cursor-not-allowed text-ink-500 opacity-45'
                      : cx(
                          'cursor-pointer text-ink-900',
                          isActive ? 'bg-accent-soft text-accent-ink' : 'hover:bg-accent-soft',
                        ),
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {option.leading}
                    <span
                      className={cx(
                        mono ? 'font-mono text-label' : 'text-body',
                        pill && 'whitespace-nowrap',
                      )}
                    >
                      {option.label}
                    </span>
                  </span>
                  {option.detail && (
                    <span className="text-small text-ink-500">{option.detail}</span>
                  )}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}
