// AuditDateFilter: the period of the audit log (S-32f): a button with the current period and a panel with the
// shortcuts Today, Last 7 days and Last 30 days, the custom range (From / To, days in the local time of the browser)
// and Cancel / Apply.
// Props: from, to (the days in use), today (the local day), error (text for the "To" field: an upside-down range from the
// URL or the API's 400 `range`), onApply(from, to).
// The panel works on a draft: a shortcut or a typed day changes the draft, Apply writes it to the URL. An upside-down
// draft shows its error on "To" and cannot be applied (nothing is sent to the API). Esc, a click outside and Cancel
// close it without applying.
import { CalendarDays } from 'lucide-react';
import { useId, useState } from 'react';

import { Button, FormField, ICON_STROKE_WIDTH, TextField, cx } from '../../components/ui';
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
const OPTION_CLASS =
  'flex h-9 w-full items-center rounded-control px-2.5 text-left text-body-lg text-ink-900 hover:bg-accent-soft aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent-ink';

export function AuditDateFilter({ from, to, today, error, onApply }: AuditDateFilterProps) {
  const { open, setOpen, containerRef, triggerRef } = usePopover();
  const panelId = useId();
  const fromId = `${panelId}-from`;
  const [draft, setDraft] = useState({ from, to });
  const draftError = rangeError(draft.from, draft.to);
  const shownError = open ? (draftError ?? error ?? null) : null;
  const preset = presetOf(draft.from, draft.to, today);

  const toggle = () => {
    if (!open) setDraft({ from, to });
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
          'inline-flex h-9 items-center gap-2 rounded-control border px-3 text-label font-semibold',
          'border-info-border bg-info-bg text-info-ink hover:bg-accent-soft',
          error && 'border-danger',
        )}
      >
        <CalendarDays aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
        {rangeText(from, to, today)}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Date range"
          className="absolute top-full left-0 z-30 mt-2 flex w-136 max-w-[calc(100vw-3rem)] gap-4 rounded-card border border-border-subtle bg-surface p-4 shadow-modal"
        >
          <div className="flex w-36 shrink-0 flex-col gap-0.5">
            {PRESETS.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={preset === name}
                className={OPTION_CLASS}
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
              className={OPTION_CLASS}
              onClick={() => {
                document.getElementById(fromId)?.focus();
              }}
            >
              Custom range
            </button>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex gap-2.5">
              <FormField label="From" htmlFor={fromId} className="min-w-0 flex-1">
                {(control) => (
                  <TextField
                    {...control}
                    type="date"
                    value={draft.from}
                    onChange={(event) => {
                      setDraft({ ...draft, from: event.target.value });
                    }}
                  />
                )}
              </FormField>
              <FormField label="To" error={shownError} className="min-w-0 flex-1">
                {(control) => (
                  <TextField
                    {...control}
                    type="date"
                    value={draft.to}
                    onChange={(event) => {
                      setDraft({ ...draft, to: event.target.value });
                    }}
                  />
                )}
              </FormField>
            </div>
            <p className="text-small text-ink-500">Local time. “To” includes the whole day.</p>
            <div className="flex justify-end gap-2">
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
        </div>
      )}
    </div>
  );
}
