// OnboardingStepper: the path (S-38a to S-38c), the five steps in a row as links to `?step=N` in a labelled navigation, joined by
// a line that fills with the steps already completed. The current step carries aria-current="step"; a step the user completed
// (the ones the API saved, which can have gaps: [1, 3]) is marked as done with a check (and says "completed" to a screen reader).
// The progress is also a (visually hidden) progressbar for assistive technology, "N of 5 steps completed": the line that joins
// the steps already shows it. Without the saved progress (it is loading or could not be read) no step is marked.
// Props: step (the current one, 1 to 5), completed (the saved steps, null while unknown). On a narrow page the row scrolls sideways.
import { Check } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router';

import { cx, ICON_STROKE_WIDTH } from '../../components/ui';

import { completedPercent, STEP_COUNT, STEPS, stepHref } from './onboardingModel';
import { stepTone } from './onboardingTones';
import {
  DONE_HINT,
  PROGRESS_LABEL,
  progressTextOf,
  stepCounterOf,
  STEPPER_LABEL,
} from './onboardingTexts';

interface OnboardingStepperProps {
  step: number;
  completed: readonly number[] | null;
}

export function OnboardingStepper({ step, completed }: OnboardingStepperProps) {
  const saved = completed ?? [];
  const percent = completedPercent(saved.length);
  const tone = stepTone(step);
  return (
    <div
      className={cx(
        'shrink-0 overflow-x-auto rounded-modal border bg-surface px-4 py-3 shadow-card',
        tone.border,
      )}
    >
      <div>
        <nav aria-label={STEPPER_LABEL}>
          <ol className="flex min-w-max items-center">
            {STEPS.map((info, index) => {
              const number = index + 1;
              const current = number === step;
              const done = saved.includes(number);
              return (
                <Fragment key={info.label}>
                  {index > 0 && (
                    <li
                      aria-hidden="true"
                      className={cx(
                        'mx-1 h-0.5 min-w-6 flex-1 rounded-pill',
                        saved.includes(number - 1) ? 'bg-success' : 'bg-border-subtle',
                      )}
                    />
                  )}
                  <li>
                    <Link
                      to={stepHref(number)}
                      aria-current={current ? 'step' : undefined}
                      className={cx(
                        'flex items-center gap-2.5 rounded-pill py-1.5 pr-3.5 pl-1.5 text-body transition-colors duration-150 motion-reduce:transition-none',
                        current
                          ? cx('font-bold', tone.soft, tone.ink)
                          : 'text-ink-700 hover:bg-control-hover',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cx(
                          'flex size-6 shrink-0 items-center justify-center rounded-pill text-tag font-bold',
                          current && cx(tone.solid, tone.onSolid, 'shadow-button'),
                          !current && done && 'bg-success-bg text-success-ink',
                          !current && !done && 'bg-disabled-bg text-ink-700',
                          current && done && 'ring-2 ring-success',
                        )}
                      >
                        {done ? <Check size={14} strokeWidth={ICON_STROKE_WIDTH + 0.5} /> : number}
                      </span>
                      <span className="whitespace-nowrap">
                        {info.label}
                        {done && (
                          <>
                            {' '}
                            <span className="sr-only">({DONE_HINT})</span>
                          </>
                        )}
                      </span>
                    </Link>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </nav>
        <p className="sr-only">{stepCounterOf(step, STEP_COUNT)}</p>
        <p id="onboarding-progress-label" className="sr-only">
          {PROGRESS_LABEL}
        </p>
        <div
          role="progressbar"
          aria-labelledby="onboarding-progress-label"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={progressTextOf(saved.length, STEP_COUNT)}
          className="sr-only"
        >
          <div style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
