// KpiCards: the row of figures of S-31: the approved percentage (dark card with a progress bar), screens in review,
// variables without origin, collections not linked and pending to-dos. Props: indicators (the answer of the API).
// Every figure comes from the API: the card of approved shows `approvedPercent` as sent (never recalculated); the others
// are "n of total". Each card has a link to its filtered list (S-31), a focusable element with a name of its own.
// Layout (SDD 7.3.7): from 1440 px the five cards share the row (the first a little wider); below it they take half the
// width: the dark card across the two columns and the other four two by two.
import { CircleCheck, ClipboardCheck, Database, ListTodo, Variable } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';

import { cx, ICON_STROKE_WIDTH, SECTION_TONE_TILE, type SectionTone } from '../../components/ui';

import {
  apiPercentText,
  PENDING_HREF,
  screensHref,
  UNDOCUMENTED_HREF,
  UNTRACED_HREF,
  type Indicators,
} from './dashboardModel';
import {
  APPROVED_LABEL,
  APPROVED_LINK_TEXT,
  PENDING_CAPTION,
  PENDING_LABEL,
  PENDING_LINK_TEXT,
  REVIEW_CAPTION,
  REVIEW_LABEL,
  REVIEW_LINK_TEXT,
  UNDOCUMENTED_LABEL,
  UNDOCUMENTED_LINK_TEXT,
  UNTRACED_LABEL,
  UNTRACED_LINK_TEXT,
} from './dashboardTexts';

const ICON = { size: 18, strokeWidth: ICON_STROKE_WIDTH, 'aria-hidden': true } as const;

interface KpiCardProps {
  label: string;
  value: string;
  caption: ReactNode;
  linkText: string;
  to: string;
  icon: ReactNode;
  tone: SectionTone;
}

function KpiCard({ label, value, caption, linkText, to, icon, tone }: KpiCardProps) {
  return (
    <article
      aria-label={label}
      className="flex flex-col gap-1 rounded-card border border-border-subtle bg-surface px-4.5 pt-4 pb-4 shadow-card"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cx(
            'flex size-8.5 shrink-0 items-center justify-center rounded-control',
            SECTION_TONE_TILE[tone],
          )}
        >
          {icon}
        </span>
        <h3 className="text-small text-ink-500">{label}</h3>
      </div>
      <p className="text-kpi font-extrabold text-ink-900">{value}</p>
      <p className="text-small text-ink-500">{caption}</p>
      <Link
        to={to}
        className="mt-0.5 w-fit rounded-chip text-[12.5px]/5 font-bold text-primary hover:underline"
      >
        {linkText}
      </Link>
    </article>
  );
}

export function KpiCards({ indicators }: { indicators: Indicators }) {
  const { documentation, variables, collections, jira } = indicators;
  const approved = documentation.byStatus.APPROVED;
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="grid grid-cols-2 gap-3.5 min-[1440px]:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,1fr))]"
    >
      <h2 id={headingId} className="sr-only">
        Indicators
      </h2>
      <article
        aria-label={APPROVED_LABEL}
        className="relative col-span-2 flex flex-col gap-1 overflow-hidden rounded-card bg-linear-to-br from-navy-900 to-navy-950 px-4.5 pt-4 pb-4 text-on-primary shadow-card min-[1440px]:col-span-1"
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="bg-white/12 flex size-8.5 shrink-0 items-center justify-center rounded-control"
          >
            <CircleCheck {...ICON} />
          </span>
          <h3 className="text-small text-sidebar-muted-2">{APPROVED_LABEL}</h3>
        </div>
        <p className="text-kpi font-extrabold">{apiPercentText(documentation.approvedPercent)}%</p>
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
        tone="warning"
      />
      <KpiCard
        label={UNTRACED_LABEL}
        value={String(variables.untraced)}
        caption={`of ${variables.total} ${variables.total === 1 ? 'variable' : 'variables'}`}
        linkText={UNTRACED_LINK_TEXT}
        to={UNTRACED_HREF}
        icon={<Variable {...ICON} />}
        tone="warning"
      />
      <KpiCard
        label={UNDOCUMENTED_LABEL}
        value={String(collections.undocumented)}
        caption={`of ${collections.total} ${collections.total === 1 ? 'collection' : 'collections'}`}
        linkText={UNDOCUMENTED_LINK_TEXT}
        to={UNDOCUMENTED_HREF}
        icon={<Database {...ICON} />}
        tone="accent"
      />
      <KpiCard
        label={PENDING_LABEL}
        value={String(jira.pendingSubtasks)}
        caption={PENDING_CAPTION}
        linkText={PENDING_LINK_TEXT}
        to={PENDING_HREF}
        icon={<ListTodo {...ICON} />}
        tone="accent"
      />
    </section>
  );
}
