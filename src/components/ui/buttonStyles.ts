// buttonStyles: the class names shared by Button and ButtonLink (a link that looks like a button).
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export const BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control border text-button font-bold transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 enabled:active:scale-[0.97] motion-reduce:transition-none motion-reduce:transform-none';

export const BUTTON_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-7.5 px-3',
  md: 'h-9 px-3.5',
  lg: 'h-10 px-3.5',
  xl: 'h-11 px-4',
};

export const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-(image:--gradient-primary) text-on-primary shadow-primary-button enabled:hover:bg-(image:--gradient-primary-hover) enabled:active:bg-(image:--gradient-primary-active)',
  secondary:
    'border-border-control bg-surface text-ink-900 shadow-card enabled:hover:border-accent enabled:hover:bg-accent-soft enabled:hover:text-accent-ink enabled:active:bg-control-active',
  ghost:
    'border-transparent bg-transparent text-primary enabled:hover:bg-accent-soft enabled:active:bg-control-active',
  danger:
    'border-transparent bg-(image:--gradient-danger) text-on-primary enabled:hover:bg-(image:--gradient-danger-hover) enabled:active:bg-(image:--gradient-danger-active)',
  // A destructive action that is not the main one of the page: red text on a pale red, solid red on hover.
  'danger-soft':
    'border-danger-border bg-danger-bg text-danger enabled:hover:border-danger enabled:hover:bg-danger enabled:hover:text-on-primary enabled:active:bg-danger-light',
};

/** Same looks for a link (an <a> has no :enabled state, so the hover classes are written out). */
export const LINK_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-(image:--gradient-primary) text-on-primary shadow-primary-button hover:bg-(image:--gradient-primary-hover) hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] active:bg-(image:--gradient-primary-active)',
  secondary:
    'border-border-control bg-surface text-ink-900 shadow-card hover:-translate-y-0.5 hover:border-accent hover:bg-accent-soft hover:text-accent-ink active:translate-y-0 active:scale-[0.97] active:bg-control-active',
  ghost:
    'border-transparent bg-transparent text-primary hover:bg-accent-soft active:bg-control-active',
  danger:
    'border-transparent bg-(image:--gradient-danger) text-on-primary hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] hover:bg-(image:--gradient-danger-hover) active:bg-(image:--gradient-danger-active)',
  'danger-soft':
    'border-danger-border bg-danger-bg text-danger hover:-translate-y-0.5 hover:border-danger hover:bg-danger hover:text-on-primary active:translate-y-0 active:scale-[0.97] active:bg-danger-light',
};
