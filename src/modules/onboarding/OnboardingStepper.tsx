// OnboardingStepper: "Your path" (S-38a to S-38c), the five steps as links to `?step=N` in a labelled navigation, plus the
// "Progress" bar. The current step carries aria-current="step"; the steps before it are marked as done with a check (and
// say "completed" to a screen reader). Everything comes from the step of the URL (D-148): nothing is stored.
// Props: step (the current one, 1 to 5).
import { Check } from 'lucide-react';
import { Link } from 'react-router';

import { cx, ICON_STROKE_WIDTH } from '../../components/ui';

import { isDone, progressPercent, STEP_COUNT, STEPS, stepHref } from './onboardingModel';
import {
  DONE_HINT,
  PROGRESS_LABEL,
  progressTextOf,
  STEPPER_HEADING,
  STEPPER_LABEL,
} from './onboardingTexts';

export function OnboardingStepper({ step }: { step: number }) {
  const percent = progressPercent(step);
  return (
    <aside className="flex min-w-0 flex-col gap-4 rounded-card border border-border-subtle bg-surface p-3 shadow-card">
      <nav aria-label={STEPPER_LABEL} className="flex flex-col gap-2">
        <p className="px-2 pt-1 text-micro font-bold tracking-wider text-ink-500 uppercase">
          {STEPPER_HEADING}
        </p>
        <ol className="flex flex-col gap-1">
          {STEPS.map((info, index) => {
            const number = index + 1;
            const current = number === step;
            const done = isDone(number, step);
            return (
              <li key={info.label}>
                <Link
                  to={stepHref(number)}
                  aria-current={current ? 'step' : undefined}
                  className={cx(
                    'flex items-center gap-3 rounded-control px-2.5 py-2 text-body hover:bg-control-hover',
                    current ? 'bg-accent-soft font-bold text-accent-ink' : 'text-ink-700',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'flex size-6 shrink-0 items-center justify-center rounded-pill text-tag font-bold',
                      current && 'bg-primary text-on-primary',
                      done && 'bg-success-bg text-success-ink',
                      !current && !done && 'bg-disabled-bg text-ink-700',
                    )}
                  >
                    {done ? <Check size={14} strokeWidth={ICON_STROKE_WIDTH} /> : number}
                  </span>
                  <span>
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
            );
          })}
        </ol>
      </nav>
      <div className="mt-auto flex flex-col gap-1.5 px-2 pb-1">
        <p id="onboarding-progress-label" className="text-small text-ink-500">
          {PROGRESS_LABEL}
        </p>
        <div
          role="progressbar"
          aria-labelledby="onboarding-progress-label"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={progressTextOf(step - 1, STEP_COUNT)}
          className="h-1.5 overflow-hidden rounded-pill bg-disabled-bg"
        >
          <div className="h-full rounded-pill bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </aside>
  );
}
