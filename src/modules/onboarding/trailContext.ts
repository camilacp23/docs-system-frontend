// trailContext: where the user is in the onboarding while they explore the application from "Explore while you read", so the guide
// bubble (OnboardingBubble) can follow them to the page they opened.
// useOnboardingTrail() -> { trail, start(trail), end(), collapsed, setCollapsed }
//   trail      { step (1 to 5), destination (what the user went to see: "Open App (OnStart)") } or null when there is none
//   start      begins a trail (a tile of "Explore" calls it as the user leaves the step)
//   end        ends it (the bubble is dismissed, or the user is back in the onboarding)
// It lives in memory only: nothing is stored, a reload ends it. Without a provider (a test of one component) it does nothing.
import { createContext, useContext } from 'react';

export interface OnboardingTrail {
  step: number;
  destination: string;
}

export interface OnboardingTrailValue {
  trail: OnboardingTrail | null;
  start: (trail: OnboardingTrail) => void;
  end: () => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const OnboardingTrailContext = createContext<OnboardingTrailValue>({
  trail: null,
  start: () => undefined,
  end: () => undefined,
  collapsed: false,
  setCollapsed: () => undefined,
});

export function useOnboardingTrail(): OnboardingTrailValue {
  return useContext(OnboardingTrailContext);
}
