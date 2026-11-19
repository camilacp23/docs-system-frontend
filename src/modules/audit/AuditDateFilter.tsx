// AuditDateFilter: the period of the audit log (S-32f): a pill with the current period that opens a small popover holding the
// shortcuts Today, Last 7 days and Last 30 days as chips, the custom range (From / To, days in the local time of the browser)
// side by side and Cancel / Apply.
// Props: from, to (the days in use), today (the local day), error (text for the "To" field: an upside-down range from the
// URL or the API's 400 `range`), onApply(from, to).
// The popover is drawn in a portal on <body> with fixed coordinates taken from the pill, so no card with `overflow-hidden` can
// cut it, and it is kept inside the window. It works on a draft: a shortcut or a typed day changes the draft, Apply writes it to
// the URL. An upside-down draft shows its error under the two days and cannot be applied (nothing is sent to the API). Esc, a
// click outside and Cancel close it without applying.
import { CalendarRange, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button, ICON_STROKE_WIDTH, cx } from '../../components/ui';
import { usePopover } from '../../hooks/usePopover';

import {
  PRESET_LABEL,
  presetOf,
  presetRange,
  rangeError,
  rangeText,
  type RangePreset,
} from './auditDates';

interface AuditDateFilterProps {
  from: string;
  to: string;
  today: string;
  error?: string | null;
  onApply: (from: string, to: string) => void;
}

const PRESETS: readonly RangePreset[] = ['today', 'last7', 'last30'];
const POPOVER_WIDTH = 344;
const WINDOW_GAP = 12;
const CHIP_CLASS =
  'h-8 rounded-pill border px-3 text-label font-semibold whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none';
const CHIP_ON = 'border-audit bg-audit text-on-primary shadow-button';
const CHIP_OFF =
  'border-border-subtle bg-surface text-ink-700 hover:border-audit-border hover:bg-audit-soft';
const DAY_CLASS =
  'h-8 w-full min-w-0 rounded-control border bg-surface px-2 text-label text-ink-900 focus:border-audit focus:outline-none';

interface Position {
  top: number;
  left: number;
  arrow: number;
}

export function AuditDateFilter({ from, to, today, error, onApply }: AuditDateFilterProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { open, setOpen, containerRef, triggerRef } = usePopover(panelRef);
  const panelId = useId();
  const fromId = `${panelId}-from`;
  const toId = `${panelId}-to`;
  const errorId = `${panelId}-error`;
  const [draft, setDraft] = useState({ from, to });
  const [position, setPosition] = useState<Position | null>(null);
  const draftError = rangeError(draft.from, draft.to);
  const shownError = open ? (draftError ?? error ?? null) : null;
  const preset = presetOf(draft.from, draft.to, today);

  useEffect(() => {
    if (!open) return;
    // The popover is placed from the pill when it opens: a change of the window closes it instead of leaving it behind.
    const close = () => {
      setOpen(false);
    };
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('resize', close);
    };
  }, [open, setOpen]);

  const toggle = () => {
    if (!open) {
      setDraft({ from, to });
      const pill = triggerRef.current?.getBoundingClientRect();
      if (pill) {
        const width = Math.min(POPOVER_WIDTH, window.innerWidth - 2 * WINDOW_GAP);
        const left = Math.max(
          WINDOW_GAP,
          Math.min(pill.left, window.innerWidth - width - WINDOW_GAP),
        );
        setPosition({
          top: pill.bottom + 10,
          left,
          arrow: Math.max(16, Math.min(pill.left + pill.width / 2 - left - 6, width - 28)),
        });
      }
    }
    setOpen(!open);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Period: ${rangeText(from, to, today)}`}
        onClick={toggle}
        className={cx(
          'flex h-9 w-full cursor-pointer items-center gap-2 rounded-pill border px-3.5 text-label font-bold whitespace-nowrap shadow-button transition-colors duration-150 motion-reduce:transition-none',
          error
            ? 'border-danger bg-surface text-ink-900'
            : 'border-audit bg-audit-soft text-audit-ink hover:bg-surface',
        )}
      >
        <CalendarRange aria-hidden="true" size={15} strokeWidth={ICON_STROKE_WIDTH} />
        {rangeText(from, to, today)}
        <ChevronDown
          aria-hidden="true"
          size={14}
          strokeWidth={ICON_STROKE_WIDTH}
          className="ml-auto opacity-70"
        />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Date range"
            style={{ top: position.top, left: position.left }}
            className="fixed z-50 w-86 max-w-[calc(100vw-1.5rem)] origin-top-left rounded-modal border border-border-subtle bg-surface p-3.5 shadow-bubble motion-safe:animate-bubble-in"
          >
            <span
              aria-hidden="true"
              style={{ left: position.arrow }}
              className="absolute -top-1.5 size-3 rotate-45 rounded-[3px] border-t border-l border-border-subtle bg-surface"
            />
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={preset === name}
                  className={cx(CHIP_CLASS, preset === name ? CHIP_ON : CHIP_OFF)}
                  onClick={() => {
                    setDraft(presetRange(name, today));
                  }}
                >
                  {PRESET_LABEL[name]}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={preset === null}
                className={cx(CHIP_CLASS, preset === null ? CHIP_ON : CHIP_OFF)}
                onClick={() => {
                  document.getElementById(fromId)?.focus();
                }}
              >
                Custom range
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor={fromId} className="text-small font-semibold text-ink-700">
                  From
                </label>
                <input
                  id={fromId}
                  type="date"
                  value={draft.from}
                  className={cx(DAY_CLASS, 'border-border-control')}
                  onChange={(event) => {
                    setDraft({ ...draft, from: event.target.value });
                  }}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor={toId} className="text-small font-semibold text-ink-700">
                  To
                </label>
                <input
                  id={toId}
                  type="date"
                  value={draft.to}
                  aria-invalid={shownError !== null || undefined}
                  aria-describedby={shownError === null ? undefined : errorId}
                  className={cx(
                    DAY_CLASS,
                    shownError === null ? 'border-border-control' : 'border-danger',
                  )}
                  onChange={(event) => {
                    setDraft({ ...draft, to: event.target.value });
                  }}
                />
              </div>
            </div>
            {shownError !== null && (
              <p id={errorId} className="mt-1.5 text-small text-danger">
                {shownError}
              </p>
            )}
            <p className="mt-2 text-small text-ink-500">Local time. “To” includes the whole day.</p>
            <div className="mt-3 flex justify-end">
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={draftError !== null}
                  onClick={() => {
                    onApply(draft.from, draft.to);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
