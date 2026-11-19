// OnboardingBubble: the guide that follows the user out of the onboarding. When a tile of "Explore while you read" takes them
// to another page, a bubble stays at the bottom right of every page they open next, so they never lose where they were:
//   - expanded: "Onboarding", "Step N of 5 · <step>", what they went to see, the five steps as dots, "Back to step N" (a link
//     to `/onboarding?step=N`) and "Dismiss"; a button minimizes it;
//   - minimized: a round button with the step ("N/5") that opens it again.
// It is drawn only while there is a trail (trailContext) and the page is not the onboarding. No props. It is a labelled region
// ("Onboarding guide"), never takes the focus by itself and does not cover the page's own actions (it is small, at the corner).
import { BookOpen, ChevronDown, X } from 'lucide-react';
import { useLocation } from 'react-router';

import { ButtonLink, cx, ICON_STROKE_WIDTH } from '../../components/ui';

import { isDone, STEP_COUNT, stepHref, stepInfo } from './onboardingModel';
import { stepCounterOf } from './onboardingTexts';
import { useOnboardingTrail } from './trailContext';

export const BUBBLE_LABEL = 'Onboarding guide';

export function OnboardingBubble() {
  const { pathname } = useLocation();
  const { trail, end, collapsed, setCollapsed } = useOnboardingTrail();
  if (trail === null || pathname.startsWith('/onboarding')) return null;
  const { step, destination } = trail;
  const info = stepInfo(step);

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label={`Open the onboarding guide, ${stepCounterOf(step, STEP_COUNT)}`}
        onClick={() => {
          setCollapsed(false);
        }}
        className="fixed right-6 bottom-6 z-40 flex size-14 flex-col items-center justify-center rounded-full bg-(image:--gradient-onboarding) text-on-primary shadow-bubble transition-transform duration-200 hover:-translate-y-0.5 motion-safe:animate-bubble-in motion-reduce:transform-none motion-reduce:transition-none"
      >
        <BookOpen aria-hidden="true" size={20} strokeWidth={ICON_STROKE_WIDTH} />
        <span aria-hidden="true" className="text-micro leading-none font-bold">
          {step}/{STEP_COUNT}
        </span>
      </button>
    );
  }

  return (
    <aside
      aria-label={BUBBLE_LABEL}
      className="fixed right-6 bottom-6 z-40 w-72 max-w-[calc(100vw-3rem)] rounded-bubble border border-onboarding-border bg-surface p-4 shadow-bubble motion-safe:animate-bubble-in"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(image:--gradient-onboarding) text-on-primary shadow-nav-tile"
        >
          <BookOpen size={18} strokeWidth={ICON_STROKE_WIDTH} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-micro font-bold tracking-wider text-onboarding-ink uppercase">
            Onboarding
          </p>
          <p className="text-body font-bold text-ink-900">
            {stepCounterOf(step, STEP_COUNT)} · {info.label}
          </p>
        </div>
        <button
          type="button"
          aria-label="Minimize the onboarding guide"
          onClick={() => {
            setCollapsed(true);
          }}
          className="-mt-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-chip text-ink-500 hover:bg-control-hover hover:text-ink-900"
        >
          <ChevronDown aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
        </button>
      </div>
      <p className="mt-3 text-small text-ink-700">
        You&apos;re exploring: <span className="font-semibold text-ink-900">{destination}</span>
      </p>
      <ol aria-hidden="true" className="mt-3 flex items-center gap-1.5">
        {Array.from({ length: STEP_COUNT }, (_, index) => {
          const number = index + 1;
          return (
            <li
              key={number}
              className={cx(
                'h-1.5 flex-1 rounded-pill',
                number === step && 'bg-onboarding',
                isDone(number, step) && 'bg-success',
                number > step && 'bg-border-subtle',
              )}
            />
          );
        })}
      </ol>
      <div className="mt-4 flex items-center gap-2">
        <ButtonLink size="sm" variant="primary" to={stepHref(step)} className="flex-1">
          Back to step {step}
        </ButtonLink>
        <button
          type="button"
          onClick={end}
          className="inline-flex h-7.5 items-center gap-1 rounded-control px-2.5 text-button font-bold text-ink-700 hover:bg-control-hover"
        >
          <X aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
          Dismiss
        </button>
      </div>
    </aside>
  );
}
