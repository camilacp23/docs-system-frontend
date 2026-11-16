// OnboardingHeader: the top of /onboarding (S-38a to S-38c): the title "Onboarding · <application>" (the h1), the subtitle and, on
// the right, "Step N of 5" with Back and "Next: <step>". Back is not drawn on step 1; on step 5 "Next" gives way to "Go to
// Dashboard" (D-146). They are links to `?step=N`, so each press is one entry of the history (D-147).
// Props: step (1 to 5), applicationName.
import { ArrowRight } from 'lucide-react';

import { ButtonLink, ICON_STROKE_WIDTH } from '../../components/ui';

import { FIRST_STEP, STEP_COUNT, stepHref, stepInfo } from './onboardingModel';
import {
  BACK_LABEL,
  DASHBOARD_LABEL,
  nextLabelOf,
  pageTitleOf,
  stepCounterOf,
  subtitleOf,
} from './onboardingTexts';

export function OnboardingHeader({
  step,
  applicationName,
}: {
  step: number;
  applicationName: string;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-page-title font-extrabold wrap-break-word text-ink-900">
          {pageTitleOf(applicationName)}
        </h1>
        <p className="text-body text-ink-500">{subtitleOf(applicationName)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <p className="text-small text-ink-500">{stepCounterOf(step, STEP_COUNT)}</p>
        {step > FIRST_STEP && (
          <ButtonLink to={stepHref(step - 1)} variant="secondary">
            {BACK_LABEL}
          </ButtonLink>
        )}
        {step < STEP_COUNT ? (
          <ButtonLink to={stepHref(step + 1)} variant="primary">
            {nextLabelOf(stepInfo(step + 1).label)}
            <ArrowRight aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
          </ButtonLink>
        ) : (
          <ButtonLink to="/dashboard" variant="primary">
            {DASHBOARD_LABEL}
          </ButtonLink>
        )}
      </div>
    </header>
  );
}
