// PageBand: one band of an edit page (variables, collections): a tinted side column with a numbered badge, the
// title and a hint, and the fields on the right. Each band has its own color so the groups read as distinct steps.
// Props: step (number in the badge), tone ('accent' | 'success' | 'warning' | 'neutral'), title, description,
// label (accessible name of the band as a region; omit when the content already is a named section), children.
// Several bands go inside one bordered card (see ../variables/VariableFields.tsx, ../collections/CollectionEditPage.tsx).
import type { ReactNode } from 'react';

import { cx } from '../../components/ui';

const BAND_TONE = {
  accent: { badge: 'bg-accent text-on-primary', edge: 'bg-accent' },
  success: { badge: 'bg-success text-on-primary', edge: 'bg-success' },
  warning: { badge: 'bg-badge-warning-bg text-badge-warning-ink', edge: 'bg-badge-warning-bg' },
  neutral: { badge: 'bg-ink-500 text-on-primary', edge: 'bg-ink-500' },
} as const;

export interface PageBandProps {
  step: number;
  tone: keyof typeof BAND_TONE;
  title: string;
  description: string;
  label?: string;
  children: ReactNode;
}

export function PageBand({ step, tone, title, description, label, children }: PageBandProps) {
  return (
    <section
      aria-label={label}
      className="relative grid grid-cols-[13rem_minmax(0,1fr)] border-t-4 border-t-surface first:border-t-0"
    >
      <span
        aria-hidden="true"
        className={cx('absolute inset-y-0 left-0 w-1', BAND_TONE[tone].edge)}
      />
      <div className="flex flex-col gap-2 border-r border-divider bg-search-bg px-6 py-5">
        <span
          aria-hidden="true"
          className={cx(
            'flex size-6 items-center justify-center rounded-pill text-small font-bold',
            BAND_TONE[tone].badge,
          )}
        >
          {step}
        </span>
        <div>
          <h2 className="text-body-lg font-semibold text-ink-900">{title}</h2>
          <p className="mt-0.5 text-small text-ink-500">{description}</p>
        </div>
      </div>
      <div className="min-w-0 px-6 py-5">{children}</div>
    </section>
  );
}
