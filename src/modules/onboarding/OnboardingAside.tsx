// OnboardingAside: the column on the right of /onboarding (S-38a to S-38c): "Explore while you read" (four links: App
// (OnStart), its Miro diagram when it has one, the dependency map and the search) and "<application> at a glance", the
// four figures of the summary. Props: summary (the answer of the API; null while it loads, then a skeleton), applicationName.
// The figures are the same as step 1 and come only from the summary, with the format of the dashboard (`apiPercentText`).
import { ChevronRight, ExternalLink, Network, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ElementTypeIcon, ICON_STROKE_WIDTH, Skeleton } from '../../components/ui';
import { apiPercentText } from '../dashboard/dashboardModel';
import { elementHref } from '../dependency-map/nodeLinks';
import { isHttpsUrl } from '../screens/httpsUrl';

import { countLabel, type OnboardingSummary } from './onboardingModel';
import {
  EXPLORE_APP_START,
  EXPLORE_MAP,
  EXPLORE_MIRO,
  EXPLORE_SEARCH,
  EXPLORE_TITLE,
  glanceTitleOf,
} from './onboardingTexts';

const ROW_CLASS =
  'flex items-center justify-between gap-3 border-b border-divider py-3 text-body font-semibold text-ink-900 last:border-b-0 hover:text-primary';

function ExploreRow({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="text-ink-700">
          {icon}
        </span>
        <span>{children}</span>
      </span>
      <ChevronRight
        aria-hidden="true"
        size={16}
        strokeWidth={ICON_STROKE_WIDTH}
        className="shrink-0 text-ink-500"
      />
    </>
  );
}

/** One figure of the glance: the number over its label (the label first in the DOM, as a term and its value). */
function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse justify-end gap-0.5 rounded-control border border-border-subtle px-3 py-2.5">
      <dt className="text-small text-ink-500">{label}</dt>
      <dd className="text-heading font-bold text-ink-900">{value}</dd>
    </div>
  );
}

export function OnboardingAside({
  summary,
  applicationName,
}: {
  summary: OnboardingSummary | null;
  applicationName: string;
}) {
  const miroLink = summary?.appContextScreen.miroLink;
  const miro = isHttpsUrl(miroLink) ? miroLink : null;
  return (
    <aside className="flex min-w-0 flex-col gap-4">
      <section
        aria-labelledby="onboarding-explore-title"
        className="rounded-card border border-border-subtle bg-surface p-5 shadow-card"
      >
        <h2 id="onboarding-explore-title" className="text-card-title font-bold text-ink-900">
          {EXPLORE_TITLE}
        </h2>
        {summary === null ? (
          <div aria-hidden="true" className="mt-3 flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <ul className="mt-2 flex flex-col">
            <li>
              <Link
                to={elementHref({ type: 'SCREEN', id: summary.appContextScreen.id })}
                className={ROW_CLASS}
              >
                <ExploreRow icon={<ElementTypeIcon type="screen" />}>
                  {EXPLORE_APP_START}
                </ExploreRow>
              </Link>
            </li>
            {miro !== null && (
              <li>
                <a href={miro} target="_blank" rel="noopener noreferrer" className={ROW_CLASS}>
                  <ExploreRow icon={<ExternalLink size={16} strokeWidth={ICON_STROKE_WIDTH} />}>
                    {EXPLORE_MIRO}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </ExploreRow>
                </a>
              </li>
            )}
            <li>
              <Link to="/dependency-map" className={ROW_CLASS}>
                <ExploreRow icon={<Network size={16} strokeWidth={ICON_STROKE_WIDTH} />}>
                  {EXPLORE_MAP}
                </ExploreRow>
              </Link>
            </li>
            <li>
              <Link to="/search" className={ROW_CLASS}>
                <ExploreRow icon={<Search size={16} strokeWidth={ICON_STROKE_WIDTH} />}>
                  {EXPLORE_SEARCH}
                </ExploreRow>
              </Link>
            </li>
          </ul>
        )}
      </section>
      <section
        aria-labelledby="onboarding-glance-title"
        className="mt-auto rounded-card border border-border-subtle bg-surface p-5 shadow-card"
      >
        <h2
          id="onboarding-glance-title"
          className="text-micro font-bold tracking-wider text-ink-500 uppercase"
        >
          {glanceTitleOf(applicationName)}
        </h2>
        {summary === null ? (
          <div aria-hidden="true" className="mt-3 grid grid-cols-2 gap-2.5">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-2.5">
            <Figure
              value={String(summary.counts.screens)}
              label={countLabel(summary.counts.screens, 'screen', 'screens')}
            />
            <Figure
              value={String(summary.counts.variables)}
              label={countLabel(summary.counts.variables, 'variable', 'variables')}
            />
            <Figure
              value={String(summary.counts.collections)}
              label={countLabel(summary.counts.collections, 'collection', 'collections')}
            />
            <Figure value={`${apiPercentText(summary.approvedPercent)}%`} label="approved" />
          </dl>
        )}
      </section>
    </aside>
  );
}
