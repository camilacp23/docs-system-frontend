// VariableKpis: the four cards above the variable list (S-10): all variables, global (Set), context
// (UpdateContext) and without origin screen. The last one is also a filter: pressing it toggles `untraced`.
// Props: kpis (the counters, null while they load or failed: the cards then show a dash), untracedActive,
// onToggleUntraced.
import { Braces, CircleAlert, LayoutGrid, Monitor } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx, ICON_STROKE_WIDTH } from '../../components/ui';

import type { VariableKpis as Kpis } from './useVariableKpis';

interface VariableKpisProps {
  kpis: Kpis | null;
  untracedActive: boolean;
  onToggleUntraced: () => void;
}

const CARD_CLASS = 'flex items-center gap-3.5 rounded-card border p-4 text-left shadow-card';

function Card({
  icon,
  value,
  label,
  tone = 'accent',
}: {
  icon: ReactNode;
  value: number | null;
  label: string;
  tone?: 'accent' | 'warning';
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cx(
          'flex size-10 shrink-0 items-center justify-center rounded-card',
          tone === 'warning' ? 'bg-warning-bg text-warning-ink' : 'bg-accent-soft text-accent-ink',
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-kpi font-extrabold text-ink-900">{value ?? '–'}</span>
        <span className="text-body text-ink-500">{label}</span>
      </span>
    </>
  );
}

export function VariableKpis({ kpis, untracedActive, onToggleUntraced }: VariableKpisProps) {
  const iconProps = { size: 20, strokeWidth: ICON_STROKE_WIDTH } as const;
  return (
    <section aria-label="Variable counts" className="grid grid-cols-4 gap-4">
      <div className={cx(CARD_CLASS, 'border-border-subtle bg-surface')}>
        <Card icon={<Braces {...iconProps} />} value={kpis?.total ?? null} label="Variables" />
      </div>
      <div className={cx(CARD_CLASS, 'border-border-subtle bg-surface')}>
        <Card
          icon={<LayoutGrid {...iconProps} />}
          value={kpis?.global ?? null}
          label="Global · Set"
        />
      </div>
      <div className={cx(CARD_CLASS, 'border-border-subtle bg-surface')}>
        <Card
          icon={<Monitor {...iconProps} />}
          value={kpis?.context ?? null}
          label="Context · UpdateContext"
        />
      </div>
      <button
        type="button"
        aria-pressed={untracedActive}
        onClick={onToggleUntraced}
        className={cx(
          CARD_CLASS,
          'w-full',
          untracedActive || (kpis?.untraced ?? 0) > 0
            ? 'border-warning-border bg-warning-bg'
            : 'border-border-subtle bg-surface',
        )}
      >
        <Card
          icon={<CircleAlert {...iconProps} />}
          value={kpis?.untraced ?? null}
          label="Without origin screen · filter"
          tone="warning"
        />
      </button>
    </section>
  );
}
