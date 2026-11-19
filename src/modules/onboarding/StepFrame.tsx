// StepFrame: the card of one onboarding step (S-38a to S-38c): a tinted header with the small kicker "STEP 3 · KEY SCREENS", the
// title of the step (an h2, focusable by code: the page moves the focus there when the step changes) and the lead, the body and,
// on a soft band at the foot, the two fixed tips of the frame with a bulb (steps 4 and 5 have none).
// Props: step (1 to 5), title, lead, headingRef (to focus the title), children (the body of the step).
import { Lightbulb } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { Fragment } from 'react';

import { cx, ICON_STROKE_WIDTH } from '../../components/ui';

import { stepInfo } from './onboardingModel';
import { stepTone } from './onboardingTones';
import { kickerOf, TIPS, type Tip } from './onboardingTexts';

interface StepFrameProps {
  step: number;
  title: string;
  lead: string;
  headingRef: Ref<HTMLHeadingElement>;
  children: ReactNode;
  footer?: ReactNode;
}

/** A tip's text with the Power Fx words it names drawn in IBM Plex Mono. */
function TipText({ tip }: { tip: Tip }) {
  const words = tip.mono ?? [];
  if (words.length === 0) return <>{tip.text}</>;
  const pattern = new RegExp(`(${words.join('|')})`);
  return (
    <>
      {tip.text.split(pattern).map((part, index) => (
        <Fragment key={index}>
          {words.includes(part) ? <span className="font-mono text-label">{part}</span> : part}
        </Fragment>
      ))}
    </>
  );
}

export function StepFrame({ step, title, lead, headingRef, children, footer }: StepFrameProps) {
  const tips = TIPS[step];
  const tone = stepTone(step);
  return (
    <section
      aria-labelledby="onboarding-step-title"
      className={cx(
        'flex h-full min-w-0 flex-col overflow-hidden rounded-modal border bg-surface shadow-card',
        tone.border,
      )}
    >
      <div className={cx('flex flex-col gap-2 border-b border-divider px-6 py-5', tone.header)}>
        <p
          className={cx(
            'w-fit rounded-pill bg-surface px-2.5 py-0.5 text-micro font-bold tracking-wider uppercase shadow-button',
            tone.ink,
          )}
        >
          {kickerOf(step, stepInfo(step).kicker)}
        </p>
        <h2
          id="onboarding-step-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-title font-bold text-ink-900 focus:outline-none"
        >
          {title}
        </h2>
        <p className="max-w-3xl text-body text-ink-700">{lead}</p>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 px-6 py-5 @min-[1100px]:overflow-y-auto">
        {children}
      </div>
      {tips && (
        <ul
          className={cx(
            'grid grid-cols-1 gap-3 border-t border-divider bg-search-bg/50 px-6 py-4 @min-[640px]:grid-cols-2',
          )}
        >
          {tips.map((tip) => (
            <li key={tip.title} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={cx(
                  'flex size-7 shrink-0 items-center justify-center rounded-control',
                  tone.soft,
                  tone.ink,
                )}
              >
                <Lightbulb size={15} strokeWidth={ICON_STROKE_WIDTH} />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className={cx('text-micro font-bold tracking-wider uppercase', tone.ink)}>
                  {tip.title}
                </p>
                <p className="text-body text-ink-700">
                  <TipText tip={tip} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {footer}
    </section>
  );
}
