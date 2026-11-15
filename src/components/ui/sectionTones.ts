// sectionTones: the tone names of SectionCard and the classes of its icon tile (also used by KPI cards).
export type SectionTone = 'accent' | 'success' | 'warning' | 'neutral';

export const SECTION_TONE_TILE: Record<SectionTone, string> = {
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-bg text-success-ink',
  warning: 'bg-warning-bg text-warning-ink',
  neutral: 'bg-disabled-bg text-ink-700',
};
