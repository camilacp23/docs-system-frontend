// KpiCards: the row of figures of S-31: the approved percentage (dark card with a progress bar), screens in review,
// variables without origin, collections not linked and pending to-dos. Props: indicators (the answer of the API).
// Every figure comes from the API: the card of approved shows `approvedPercent` as sent (never recalculated); the others
// are "n of total". Each card has a link to its filtered list (S-31), a focusable element with a name of its own.
// Layout (SDD 7.3.7): the five cards share one row while the container is at least 940 px wide (the first a little
// wider, as in S-31); narrower, a row of three (the dark card and two more) and a row of two.
import { CircleCheck, ClipboardCheck, Database, ListTodo, Variable } from 'lucide-react';
import { Fragment, useId, type ReactNode } from 'react';
import { Link } from 'react-router';

import { cx, ICON_STROKE_WIDTH, Tag } from '../../components/ui';

import {
  apiPercentText,
  PENDING_HREF,
  screensHref,
  syncedText,
  UNDOCUMENTED_HREF,
  UNTRACED_HREF,
  type Indicators,
} from './dashboardModel';
import {
  APPROVED_LABEL,
  APPROVED_LINK_TEXT,
  JIRA_UNAVAILABLE_CAPTION,
  JIRA_UNAVAILABLE_NEVER_CAPTION,
  PENDING_CAPTION,
  PENDING_LABEL,
  PENDING_LINK_TEXT,
  REVIEW_CAPTION,
  REVIEW_LABEL,
  REVIEW_LINK_TEXT,
  STALE_TAG,
  UNDOCUMENTED_LABEL,
  UNDOCUMENTED_LINK_TEXT,
  UNTRACED_LABEL,
  UNTRACED_LINK_TEXT,
} from './dashboardTexts';

/**
 * The row of figures answers to the width of its container, not of the window (so a collapsed sidebar is also used):
 * from 940 px the five cards share one row as in the frame (the first a little wider); below that, a row of three (the
 * dark card and two more) and a row of two, each card as compact as in the frame. 940 px is where, measured in Edge with
 * the real fonts, every title keeps at most two lines and every figure fits (the narrowest card is 162 px).
 */
const ROW_CLASS =
  'grid grid-cols-6 gap-3.5 @min-[940px]:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,1fr))]';
const FIRST_ROW_CARD = 'col-span-2 @min-[940px]:col-span-1';
const SECOND_ROW_CARD = 'col-span-3 @min-[940px]:col-span-1';

/** The text of a label with every hyphenated word in one piece ("to-dos"): the browser would break it after the hyphen. */
function Label({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((word, index) => (
        <Fragment key={index}>
          {index > 0 && ' '}
          {word.includes('-') ? <span className="whitespace-nowrap">{word}</span> : word}
        </Fragment>
      ))}
    </>
  );
}

const ICON = { size: 16, strokeWidth: ICON_STROKE_WIDTH, 'aria-hidden': true } as const;

/** Each figure card has a tinted surface of its own: card (wash + border), tile (icon), ink (figure and link). */
type KpiTone = 'review' | 'danger' | 'accent' | 'jira';
const KPI_TONE: Record<KpiTone, { card: string; tile: string; ink: string }> = {
  // In review: the orange of the status "In review" (Table 54), the same as the donut and the Tags.
  review: {
    card: 'border-status-in-review/30 from-status-in-review-bg',
    tile: 'bg-status-in-review text-on-primary',
    ink: 'text-status-in-review-ink',
  },
  danger: {
    card: 'border-danger-border from-danger-bg',
    tile: 'bg-danger text-on-primary',
    ink: 'text-danger',
  },
  accent: {
    card: 'border-info-border from-accent-soft',
    tile: 'bg-accent text-on-primary',
    ink: 'text-accent-ink',
  },
  jira: {
    card: 'border-jira-border from-jira-soft',
    tile: 'bg-jira text-on-primary',
    ink: 'text-jira-ink',
  },
};

interface KpiCardProps {
  label: string;
  value: string;
  caption: ReactNode;
  linkText: string;
  to: string;
  icon: ReactNode;
  tone: KpiTone;
  /** A tag next to the figure (the "Stale" of the pending to-dos). */
  badge?: ReactNode;
  /** Where the card sits in the row (see ROW_CLASS and WRAP_CLASS). */
  className?: string;
}

