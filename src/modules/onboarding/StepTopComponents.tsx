// StepTopComponents: the body of step 5 of the onboarding (derived, D-146: no frame draws it), "Components that use the most
// data": the components the API lists, in its order (the most uses first), each with its number, name (a link to the
// "Components & navigation" tab of its screen, D-102: a component has no page of its own), the screen that holds it (a link
// to /screens/:id) and its `uses` (variables and collections it uses). Props: summary.
import { Box } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState, ICON_STROKE_WIDTH } from '../../components/ui';
import { elementHref } from '../dependency-map/nodeLinks';

import type { OnboardingSummary } from './onboardingModel';
import {
  COMPONENTS_LIST_LABEL,
  EMPTY_COMPONENTS_TEXT,
  EMPTY_COMPONENTS_TITLE,
  IN_SCREEN_LABEL,
  usesOf,
} from './onboardingTexts';

export function StepTopComponents({ summary }: { summary: OnboardingSummary }) {
  const { topComponents } = summary;
  if (topComponents.length === 0) {
    return (
      <EmptyState
        icon={<Box strokeWidth={ICON_STROKE_WIDTH} />}
        title={EMPTY_COMPONENTS_TITLE}
        description={EMPTY_COMPONENTS_TEXT}
      />
    );
  }
  return (
    <ol aria-label={COMPONENTS_LIST_LABEL} className="flex flex-col">
      {topComponents.map((item, index) => (
        <li
          key={item.component.id}
          className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-divider py-3 last:border-b-0"
        >
          <span aria-hidden="true" className="text-body text-ink-500">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              to={elementHref({ type: 'COMPONENT', screenId: item.screen.id })}
              className="w-fit font-mono text-label font-semibold wrap-break-word text-identifier hover:underline"
            >
              {item.component.name}
            </Link>
            <p className="text-small text-ink-500">
              {IN_SCREEN_LABEL}{' '}
              <Link
                to={elementHref({ type: 'SCREEN', id: item.screen.id })}
                className="font-mono font-semibold wrap-break-word text-identifier hover:underline"
              >
                {item.screen.name}
              </Link>
            </p>
          </div>
          <p className="text-small text-ink-700">{usesOf(item.uses)}</p>
        </li>
      ))}
    </ol>
  );
}
