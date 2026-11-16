// StepCriticalVariables: the body of step 4 of the onboarding (derived, D-146: no frame draws it), "Variables to know first":
// the global variables the API lists, in its order (used by the most screens first), each with its number, name (a link to
// /variables/:id), data type, the screen it is created in (a link to /screens/:id) or "No origin screen", and how many
// screens use it. Props: summary.
import { Braces } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState, ICON_STROKE_WIDTH, Tag } from '../../components/ui';
import { elementHref } from '../dependency-map/nodeLinks';
import { DATA_TYPE_LABEL } from '../variables/variableLabels';

import type { OnboardingSummary } from './onboardingModel';
import {
  CREATED_IN_LABEL,
  EMPTY_VARIABLES_TEXT,
  EMPTY_VARIABLES_TITLE,
  NO_ORIGIN_TEXT,
  usedByOf,
  VARIABLES_LIST_LABEL,
} from './onboardingTexts';

export function StepCriticalVariables({ summary }: { summary: OnboardingSummary }) {
  const { globalVariables } = summary;
  if (globalVariables.length === 0) {
    return (
      <EmptyState
        icon={<Braces strokeWidth={ICON_STROKE_WIDTH} />}
        title={EMPTY_VARIABLES_TITLE}
        description={EMPTY_VARIABLES_TEXT}
      />
    );
  }
  return (
    <ol aria-label={VARIABLES_LIST_LABEL} className="flex flex-col">
      {globalVariables.map((item, index) => (
        <li
          key={item.variable.id}
          className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-divider py-3 last:border-b-0"
        >
          <span aria-hidden="true" className="text-body text-ink-500">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              to={elementHref({ type: 'VARIABLE', id: item.variable.id })}
              className="w-fit font-mono text-label font-semibold wrap-break-word text-identifier hover:underline"
            >
              {item.variable.name}
            </Link>
            <p className="text-small text-ink-500">
              {item.originScreen === null ? (
                NO_ORIGIN_TEXT
              ) : (
                <>
                  {CREATED_IN_LABEL}{' '}
                  <Link
                    to={elementHref({ type: 'SCREEN', id: item.originScreen.id })}
                    className="font-mono font-semibold wrap-break-word text-identifier hover:underline"
                  >
                    {item.originScreen.name}
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Tag>{DATA_TYPE_LABEL[item.dataType]}</Tag>
            <p className="text-small text-ink-700">{usedByOf(item.usedByScreens)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
