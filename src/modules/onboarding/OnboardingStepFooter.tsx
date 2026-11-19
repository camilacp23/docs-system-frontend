// OnboardingStepFooter: the foot of the card of a step, where the state of the saved progress is told (contract 0.4.0). The buttons
// that save it ("Mark step as complete", "Restart onboarding") are in the hero of the page (OnboardingHeader).
// Props: step (1 to 5), completed (the saved steps, null while unknown), failed (the progress could not be read), onRetry() (read the
// progress again).
// A step that is completed says "Step completed" with a check; one that is not, tells where to mark it (there is no way to undo a single
// step: only "Restart onboarding" forgets them all). Without the saved progress (loading) it draws nothing; when it could not be read
// it says so and offers "Try again". The progress is only saved when the user marks a step, never on a click.
import { CircleAlert, CircleCheck } from 'lucide-react';

import { Button, ICON_STROKE_WIDTH } from '../../components/ui';

import {
  PROGRESS_FAILED_TEXT,
  PROGRESS_RETRY_LABEL,
  STEP_COMPLETED_LABEL,
  STEP_PENDING_HINT,
} from './onboardingTexts';

interface OnboardingStepFooterProps {
  step: number;
  completed: readonly number[] | null;
  failed: boolean;
  onRetry: () => void;
}

export function OnboardingStepFooter({
  step,
  completed,
  failed,
  onRetry,
}: OnboardingStepFooterProps) {
  if (failed) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-6 py-3.5">
        <p className="flex items-center gap-2 text-body text-warning-ink">
          <CircleAlert aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
          {PROGRESS_FAILED_TEXT}
        </p>
        <Button size="sm" onClick={onRetry}>
          {PROGRESS_RETRY_LABEL}
        </Button>
      </div>
    );
  }
  if (completed === null) return null;
  return (
    <div className="border-t border-divider px-6 py-3.5">
      {completed.includes(step) ? (
        <p className="flex items-center gap-2 text-body font-semibold text-success-ink">
          <CircleCheck aria-hidden="true" size={18} strokeWidth={ICON_STROKE_WIDTH} />
          {STEP_COMPLETED_LABEL}
        </p>
      ) : (
        <p className="text-body text-ink-500">{STEP_PENDING_HINT}</p>
      )}
    </div>
  );
}
