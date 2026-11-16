// StepOverview: the body of step 1 of the onboarding (S-38a): four figures (screens, variables, collections, components)
// and "Documentation progress" with the approved share as the API sends it (one decimal, the format of the dashboard; the
// frame draws a whole number, DESIGN_REFERENCE section 9). The title and the lead are the page's (StepFrame).
// Props: summary.
import { apiPercentText } from '../dashboard/dashboardModel';

import { countLabel, type OnboardingSummary } from './onboardingModel';
import { APPROVED_NOTE, approvedTextOf, PROGRESS_CARD_TITLE } from './onboardingTexts';

function CountTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col-reverse justify-end gap-0.5 rounded-control border border-border-subtle px-4 py-3">
      <dt className="text-small text-ink-500">{label}</dt>
      <dd className="text-kpi font-extrabold text-ink-900">{value}</dd>
    </div>
  );
}

export function StepOverview({ summary }: { summary: OnboardingSummary }) {
  const { counts, approvedPercent } = summary;
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 @min-[640px]:grid-cols-4">
        <CountTile value={counts.screens} label={countLabel(counts.screens, 'screen', 'screens')} />
        <CountTile
          value={counts.variables}
          label={countLabel(counts.variables, 'variable', 'variables')}
        />
        <CountTile
          value={counts.collections}
          label={countLabel(counts.collections, 'collection', 'collections')}
        />
        <CountTile
          value={counts.components}
          label={countLabel(counts.components, 'component', 'components')}
        />
      </dl>
      <div className="flex flex-col gap-1.5">
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
