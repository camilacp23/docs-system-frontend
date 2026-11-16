// CommentEditor: the text box of the composer and of the in-line edit, with its counter and its error.
// Props: label (the accessible name; drawn only for screen readers, the frame has no visible label), placeholder,
// value, onChange(text), error (text under the box or null), hint (text before the counter: "Plain text"), actions
// (the buttons on the right of the counter row), disabled (the box is read-only text while sending), disabledReason
// (why writing is blocked, announced with the box), textareaRef, rows.
// The box takes at most 4000 characters (the contract's limit); the counter says "n / 4000". The counter, the reason and
// the error are tied to the box with aria-describedby, and the error is an alert so it is announced when it appears.
import { CircleAlert } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode, RefObject } from 'react';

import { ICON_STROKE_WIDTH, Textarea } from '../../components/ui';

import { COMMENT_MAX_LENGTH } from './commentModel';

interface CommentEditorProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (text: string) => void;
  error: string | null;
  hint?: string;
  actions: ReactNode;
  disabled?: boolean;
  disabledReason?: string | null;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  rows?: number;
}

export function CommentEditor({
  label,
  placeholder,
  value,
  onChange,
  error,
  hint,
  actions,
  disabled = false,
  disabledReason = null,
  textareaRef,
  rows = 3,
}: CommentEditorProps) {
  const id = useId();
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;
  const reasonId = `${id}-reason`;
  const describedBy = [
    counterId,
    disabledReason === null ? null : reasonId,
    error === null ? null : errorId,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Textarea
        id={id}
        ref={textareaRef}
        rows={rows}
        value={value}
        maxLength={COMMENT_MAX_LENGTH}
        placeholder={placeholder}
        invalid={error !== null}
        disabled={disabled || disabledReason !== null}
        aria-describedby={describedBy}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {disabledReason !== null && (
        <p id={reasonId} className="text-small text-warning-ink">
          {disabledReason}
        </p>
      )}
      {error !== null && (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-small text-danger">
          <CircleAlert aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <span id={counterId} className="text-small text-ink-500">
          {hint !== undefined && `${hint} · `}
          {value.length} / {COMMENT_MAX_LENGTH}
        </span>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
