// OnboardingTrailProvider: holds the trail of the onboarding (trailContext) for the shell. Arriving at the onboarding page ends the
// trail (the user is back where the guide was), so the bubble only shows on the other pages. No props besides children.
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { OnboardingTrailContext, type OnboardingTrail } from './trailContext';

export function OnboardingTrailProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [trail, setTrail] = useState<OnboardingTrail | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const start = useCallback((next: OnboardingTrail) => {
    setTrail(next);
    setCollapsed(false);
  }, []);
  const end = useCallback(() => {
    setTrail(null);
  }, []);

  // Back in the onboarding: the trail is over. Only a change of page is looked at (the click that starts a trail and the
  // navigation it makes arrive together), adjusted while rendering instead of in an effect.
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    if (pathname.startsWith('/onboarding') && trail !== null) setTrail(null);
  }

  const value = useMemo(
    () => ({ trail, start, end, collapsed, setCollapsed }),
    [trail, start, end, collapsed],
  );
  return (
    <OnboardingTrailContext.Provider value={value}>{children}</OnboardingTrailContext.Provider>
  );
}
