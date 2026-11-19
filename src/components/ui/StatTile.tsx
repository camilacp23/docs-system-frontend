// StatTile: a counter card of a list page (variables, collections): a solid icon tile with a white glyph, the figure large
// in the ink of its tone and the label under it, on a wash of the tone. It has one size on every page (min height 92 px),
// so the counters of two pages look the same.
// Props: icon, value (null shows a dash while it loads or failed), label, tone ('variable' | 'collection' | 'screen' |
// 'review' | 'success' | 'teal' | 'danger' | 'neutral' | 'jira'), share (0-100: draws a thin bar under the label, decoration), and, to make it a filter,
// `onPress` + `pressed` (+ `ariaLabel`, the accessible name when it differs from the visible label): the card is then a
// button with aria-pressed, a ring and a check while it is on (the check is decoration: aria-pressed says it).
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx } from './cx';

export type StatTone =
  | 'variable'
  | 'collection'
  | 'screen'
  | 'review'
  | 'success'
  | 'teal'
  | 'danger'
  | 'neutral'
  | 'jira';

/** Written out so Tailwind finds the classes. */
const TONE: Record<
  StatTone,
  { card: string; tile: string; ink: string; bar: string; ring: string; check: string }
> = {
  variable: {
    card: 'border-variable-border from-variable-soft',
    tile: 'bg-variable text-on-primary',
    ink: 'text-variable-ink',
    bar: 'bg-variable',
    ring: 'ring-variable',
    check: 'bg-variable text-on-primary',
  },
  collection: {
    card: 'border-collection-border from-collection-soft',
    tile: 'bg-collection text-on-primary',
    ink: 'text-collection-ink',
    bar: 'bg-collection',
    ring: 'ring-collection',
    check: 'bg-collection text-on-primary',
  },
  screen: {
    card: 'border-screen-border from-screen-soft',
    tile: 'bg-screen text-on-primary',
    ink: 'text-screen-ink',
    bar: 'bg-screen',
    ring: 'ring-screen',
    check: 'bg-screen text-on-primary',
  },
  // In review: the orange of the status "In review" (Table 54), the same as the donut and the Tags.
  review: {
    card: 'border-status-in-review/30 from-status-in-review-bg',
    tile: 'bg-status-in-review text-on-primary',
    ink: 'text-status-in-review-ink',
    bar: 'bg-status-in-review',
    ring: 'ring-status-in-review',
    check: 'bg-status-in-review text-on-primary',
  },
  success: {
    card: 'border-success-border from-success-bg',
    tile: 'bg-success text-on-primary',
    ink: 'text-success-ink',
    bar: 'bg-success',
    ring: 'ring-success',
    check: 'bg-success text-on-primary',
  },
  teal: {
    card: 'border-primary/20 from-empty-icon-bg',
    tile: 'bg-primary text-on-primary',
    ink: 'text-primary',
    bar: 'bg-primary',
    ring: 'ring-primary',
    check: 'bg-primary text-on-primary',
  },
  danger: {
    card: 'border-danger-border from-danger-bg',
    tile: 'bg-danger text-on-primary',
    ink: 'text-danger',
    bar: 'bg-danger',
    ring: 'ring-danger',
    check: 'bg-danger text-on-primary',
  },
  jira: {
    card: 'border-jira-border from-jira-soft',
    tile: 'bg-jira text-on-primary',
    ink: 'text-jira-ink',
    bar: 'bg-jira',
    ring: 'ring-jira',
    check: 'bg-jira text-on-primary',
  },
  neutral: {
    card: 'border-border-subtle from-canvas',
    tile: 'bg-ink-500 text-on-primary',
    ink: 'text-ink-700',
    bar: 'bg-ink-500',
    ring: 'ring-ink-500',
    check: 'bg-ink-500 text-on-primary',
  },
};

export interface StatTileProps {
  icon: ReactNode;
  value: number | null;
  label: string;
  tone: StatTone;
  share?: number;
  onPress?: () => void;
  pressed?: boolean;
  ariaLabel?: string;
  /** Accessible text of the dash drawn while `value` is null ("Unavailable" when the figure could not be read). */
  unavailableLabel?: string;
}

const CARD_CLASS =
  'relative flex min-h-23 items-center gap-3.5 rounded-modal border bg-linear-to-br to-surface p-3.5 text-left shadow-card';

export function StatTile({
  icon,
  value,
  label,
  tone,
  share,
  onPress,
  pressed = false,
  ariaLabel,
  unavailableLabel,
}: StatTileProps) {
  const style = TONE[tone];
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cx(
          'flex size-9 shrink-0 items-center justify-center rounded-control shadow-button',
          style.tile,
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cx('text-heading font-extrabold', style.ink)}>
          {value === null && unavailableLabel !== undefined ? (
            <span aria-label={unavailableLabel}>–</span>
          ) : (
            (value ?? '–')
          )}
        </span>
        <span className="text-label font-medium text-ink-700">{label}</span>
        {share !== undefined && (
          <span
            aria-hidden="true"
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-pill bg-surface/80 shadow-field-inset"
          >
            <span
              className={cx('block h-full rounded-pill', style.bar)}
              style={{ width: `${share}%` }}
            />
          </span>
        )}
      </span>
      {onPress !== undefined && pressed && (
        <span
          aria-hidden="true"
          className={cx(
            'absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-pill',
            style.check,
          )}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </>
  );

  if (onPress === undefined) return <div className={cx(CARD_CLASS, style.card)}>{content}</div>;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      onClick={onPress}
      className={cx(
        CARD_CLASS,
        style.card,
        'w-full transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-button-hover motion-reduce:transform-none motion-reduce:transition-none',
        pressed && cx('ring-2', style.ring),
      )}
    >
      {content}
    </button>
  );
}
