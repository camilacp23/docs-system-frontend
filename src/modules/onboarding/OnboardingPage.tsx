// OnboardingPage: /onboarding (FR-25, S-38a to S-38c), the guided introduction to the selected application in five steps.
// Loaded when the route is opened (lazyPage). The three roles reach it. No props.
//  - Two reads per application: GET /onboarding/summary (useOnboardingSummary) and the saved progress, GET /onboarding/progress
//    (useOnboardingProgress, contract 0.4.0: the steps this user completed, personal and per application). Moving between steps never
//    reads again; changing the application reads both again and starts the path over (D-147). An archived application looks like any other.
//  - Progress: with no `step` in the URL the page opens at the first step that is not completed (the list can have gaps), or at step 1
//    with a "completed" chip when the five are. "Mark step as complete" (in the hero, on the right of the title) saves it with a PUT, which is
//    idempotent and answers the whole progress (it replaces the state, no new read), and moves on to the next step; nothing is saved
//    when the user only walks the path. "Restart onboarding" (next to it, after a confirmation) forgets the steps with a DELETE. A progress that
//    cannot be read never breaks the page: the foot of the step says so and offers "Try again".
//  - The step is in the URL, `?step=1` to `?step=5` (D-147): the steps of the stepper are links, so each press is one history entry and
//    the browser's Back and Forward walk the steps. A missing parameter opens at the first step still to do (step 1 without progress); an invalid one is replaced by `?step=1`.
//  - When the step changes the focus goes to the title of the step (an h2); not on the first render.
//  - The header, the stepper and the titles are drawn while the summary loads; only what needs it shows a skeleton after
//    300 ms (and "This is taking longer than usual." after 10 s, S-39a). A failed read shows the server-error state with
//    "Try again"; a 404 (the application does not exist) shows S-41a and reads the list of applications again.
//  - Layout (SDD 7.3.7): the hero, the path as a row of steps, and under them the step and a card on the right ("Explore" and the
//    glance) from 1100 px of container, where the height is the one of that card and the step scrolls inside when it is longer;
//    narrower, the card goes under the step and the page scrolls.
//  - A page opened from "Explore" starts the onboarding trail: the guide bubble (OnboardingBubble, in the shell) goes along.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { getThrownMessage } from '../../api/messages';
import { useApplication } from '../../application/useApplication';
import {
  ErrorState,
  Skeleton,
  SLOW_LOADING_MESSAGE,
  useDelayedLoading,
  useToast,
} from '../../components/ui';

import {
  firstIncompleteStep,
  FIRST_STEP,
  parseStep,
  STEP_COUNT,
  stepHref,
} from './onboardingModel';
import {
  LOADING_LABEL,
  RESTARTED_TOAST,
  stepCompletedToastOf,
  stepFrameOf,
} from './onboardingTexts';
import { OnboardingAside } from './OnboardingAside';
import { OnboardingHeader } from './OnboardingHeader';
import { OnboardingStepFooter } from './OnboardingStepFooter';
import { OnboardingStepper } from './OnboardingStepper';
import { RestartOnboardingModal } from './RestartOnboardingModal';
import { StepAppStart } from './StepAppStart';
import { StepCriticalVariables } from './StepCriticalVariables';
import { StepFrame } from './StepFrame';
import { StepKeyScreens } from './StepKeyScreens';
import { StepOverview } from './StepOverview';
import { StepTopComponents } from './StepTopComponents';
import { useOnboardingProgress } from './useOnboardingProgress';
import { useOnboardingSummary } from './useOnboardingSummary';
export function OnboardingPage() {
  const { currentApplication, currentApplicationId, reload: reloadApplications } = useApplication();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { step, valid } = parseStep(params.get('step'));
  const resource = useOnboardingSummary(currentApplicationId);
  const progress = useOnboardingProgress(currentApplicationId);
  const toast = useToast();
  const [restarting, setRestarting] = useState(false);
  const stepParam = params.get('step');
  const completed = progress.completed;
  const allDone = completed !== null && completed.length >= STEP_COUNT;
  // Without a `step` in the URL the page opens where the user left off, which is known when the saved progress arrives.
  const waitingForProgress = stepParam === null && progress.status === 'loading';
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
    // Changing the application starts the path over (D-147): with no step in the URL it opens at the first step that user has not
    // completed in the new application. The first application of the page is not a change.
    const before = previousApplication.current;
    previousApplication.current = currentApplicationId;
    if (before !== null && currentApplicationId !== null && before !== currentApplicationId) {
      void navigate('/onboarding', { replace: true });
    }
  }, [currentApplicationId, navigate]);

  const resumeAt = completed === null ? null : firstIncompleteStep(completed);
  useEffect(() => {
    // No step in the URL: the page opens at the first step that is not completed (a step 1 needs no change of the URL).
    if (stepParam !== null || resumeAt === null || resumeAt === FIRST_STEP) return;
    void navigate(stepHref(resumeAt), { replace: true });
  }, [stepParam, resumeAt, navigate]);

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

  const { summary: loadedSummary } = resource;
  // The summary is held back while the page does not know which step to open (a wrong step would flash first).
  const summary = waitingForProgress ? null : loadedSummary;

  const completeStep = async () => {
    try {
      await progress.complete(step);
      toast.show({ message: stepCompletedToastOf(step) });
      if (step < STEP_COUNT) void navigate(stepHref(step + 1));
    } catch (thrown) {
      toast.show({
        tone: 'warning',
        message: getThrownMessage(thrown, { element: 'application' }),
      });
    }
  };
  const restart = async () => {
    try {
      await progress.reset();
      setRestarting(false);
      toast.show({ message: RESTARTED_TOAST });
      void navigate(stepHref(FIRST_STEP));
    } catch (thrown) {
      setRestarting(false);
      toast.show({
        tone: 'warning',
        message: getThrownMessage(thrown, { element: 'application' }),
      });
    }
  };
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
    <div className="@container flex flex-1 flex-col gap-4">
      <OnboardingHeader
        applicationName={name}
        completed={allDone}
        saved={completed}
        step={step}
        saving={progress.saving}
        onComplete={() => {
          void completeStep();
        }}
        onRestart={() => {
          setRestarting(true);
        }}
      />
      <OnboardingStepper step={step} completed={completed} />
      <div className="grid grid-cols-1 items-stretch gap-4 @min-[1100px]:min-h-[32rem] @min-[1100px]:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="relative min-w-0">
          <div className="@min-[1100px]:absolute @min-[1100px]:inset-0">
            <StepFrame
              step={step}
              title={frame.title}
              lead={frame.lead}
              headingRef={headingRef}
              footer={
                <OnboardingStepFooter
                  step={step}
                  completed={completed}
                  failed={progress.status === 'error'}
                  onRetry={progress.reload}
                />
              }
            >
              {body}
            </StepFrame>
          </div>
        </div>
        <OnboardingAside summary={summary} applicationName={name} step={step} />
      </div>
      {restarting && (
        <RestartOnboardingModal
          applicationName={name}
          busy={progress.saving === 'reset'}
          onConfirm={() => {
            void restart();
          }}
          onClose={() => {
            setRestarting(false);
          }}
        />
      )}
    </div>
  );
}
