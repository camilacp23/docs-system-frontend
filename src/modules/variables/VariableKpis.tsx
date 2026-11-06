// VariableKpis: the four cards above the variable list (S-10): all variables, global (Set), context
// (UpdateContext) and without origin screen. The last one is also a filter: pressing it toggles `untraced`.
// Props: kpis (the counters, null while they load or failed: the cards then show a dash), untracedActive,
// onToggleUntraced.
import { Braces, CircleAlert, LayoutGrid, Monitor } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx, ICON_STROKE_WIDTH, SECTION_TONE_TILE } from '../../components/ui';
import type { SectionTone } from '../../components/ui';

import type { VariableKpis as Kpis } from './useVariableKpis';

interface VariableKpisProps {
  kpis: Kpis | null;
  untracedActive: boolean;
  onToggleUntraced: () => void;
}

const CARD_CLASS =
  'flex items-center gap-3.5 rounded-card border p-4 text-left shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:transform-none';

function Card({
  icon,
  value,
  label,
  tone = 'accent',
}: {
  icon: ReactNode;
  value: number | null;
  label: string;
  tone?: SectionTone;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cx(
          'flex size-9 shrink-0 items-center justify-center rounded-control',
          SECTION_TONE_TILE[tone],
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-title font-bold text-ink-900">{value ?? '–'}</span>
        <span className="text-label text-ink-500">{label}</span>
      </span>
    </>
  );
}

export function VariableKpis({ kpis, untracedActive, onToggleUntraced }: VariableKpisProps) {
  const iconProps = { size: 16, strokeWidth: ICON_STROKE_WIDTH } as const;
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
          tone="success"
        />
      </div>
      <div className={cx(CARD_CLASS, 'border-border-subtle bg-surface')}>
        <Card
          icon={<Monitor {...iconProps} />}
          value={kpis?.context ?? null}
          label="Context · UpdateContext"
          tone="neutral"
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
