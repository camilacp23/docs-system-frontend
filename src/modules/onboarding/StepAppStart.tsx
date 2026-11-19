// StepAppStart: the body of step 2 of the onboarding (S-38b), "How <application> starts": the documentation of App (OnStart),
// which is the integration flow (FR-25): its seven template fields in the order of SRS Table 28 (OnStart drawn in IBM Plex
// Mono as in the frame; an empty field says "Not documented yet.") and, when there are any, the key screens App (OnStart)
// reaches directly (`depth` 1, at most the 10 key screens the API sent, so the title never says "all"). The chain of
// screens and the table "What is ready after start" that the frame draws are not in the API (D-146).
// Props: summary.
import { Link } from 'react-router';

import { ElementTypeIcon } from '../../components/ui';
import { elementHref } from '../dependency-map/nodeLinks';
import { hasContent, TEMPLATE_FIELDS } from '../screens/templateFields';

import { directlyReached, type OnboardingSummary } from './onboardingModel';
import { DIRECT_SCREENS_TITLE, NOT_DOCUMENTED_TEXT } from './onboardingTexts';

export function StepAppStart({ summary }: { summary: OnboardingSummary }) {
  const { template } = summary.appContextScreen;
  const reached = directlyReached(summary.keyScreens);
  return (
    <>
      <dl className="flex flex-col gap-3">
        {TEMPLATE_FIELDS.map((field) => {
          const text = template[field.key];
          return (
            <div key={field.key} className="flex flex-col gap-1.5">
              <dt className="text-micro font-bold tracking-wider text-ink-500 uppercase">
                {field.label}
              </dt>
              <dd
                className={
                  hasContent(text)
                    ? field.mono
                      ? 'rounded-control border border-border-subtle bg-canvas px-3.5 py-3 font-mono text-label wrap-break-word whitespace-pre-wrap text-ink-900'
                      : 'text-body wrap-break-word whitespace-pre-wrap text-ink-700'
                    : 'text-body text-ink-500'
                }
              >
                {hasContent(text) ? text : NOT_DOCUMENTED_TEXT}
              </dd>
            </div>
          );
        })}
      </dl>
      {reached.length > 0 && (
        <section aria-labelledby="onboarding-direct-title" className="flex flex-col gap-2">
          <h3
            id="onboarding-direct-title"
            className="text-micro font-bold tracking-wider text-ink-500 uppercase"
          >
            {DIRECT_SCREENS_TITLE}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {reached.map((item) => (
              <li key={item.screen.id}>
                <Link
                  to={elementHref({ type: 'SCREEN', id: item.screen.id })}
                  className="inline-flex max-w-full items-center gap-2 rounded-control border border-border-control bg-surface px-3 py-2 font-mono text-label text-ink-900 hover:bg-control-hover"
                >
                  <ElementTypeIcon type="screen" />
                  <span className="wrap-break-word">{item.screen.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
