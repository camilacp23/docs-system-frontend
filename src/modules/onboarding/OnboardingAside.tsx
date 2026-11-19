// OnboardingAside: the card on the right of /onboarding (S-38a to S-38c), one card with two sections, as tall as the step next to it
// (the glance takes the room that is left): "Explore while you read" (four links: App (OnStart), its Miro diagram when it has one,
// the dependency map and the search) and "<application> at a glance", the four figures of the summary.
// Props: summary (the answer of the API; null while it loads, then a skeleton), applicationName, step (the step on screen).
// The figures are the same as step 1 and come only from the summary, with the format of the dashboard (`apiPercentText`).
// Opening a page of the application from "Explore" starts the onboarding trail (trailContext): the guide bubble follows the user to
// that page, so they keep the context of the step they were reading. The Miro diagram opens in a new tab and starts nothing.
import { ChevronRight, ExternalLink, Network, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { cx, ElementTypeIcon, ICON_STROKE_WIDTH, Skeleton } from '../../components/ui';
import { apiPercentText } from '../dashboard/dashboardModel';
import { elementHref } from '../dependency-map/nodeLinks';
import { isHttpsUrl } from '../screens/httpsUrl';

import { stepTone, type StepTone } from './onboardingTones';
import { countLabel, type OnboardingSummary } from './onboardingModel';
import {
  EXPLORE_APP_START,
  EXPLORE_MAP,
  EXPLORE_MIRO,
  EXPLORE_SEARCH,
  EXPLORE_TITLE,
  glanceTitleOf,
} from './onboardingTexts';
import { useOnboardingTrail } from './trailContext';

const rowClass = (tone: StepTone) =>
  cx(
    'flex items-center justify-between gap-3 border-b border-divider py-2.5 text-body font-semibold text-ink-900 last:border-b-0',
    tone.hover,
  );

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
function Figure({ value, label, tone }: { value: string; label: string; tone: StepTone }) {
  return (
    <div
      className={cx(
        'flex flex-col-reverse justify-center gap-0.5 rounded-control border bg-surface px-3 py-2.5',
        tone.figureBorder,
      )}
    >
      <dt className="text-small text-ink-500">{label}</dt>
      <dd className={cx('text-heading font-bold', tone.ink)}>{value}</dd>
    </div>
  );
}

export function OnboardingAside({
  summary,
  applicationName,
  step,
}: {
  summary: OnboardingSummary | null;
  applicationName: string;
  step: number;
}) {
  const { start } = useOnboardingTrail();
  const tone = stepTone(step);
  const ROW_CLASS = rowClass(tone);
  const miroLink = summary?.appContextScreen.miroLink;
  const miro = isHttpsUrl(miroLink) ? miroLink : null;
  /** Leaving for a page of the application: the guide bubble goes along. */
  const explore = (destination: string) => () => {
    start({ step, destination });
  };
  return (
    <aside
      className={cx(
        'flex min-w-0 flex-col divide-y divide-divider overflow-hidden rounded-modal border bg-surface shadow-card',
        tone.border,
      )}
    >
      <section aria-labelledby="onboarding-explore-title" className="p-5">
        <h2
          id="onboarding-explore-title"
          className={cx('text-micro font-bold tracking-wider uppercase', tone.ink)}
        >
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
                onClick={explore(EXPLORE_APP_START)}
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
              <Link to="/dependency-map" className={ROW_CLASS} onClick={explore(EXPLORE_MAP)}>
                <ExploreRow icon={<Network size={16} strokeWidth={ICON_STROKE_WIDTH} />}>
                  {EXPLORE_MAP}
                </ExploreRow>
              </Link>
            </li>
            <li>
              <Link to="/search" className={ROW_CLASS} onClick={explore(EXPLORE_SEARCH)}>
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
        className={cx('flex flex-1 flex-col p-5', tone.soft)}
      >
        <h2
          id="onboarding-glance-title"
          className={cx('text-micro font-bold tracking-wider uppercase', tone.ink)}
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
          <dl className="mt-3 grid flex-1 grid-cols-2 grid-rows-[repeat(2,minmax(4.5rem,9rem))] content-start gap-2.5">
            <Figure
              value={String(summary.counts.screens)}
              label={countLabel(summary.counts.screens, 'screen', 'screens')}
              tone={tone}
            />
            <Figure
              value={String(summary.counts.variables)}
              label={countLabel(summary.counts.variables, 'variable', 'variables')}
              tone={tone}
            />
            <Figure
              value={String(summary.counts.collections)}
              label={countLabel(summary.counts.collections, 'collection', 'collections')}
              tone={tone}
            />
            <Figure
              value={`${apiPercentText(summary.approvedPercent)}%`}
              label="approved"
              tone={tone}
            />
          </dl>
        )}
      </section>
    </aside>
  );
}
