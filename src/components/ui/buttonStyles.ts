// buttonStyles: the class names shared by Button and ButtonLink (a link that looks like a button).
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export const BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control border text-button font-bold';

export const BUTTON_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-7.5 px-3',
  md: 'h-9 px-3.5',
  lg: 'h-10 px-3.5',
};

export const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-(image:--gradient-primary) text-on-primary shadow-primary-button enabled:hover:bg-(image:--gradient-primary-hover) enabled:active:bg-(image:--gradient-primary-active)',
  secondary:
    'border-border-control bg-surface text-ink-900 shadow-card enabled:hover:bg-control-hover enabled:active:bg-control-active',
  ghost:
    'border-transparent bg-transparent text-primary enabled:hover:bg-control-hover enabled:active:bg-control-active',
  danger:
    'border-transparent bg-(image:--gradient-danger) text-on-primary enabled:hover:bg-(image:--gradient-danger-hover) enabled:active:bg-(image:--gradient-danger-active)',
};

/** Same looks for a link (an <a> has no :enabled state, so the hover classes are written out). */
export const LINK_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-(image:--gradient-primary) text-on-primary shadow-primary-button hover:bg-(image:--gradient-primary-hover) active:bg-(image:--gradient-primary-active)',
  secondary:
    'border-border-control bg-surface text-ink-900 shadow-card hover:bg-control-hover active:bg-control-active',
  ghost:
    'border-transparent bg-transparent text-primary hover:bg-control-hover active:bg-control-active',
  danger:
    'border-transparent bg-(image:--gradient-danger) text-on-primary hover:bg-(image:--gradient-danger-hover) active:bg-(image:--gradient-danger-active)',
};
