// OnboardingHeader: the top of /onboarding (S-38a to S-38c): the hero of the redesigned pages in sky blue with the title
// "Onboarding · <application>" (the h1), the subtitle and, on the right as in the other pages, the buttons of the saved progress
// (contract 0.4.0): "Restart onboarding" (only when something is saved) and "Mark step as complete" (only for a step that is not
// completed). Navigation between steps is the stepper (OnboardingStepper). When the user completed the five steps of this
// application a green chip "Onboarding completed" is pinned to the corner.
// Props: applicationName, completed (the five steps are saved as completed), saved (the steps the API saved, null while unknown),
// step (the current one), saving (a write is in flight), onComplete(), onRestart().
import { BookOpen, Check, CircleCheck, RotateCcw } from 'lucide-react';

import { Button, ICON_STROKE_WIDTH, PageHero } from '../../components/ui';

import {
  MARK_COMPLETE_LABEL,
  ONBOARDING_COMPLETED_LABEL,
  pageTitleOf,
  RESTART_LABEL,
  subtitleOf,
} from './onboardingTexts';

interface OnboardingHeaderProps {
  applicationName: string;
  completed?: boolean;
  saved: readonly number[] | null;
  step: number;
  saving: 'step' | 'reset' | null;
  onComplete: () => void;
  onRestart: () => void;
}

export function OnboardingHeader({
  applicationName,
  completed = false,
  saved,
  step,
  saving,
  onComplete,
  onRestart,
}: OnboardingHeaderProps) {
  const canRestart = saved !== null && saved.length > 0;
  const canMark = saved !== null && !saved.includes(step);
  return (
    <PageHero
      tone="onboarding"
      icon={<BookOpen size={20} strokeWidth={ICON_STROKE_WIDTH} />}
      title={pageTitleOf(applicationName)}
      description={subtitleOf(applicationName)}
      corner={
        completed ? (
          <p className="flex items-center gap-1.5 rounded-pill bg-success-bg px-2.5 py-0.5 text-micro font-bold text-success-ink">
            <CircleCheck aria-hidden="true" size={13} strokeWidth={ICON_STROKE_WIDTH} />
            {ONBOARDING_COMPLETED_LABEL}
          </p>
        ) : undefined
      }
      actions={
        canRestart || canMark ? (
          <>
            {canRestart && (
              <Button
                size="sm"
                disabled={saving !== null}
                iconLeft={
                  <RotateCcw aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
                }
                onClick={onRestart}
              >
                {RESTART_LABEL}
              </Button>
            )}
            {canMark && (
              <Button
                size="sm"
                variant="primary"
                loading={saving === 'step'}
                disabled={saving === 'reset'}
                iconLeft={
                  <Check aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH + 0.5} />
                }
                onClick={onComplete}
              >
                {MARK_COMPLETE_LABEL}
              </Button>
            )}
          </>
        ) : undefined
      }
    />
  );
}
