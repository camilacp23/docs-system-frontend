// onboardingTones: the color of each step of the onboarding (sky, amber, indigo, green, violet), so the page is not one blue.
// stepTone(step) -> the class names of that step for the card, the stepper and the aside. The classes are written out in full so
// Tailwind finds them; every color is a token of the theme.
export interface StepTone {
  /** Border of the cards. */
  border: string;
  /** Header of the step card: soft tint fading to white. */
  header: string;
  /** Soft background (tips icons, current step in the stepper, aside glance). */
  soft: string;
  /** Text color of headings and figures. */
  ink: string;
  /** Solid fill (number of the current step). */
  solid: string;
  /** Text on the solid fill. */
  onSolid: string;
  /** Hover text color of links. */
  hover: string;
  /** Border of the figures. */
  figureBorder: string;
}

const SKY: StepTone = {
  border: 'border-onboarding-border',
  header: 'bg-linear-to-r from-onboarding-soft to-surface',
  soft: 'bg-onboarding-soft',
  ink: 'text-onboarding-ink',
  solid: 'bg-onboarding',
  onSolid: 'text-on-primary',
  hover: 'hover:text-onboarding-ink',
  figureBorder: 'border-onboarding-border/70',
};

const TONES: Record<number, StepTone> = {
  1: {
    border: 'border-onboarding-border',
    header: 'bg-linear-to-r from-onboarding-soft to-surface',
    soft: 'bg-onboarding-soft',
    ink: 'text-onboarding-ink',
    solid: 'bg-onboarding',
    onSolid: 'text-on-primary',
    hover: 'hover:text-onboarding-ink',
    figureBorder: 'border-onboarding-border/70',
  },
  2: {
    border: 'border-warning-border',
    header: 'bg-linear-to-r from-warning-bg to-surface',
    soft: 'bg-warning-bg',
    ink: 'text-warning-ink',
    solid: 'bg-badge-warning-bg',
    onSolid: 'text-badge-warning-ink',
    hover: 'hover:text-warning-ink',
    figureBorder: 'border-warning-border/70',
  },
  3: {
    border: 'border-screen-border',
    header: 'bg-linear-to-r from-screen-soft to-surface',
    soft: 'bg-screen-soft',
    ink: 'text-screen-ink',
    solid: 'bg-screen',
    onSolid: 'text-on-primary',
    hover: 'hover:text-screen-ink',
    figureBorder: 'border-screen-border/70',
  },
  4: {
    border: 'border-success-border',
    header: 'bg-linear-to-r from-success-bg to-surface',
    soft: 'bg-success-bg',
    ink: 'text-success-ink',
    solid: 'bg-success',
    onSolid: 'text-on-primary',
    hover: 'hover:text-success-ink',
    figureBorder: 'border-success-border/70',
  },
  5: {
    border: 'border-jira-border',
    header: 'bg-linear-to-r from-jira-soft to-surface',
    soft: 'bg-jira-soft',
    ink: 'text-jira-ink',
    solid: 'bg-jira',
    onSolid: 'text-on-primary',
    hover: 'hover:text-jira-ink',
    figureBorder: 'border-jira-border/70',
  },
};

export function stepTone(step: number): StepTone {
  return TONES[step] ?? SKY;
}
