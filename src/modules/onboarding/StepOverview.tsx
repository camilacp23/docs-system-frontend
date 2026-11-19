// StepOverview: the body of step 1 of the onboarding (S-38a): four figures (screens, variables, collections, components)
// and "Documentation progress" with the approved share as the API sends it (one decimal, the format of the dashboard; the
// frame draws a whole number, DESIGN_REFERENCE section 9). The title and the lead are the page's (StepFrame).
// Props: summary.
import type { ReactNode } from 'react';

import { cx, ElementTypeIcon } from '../../components/ui';
import { apiPercentText } from '../dashboard/dashboardModel';

import { countLabel, type OnboardingSummary } from './onboardingModel';
import { APPROVED_NOTE, approvedTextOf, PROGRESS_CARD_TITLE } from './onboardingTexts';

/** Each figure has the color of its element (the modules'): written out so Tailwind finds the classes. */
const TILE_TONE = {
  screen: {
    card: 'border-screen-border bg-screen-soft/60',
    icon: 'bg-screen text-on-primary',
    ink: 'text-screen-ink',
  },
  variable: {
    card: 'border-variable-border bg-variable-soft/60',
    icon: 'bg-variable text-on-primary',
    ink: 'text-variable-ink',
  },
  collection: {
    card: 'border-collection-border bg-collection-soft/60',
    icon: 'bg-collection text-on-primary',
    ink: 'text-collection-ink',
  },
  component: {
    card: 'border-primary/20 bg-empty-icon-bg/60',
    icon: 'bg-primary text-on-primary',
    ink: 'text-primary',
  },
} as const;

function CountTile({
  value,
  label,
  tone,
  icon,
}: {
  value: number;
  label: string;
  tone: keyof typeof TILE_TONE;
  icon: ReactNode;
}) {
  const style = TILE_TONE[tone];
  return (
    <div className={cx('flex items-center gap-3 rounded-card border px-4 py-3', style.card)}>
      <span
        aria-hidden="true"
        className={cx(
          'flex size-9 shrink-0 items-center justify-center rounded-control shadow-button',
          style.icon,
        )}
      >
        {icon}
      </span>
      <div className="flex flex-col-reverse justify-end gap-0.5">
        <dt className="text-small text-ink-700">{label}</dt>
        <dd className={cx('text-heading font-extrabold', style.ink)}>{value}</dd>
      </div>
    </div>
  );
}

export function StepOverview({ summary }: { summary: OnboardingSummary }) {
  const { counts, approvedPercent } = summary;
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 @min-[900px]:grid-cols-4">
        <CountTile
          tone="screen"
          icon={<ElementTypeIcon type="screen" size={18} />}
          value={counts.screens}
          label={countLabel(counts.screens, 'screen', 'screens')}
        />
        <CountTile
          tone="variable"
          icon={<ElementTypeIcon type="variable" size={18} />}
          value={counts.variables}
          label={countLabel(counts.variables, 'variable', 'variables')}
        />
        <CountTile
          tone="collection"
          icon={<ElementTypeIcon type="collection" size={18} />}
          value={counts.collections}
          label={countLabel(counts.collections, 'collection', 'collections')}
        />
        <CountTile
          tone="component"
          icon={<ElementTypeIcon type="component" size={18} />}
          value={counts.components}
          label={countLabel(counts.components, 'component', 'components')}
        />
      </dl>
      <div className="flex flex-col gap-2 rounded-card border border-success-border bg-success-bg/40 px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-body font-bold text-ink-900">{PROGRESS_CARD_TITLE}</h3>
          <p className="text-body text-ink-700">
            {approvedTextOf(apiPercentText(approvedPercent))}
          </p>
        </div>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-disabled-bg">
          <div
            className="h-full rounded-pill bg-success"
            style={{ width: `${approvedPercent}%` }}
          />
        </div>
        <p className="text-small text-ink-500">{APPROVED_NOTE}</p>
      </div>
    </>
  );
}
