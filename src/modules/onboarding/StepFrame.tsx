// StepFrame: the card of one onboarding step (S-38a to S-38c): the small kicker "STEP 3 · KEY SCREENS", the title of the
// step (an h2, focusable by code: the page moves the focus there when the step changes), the lead, the body and, at the
// foot, the two fixed tips of the frame (steps 4 and 5 have none).
// Props: step (1 to 5), title, lead, headingRef (to focus the title), children (the body of the step).
import type { ReactNode, Ref } from 'react';
import { Fragment } from 'react';

import { cx } from '../../components/ui';

import { stepInfo } from './onboardingModel';
import { kickerOf, TIPS, type Tip } from './onboardingTexts';

interface StepFrameProps {
  step: number;
  title: string;
  lead: string;
  headingRef: Ref<HTMLHeadingElement>;
  children: ReactNode;
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

export function StepFrame({ step, title, lead, headingRef, children }: StepFrameProps) {
  const tips = TIPS[step];
  return (
    <section
      aria-labelledby="onboarding-step-title"
      className="flex min-w-0 flex-col gap-4 rounded-card border border-border-subtle bg-surface p-5 shadow-card"
    >
      <div className="flex flex-col gap-2">
        <p className="text-micro font-bold tracking-wider text-ink-500 uppercase">
          {kickerOf(step, stepInfo(step).kicker)}
        </p>
        <h2
          id="onboarding-step-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-heading font-bold text-ink-900 focus:outline-none"
        >
          {title}
        </h2>
        <p className="text-body-lg text-ink-700">{lead}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
      {tips && (
        <ul className={cx('mt-auto grid grid-cols-1 gap-3 pt-2 @min-[640px]:grid-cols-2')}>
          {tips.map((tip) => (
            <li
              key={tip.title}
              className="flex flex-col gap-1.5 rounded-control border border-border-subtle p-4"
            >
              <p className="text-micro font-bold tracking-wider text-ink-500 uppercase">
                {tip.title}
              </p>
              <p className="text-body text-ink-700">
                <TipText tip={tip} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
