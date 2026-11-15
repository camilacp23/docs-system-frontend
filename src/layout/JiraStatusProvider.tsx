// JiraStatusProvider: holds the last known availability of Jira (see jiraStatusContext.ts). Props: children.
// Mounted once by AppShell, around the top bar and the page. The state starts unknown and lives only in memory.
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { JiraStatusContext, type JiraStatus, type JiraStatusValue } from './jiraStatusContext';

export function JiraStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<JiraStatus>('unknown');
  const report = useCallback((available: boolean) => {
    setStatus(available ? 'available' : 'unavailable');
  }, []);
  const value = useMemo<JiraStatusValue>(() => ({ status, report }), [status, report]);
  return <JiraStatusContext value={value}>{children}</JiraStatusContext>;
}
