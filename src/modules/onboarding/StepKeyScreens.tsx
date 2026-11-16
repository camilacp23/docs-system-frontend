// StepKeyScreens: the body of step 3 of the onboarding (S-38c), "Read these screens first": the key screens in the order the
// API sends them (the suggested reading order of D-124, never re-sorted here), each with its number, name (IBM Plex Mono),
// where it sits in the navigation (`depth`; null = not reachable from App (OnStart)), the Miro diagram when it has one, its
// status, its connections (the number and a bar relative to the largest of the list, aria-hidden, D-148) and "Open →". The
// frame also draws App (OnStart) here; the API leaves it out and it has its own link in the column on the right (D-124).
// Props: summary.
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState, ICON_STROKE_WIDTH, StatusTag } from '../../components/ui';
import { elementHref } from '../dependency-map/nodeLinks';
import { MiroLink } from '../screens/MiroLink';
import { toTagStatus } from '../screens/screenLabels';

import { barPercent, depthText, maxConnections, type OnboardingSummary } from './onboardingModel';
import {
  COLUMN_CONNECTIONS,
  COLUMN_NUMBER,
  COLUMN_SCREEN,
  COLUMN_STATUS,
  connectionsWordOf,
  EMPTY_KEY_SCREENS_TEXT,
  EMPTY_KEY_SCREENS_TITLE,
  KEY_SCREENS_LIST_LABEL,
  MIRO_LABEL,
  OPEN_LABEL,
  openNameOf,
} from './onboardingTexts';

const GRID = 'grid grid-cols-[1.5rem_minmax(0,1fr)_6.5rem_7.5rem_3.75rem] items-center gap-x-3';

export function StepKeyScreens({ summary }: { summary: OnboardingSummary }) {
  const { keyScreens } = summary;
  const max = maxConnections(keyScreens);
  if (keyScreens.length === 0) {
    return (
      <EmptyState
        icon={<ArrowRight strokeWidth={ICON_STROKE_WIDTH} />}
        title={EMPTY_KEY_SCREENS_TITLE}
        description={EMPTY_KEY_SCREENS_TEXT}
      />
    );
  }
  return (
    <div className="flex flex-col">
      <div
        aria-hidden="true"
        className={`${GRID} border-b border-divider pb-2 text-micro font-bold tracking-wider text-ink-500 uppercase`}
      >
        <span>{COLUMN_NUMBER}</span>
        <span>{COLUMN_SCREEN}</span>
        <span>{COLUMN_STATUS}</span>
        <span>{COLUMN_CONNECTIONS}</span>
        <span />
      </div>
      <ol aria-label={KEY_SCREENS_LIST_LABEL} className="flex flex-col">
        {keyScreens.map((item, index) => (
          <li
            key={item.screen.id}
            className={`${GRID} border-b border-divider py-3 last:border-b-0`}
          >
            <span aria-hidden="true" className="text-body text-ink-500">
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-mono text-label font-semibold wrap-break-word text-identifier">
                {item.screen.name}
              </span>
              <span className="text-small text-ink-500">{depthText(item.depth)}</span>
              <MiroLink href={item.miroLink} className="w-fit text-small">
                {MIRO_LABEL}
              </MiroLink>
            </div>
            <StatusTag status={toTagStatus(item.documentationStatus)} />
            <div className="flex items-center gap-2">
              <span className="w-6 text-right text-body font-semibold text-ink-900">
                {item.connections}{' '}
                <span className="sr-only">{connectionsWordOf(item.connections)}</span>
              </span>
              <span
                aria-hidden="true"
                className="h-1.5 flex-1 overflow-hidden rounded-pill bg-disabled-bg"
              >
                <span
                  className="block h-full rounded-pill bg-primary"
                  style={{ width: `${barPercent(item.connections, max)}%` }}
                />
              </span>
            </div>
            <Link
              to={elementHref({ type: 'SCREEN', id: item.screen.id })}
              aria-label={openNameOf(item.screen.name)}
              className="inline-flex items-center gap-1 rounded-chip text-body font-semibold text-primary hover:underline"
            >
              {OPEN_LABEL}
              <ArrowRight aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
