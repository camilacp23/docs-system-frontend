// onboardingModel: the pure rules of the onboarding page (FR-25, D-146 to D-148); nothing here reads the API or the DOM.
// STEPS: the five steps in order, each with the label of the stepper, and the small kicker over
//   the title (S-38a to S-38c draw the first three; steps 4 and 5 are derived, D-146).
// parseStep(raw) -> { step, valid }: the step of `?step=`. A missing parameter is step 1 and is valid (nothing to fix);
//   anything that is not exactly 1 to 5 is step 1 and NOT valid (the page replaces the URL, D-147).
// firstIncompleteStep(completed) -> the first step (1 to 5) that is not in the list the API saved, or null when all five are (the
//   onboarding opens there; `completed` may have gaps, [1, 3] opens at 2). completedPercent(count) -> the share of the five steps the
//   user completed (the progress bar, from the saved steps).
// stepHref(step), progressPercent(step) (steps before the current one over 5, D-148), isDone(step, current),
// barPercent(connections, max) (the bar of a key screen, relative to the largest of the list, D-148), depthText(depth),
// countLabel(n, singular, plural). The links of the elements are the ones of the map (elementHref, D-102).
import type { components } from '../../api/schema';

export type OnboardingSummary = components['schemas']['OnboardingEnvelope']['data'];
export type KeyScreen = OnboardingSummary['keyScreens'][number];
export type GlobalVariable = OnboardingSummary['globalVariables'][number];
export type TopComponent = OnboardingSummary['topComponents'][number];

export const STEP_COUNT = 5;
export const FIRST_STEP = 1;

export interface StepInfo {
  /** The text of the stepper. */
  label: string;
  /** The small uppercase line over the title: "STEP 3 · KEY SCREENS" is built from this. */
  kicker: string;
}

export const STEPS: readonly StepInfo[] = [
  { label: 'Overview', kicker: 'Overview' },
  { label: 'How the app starts', kicker: 'Integration flow' },
  { label: 'Key screens', kicker: 'Key screens' },
  { label: 'Critical variables', kicker: 'Critical variables' },
  { label: 'Most used components', kicker: 'Most used components' },
];

export function stepInfo(step: number): StepInfo {
  return STEPS[step - 1] ?? (STEPS[0] as StepInfo);
}

export function parseStep(raw: string | null): { step: number; valid: boolean } {
  if (raw === null) return { step: FIRST_STEP, valid: true };
  if (/^[1-5]$/.test(raw)) return { step: Number(raw), valid: true };
  return { step: FIRST_STEP, valid: false };
}

export function stepHref(step: number): string {
  return `/onboarding?step=${step}`;
}

/** The share of the path already walked: the steps before the current one over the five (D-148). */
export function progressPercent(step: number): number {
  return ((step - 1) / STEP_COUNT) * 100;
}

/** The first step the user has not completed, or null when they completed all of them. */
export function firstIncompleteStep(completed: readonly number[]): number | null {
  for (let step = FIRST_STEP; step <= STEP_COUNT; step += 1) {
    if (!completed.includes(step)) return step;
  }
  return null;
}

/** The share of the five steps that the user completed, from what the API saved. */
export function completedPercent(count: number): number {
  return (Math.min(Math.max(count, 0), STEP_COUNT) / STEP_COUNT) * 100;
}

/** A step before the current one is marked as done (D-148). */
export function isDone(step: number, current: number): boolean {
  return step < current;
}

/** Width of the bar of a key screen: its connections over the largest in the list; 0 when nothing is connected. */
export function barPercent(connections: number, max: number): number {
  return max <= 0 ? 0 : Math.round((connections / max) * 100);
}

export function maxConnections(screens: readonly KeyScreen[]): number {
  return screens.reduce((largest, screen) => Math.max(largest, screen.connections), 0);
}

/** Where the screen sits in the navigation: `depth` null means App (OnStart) does not reach it (D-124). */
export function depthText(depth: number | null): string {
  if (depth === null) return 'Not reachable from App (OnStart)';
  return depth === 1 ? 'Reached directly from App (OnStart)' : `${depth} steps from App (OnStart)`;
}

export function countLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** The key screens App (OnStart) reaches directly (`depth` 1), in the order of the API. */
export function directlyReached(screens: readonly KeyScreen[]): KeyScreen[] {
  return screens.filter((screen) => screen.depth === 1);
}
