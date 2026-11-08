// jiraStatusContext: the last known availability of Jira in this session (D-100), for the pill of the top bar and for the
// pages that depend on Jira. The contract has no operation for the state of Jira, so it is learned from what the API says
// on the way: `sync.jiraAvailable` of the to-do tree and JIRA_UNAVAILABLE of a creation.
// useJiraStatus() -> { status, report }. status: 'unknown' (nothing learned yet), 'available' or 'unavailable'.
// report(available) records what the API just said. Held in memory by AppShell: never stored, global (not per application).
// Outside the provider the status stays 'unknown' and report does nothing.
import { createContext, useContext } from 'react';

export type JiraStatus = 'unknown' | 'available' | 'unavailable';

/** The text of the pill for each state (the last two are not drawn in the frames, DESIGN_REFERENCE §9). */
export const JIRA_PILL_TEXT: Record<JiraStatus, string> = {
  available: 'Jira connected',
  unavailable: 'Jira unavailable',
  unknown: 'Jira not checked',
};

export interface JiraStatusValue {
  status: JiraStatus;
  report: (available: boolean) => void;
}

export const JiraStatusContext = createContext<JiraStatusValue>({
  status: 'unknown',
  report: () => undefined,
});

export function useJiraStatus(): JiraStatusValue {
  return useContext(JiraStatusContext);
}