function KpiCard({
  label,
  value,
  caption,
  linkText,
  to,
  icon,
  tone,
  badge,
  className,
}: KpiCardProps) {
  const style = KPI_TONE[tone];
  return (
    <article
      aria-label={label}
      className={cx(
        'flex flex-col gap-1 rounded-modal border bg-linear-to-br to-surface px-4 py-3.5 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-button-hover motion-reduce:transition-none motion-reduce:hover:transform-none',
        style.card,
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cx(
            'flex size-8 shrink-0 items-center justify-center rounded-control shadow-button',
            style.tile,
          )}
        >
          {icon}
        </span>
        <h3 className="text-small font-medium text-ink-700">
          <Label text={label} />
        </h3>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className={cx('text-heading font-extrabold', style.ink)}>{value}</p>
        {badge}
      </div>
      <p className="text-small text-ink-700">{caption}</p>
      <Link
        to={to}
        className={cx(
          'mt-0.5 w-fit rounded-chip text-[12.5px]/5 font-bold hover:underline',
          style.ink,
        )}
      >
        {linkText}
      </Link>
    </article>
  );
}

export function KpiCards({ indicators, timeZone }: { indicators: Indicators; timeZone: string }) {
  const { documentation, variables, collections, jira } = indicators;
  const approved = documentation.byStatus.APPROVED;
  const headingId = useId();
  // Jira: the figure is always the local copy. While Jira answers the card shows only the caption (the age of the copy is a chip in the header of the by-screen card, JiraSyncChip). While it does not, the card is marked stale and says so in one caption; the date of the copy is
  // in the banner under the row, so the card keeps the height of its neighbours (S-31j).
  const synced = syncedText(jira.lastSyncedAt, timeZone);
  const pendingCaption = jira.jiraAvailable
    ? PENDING_CAPTION
    : synced === null
      ? JIRA_UNAVAILABLE_NEVER_CAPTION
      : JIRA_UNAVAILABLE_CAPTION;
  return (
    <section aria-labelledby={headingId} className={ROW_CLASS}>
      <h2 id={headingId} className="sr-only">
        Indicators
      </h2>
      <article
        aria-label={APPROVED_LABEL}
        className={cx(
          'relative flex flex-col gap-1 overflow-hidden rounded-modal bg-(image:--gradient-sidebar) px-4 py-3.5 text-on-primary shadow-card',
          FIRST_ROW_CARD,
        )}
      >
        <span
          aria-hidden="true"
          className="absolute -top-10 -right-8 size-32 rounded-full bg-accent/25 blur-2xl"
        />
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="bg-white/12 flex size-8 shrink-0 items-center justify-center rounded-control"
          >
            <CircleCheck {...ICON} />
          </span>
          <h3 className="text-small text-sidebar-muted-2">{APPROVED_LABEL}</h3>
        </div>
        <p className="text-heading font-extrabold">
          {apiPercentText(documentation.approvedPercent)}%
        </p>
        <div aria-hidden="true" className="bg-white/12 h-2 overflow-hidden rounded-chip">
          <div
            className="h-full rounded-chip bg-linear-to-r from-accent to-sidebar-live-dot"
            style={{ width: `${documentation.approvedPercent}%` }}
          />
        </div>
        <p className="text-small text-sidebar-muted-2">
          {approved} of {documentation.totalScreens}{' '}
          {documentation.totalScreens === 1 ? 'screen' : 'screens'} approved
        </p>
        <Link
          to={screensHref('APPROVED')}
          className="mt-0.5 w-fit rounded-chip text-[12.5px]/5 font-bold text-sidebar-active-indicator hover:underline"
        >
          {APPROVED_LINK_TEXT}
        </Link>
      </article>
      <KpiCard
        label={REVIEW_LABEL}
        value={String(documentation.byStatus.IN_REVIEW)}
        caption={REVIEW_CAPTION}
        linkText={REVIEW_LINK_TEXT}
        to={screensHref('IN_REVIEW')}
        icon={<ClipboardCheck {...ICON} />}
        tone="review"
        className={FIRST_ROW_CARD}
      />
      <KpiCard
        label={UNTRACED_LABEL}
        value={String(variables.untraced)}
        caption={`of ${variables.total} ${variables.total === 1 ? 'variable' : 'variables'}`}
        linkText={UNTRACED_LINK_TEXT}
        to={UNTRACED_HREF}
        icon={<Variable {...ICON} />}
        tone="danger"
        className={FIRST_ROW_CARD}
      />
      <KpiCard
        label={UNDOCUMENTED_LABEL}
        value={String(collections.undocumented)}
        caption={`of ${collections.total} ${collections.total === 1 ? 'collection' : 'collections'}`}
        linkText={UNDOCUMENTED_LINK_TEXT}
        to={UNDOCUMENTED_HREF}
        icon={<Database {...ICON} />}
        tone="accent"
        className={SECOND_ROW_CARD}
      />
      <KpiCard
        label={PENDING_LABEL}
        value={String(jira.pendingSubtasks)}
        caption={pendingCaption}
        badge={jira.jiraAvailable ? undefined : <Tag tone="warning">{STALE_TAG}</Tag>}
        linkText={PENDING_LINK_TEXT}
        to={PENDING_HREF}
        icon={<ListTodo {...ICON} />}
        tone="jira"
        className={SECOND_ROW_CARD}
      />
    </section>
  );
}
