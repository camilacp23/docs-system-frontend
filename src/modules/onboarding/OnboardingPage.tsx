// OnboardingPage: /onboarding (FR-25, S-38a to S-38c), the guided introduction to the selected application in five steps.
// Loaded when the route is opened (lazyPage). The three roles reach it. No props.
//  - One read per application: GET /onboarding/summary (useOnboardingSummary). Moving between steps never reads again;
//    changing the application reads again and goes back to step 1 (D-147). An archived application looks like any other.
//  - The step is in the URL, `?step=1` to `?step=5` (D-147): Back and Next are links, so each press is one history entry and
//    the browser's Back and Forward walk the steps. A missing parameter is step 1; an invalid one is replaced by `?step=1`.
//  - When the step changes the focus goes to the title of the step (an h2); not on the first render.
//  - The header, the stepper and the titles are drawn while the summary loads; only what needs it shows a skeleton after
//    300 ms (and "This is taking longer than usual." after 10 s, S-39a). A failed read shows the server-error state with
//    "Try again"; a 404 (the application does not exist) shows S-41a and reads the list of applications again.
//  - Layout (SDD 7.3.7): three columns (path, step, "Explore") from 1100 px of container; narrower, the right column goes
//    under the other two.
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { useApplication } from '../../application/useApplication';
import { ErrorState, Skeleton, SLOW_LOADING_MESSAGE, useDelayedLoading } from '../../components/ui';

import { FIRST_STEP, parseStep, stepHref } from './onboardingModel';
import { LOADING_LABEL, stepFrameOf } from './onboardingTexts';
import { OnboardingAside } from './OnboardingAside';
import { OnboardingHeader } from './OnboardingHeader';
import { OnboardingStepper } from './OnboardingStepper';
import { StepAppStart } from './StepAppStart';
import { StepCriticalVariables } from './StepCriticalVariables';
import { StepFrame } from './StepFrame';
import { StepKeyScreens } from './StepKeyScreens';
import { StepOverview } from './StepOverview';
import { StepTopComponents } from './StepTopComponents';
import { useOnboardingSummary } from './useOnboardingSummary';
export function OnboardingPage() {
  const { currentApplication, currentApplicationId, reload: reloadApplications } = useApplication();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { step, valid } = parseStep(params.get('step'));
  const resource = useOnboardingSummary(currentApplicationId);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const previousApplication = useRef<number | null>(null);
  const loading = resource.status === 'loading' && resource.summary === null;
  const { showSkeleton, isSlow } = useDelayedLoading(loading);

  useEffect(() => {
    // An invalid step is not kept in the history: it is replaced by step 1 (D-147).
    if (!valid) void navigate(stepHref(FIRST_STEP), { replace: true });
  }, [valid, navigate]);

  useEffect(() => {
    // Changing the application starts the path over (D-147). The first application of the page is not a change.
    const before = previousApplication.current;
    previousApplication.current = currentApplicationId;
    if (before !== null && currentApplicationId !== null && before !== currentApplicationId) {
      void navigate(stepHref(FIRST_STEP), { replace: true });
    }
  }, [currentApplicationId, navigate]);

  useEffect(() => {
    // The focus goes to the title of the new step, not on arrival (D-147).
    if (previousStep.current === step) return;
    previousStep.current = step;
    headingRef.current?.focus();
  }, [step]);

  if (currentApplication === null) return null;

  if (resource.error?.code === 'NOT_FOUND') {
    return (
      <ErrorState
        variant="not-found"
        element="application"
        listLabel="Dashboard"
        className="flex-1"
        onAction={reloadApplications}
      />
    );
  }
  if (resource.status === 'error' && resource.summary === null) {
    return (
      <ErrorState
        variant="server-error"
        requestId={resource.error?.requestId ?? undefined}
        className="flex-1"
        onAction={resource.reload}
      />
    );
  }

  const { summary } = resource;
  const name = currentApplication.name;
  const platform = currentApplication.platform;

  let body;
  if (summary === null) {
    // The same frame, with the title the user already has, over a skeleton: the title never remounts when the data arrives.
    body = (
      <div aria-busy="true">
        {showSkeleton && (
          <div role="status" aria-label={LOADING_LABEL} className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            {isSlow && <p className="text-small text-ink-500">{SLOW_LOADING_MESSAGE}</p>}
          </div>
        )}
      </div>
    );
  } else if (step === 2) {
    body = <StepAppStart summary={summary} />;
  } else if (step === 3) {
    body = <StepKeyScreens summary={summary} />;
  } else if (step === 4) {
    body = <StepCriticalVariables summary={summary} />;
  } else if (step === 5) {
    body = <StepTopComponents summary={summary} />;
  } else {
    body = <StepOverview summary={summary} />;
  }
  const frame = stepFrameOf(step, name, platform);

  return (
    <div className="@container flex flex-1 flex-col gap-5">
      <OnboardingHeader step={step} applicationName={name} />
      <div className="grid flex-1 grid-cols-[15rem_minmax(0,1fr)] items-stretch gap-4 @min-[1100px]:grid-cols-[15rem_minmax(0,1fr)_17.5rem]">
        <OnboardingStepper step={step} />
        <StepFrame step={step} title={frame.title} lead={frame.lead} headingRef={headingRef}>
          {body}
        </StepFrame>
        <div className="col-span-2 flex flex-col @min-[1100px]:col-span-1">
          <OnboardingAside summary={summary} applicationName={name} />
        </div>
      </div>
    </div>
  );
}
