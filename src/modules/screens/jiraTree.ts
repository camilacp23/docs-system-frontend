// jiraTree: pure helpers of the Future to do tab (S-23): the pending count, the project of the Epic, the merge of a
// creation into the tree, the link check and the category tags. Texts of the tab are exported here too.
import type { TagTone } from '../../components/ui';

import type { JiraCreated, JiraStatusCategory, JiraStory, JiraTicket, JiraTree } from './jiraTypes';

export const FUTURE_TODO_LABEL = 'Future to do';
export const ADD_TODO_LABEL = 'Add to-do';
export const REFRESH_LABEL = 'Refresh from Jira';
export const STALE_LABEL = 'Stale';
export const OPEN_IN_JIRA_LABEL = 'Open in Jira';
export const JIRA_DOWN_LEAD = "Jira isn't responding.";
export const JIRA_ADD_UNAVAILABLE_REASON =
  "Jira isn't responding. You can add to-dos when it's back.";
export const REFRESH_ARCHIVED_REASON =
  "Read-only: the application is archived, so the copy can't be refreshed.";
export const EMPTY_TITLE = 'No to-dos yet';
export const EMPTY_TEXT =
  "To-dos are Jira Subtasks. The first one creates this screen's Epic in Jira.";

/** The tag of a Subtask for its Jira status category (the tones of the frame S-23: grey, blue, green). */
export const CATEGORY_TAG: Record<JiraStatusCategory, { label: string; tone: TagTone }> = {
  TO_DO: { label: 'To do', tone: 'neutral' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  DONE: { label: 'Done', tone: 'success' },
};

/** The Subtasks not done: what `pendingSubtasks` of the screen counts (D-99). */
export function pendingCount(tree: JiraTree): number {
  return tree.stories.reduce(
    (total, story) => total + story.subtasks.filter((t) => t.statusCategory !== 'DONE').length,
    0,
  );
}

/** The Jira project of the screen, from the key of its Epic ("TECHEA-101" → "TECHEA"); null without an Epic. */
export function projectKeyOf(tree: JiraTree): string | null {
  const key = tree.epic?.jiraIssueKey;
  if (key === undefined) return null;
  const dash = key.lastIndexOf('-');
  return dash > 0 ? key.slice(0, dash) : null;
}

/** The link to an issue only when it is http or https (a stored value of another kind is never made clickable). */
export function safeJiraUrl(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

const byId = (a: { id: number }, b: { id: number }) => a.id - b.id;

function upsert<T extends { id: number }>(rows: readonly T[], row: T, merge: (old: T) => T): T[] {
  const exists = rows.some((r) => r.id === row.id);
  return (exists ? rows.map((r) => (r.id === row.id ? merge(r) : r)) : [...rows, row]).sort(byId);
}

/** The tree after a creation: the answer's Epic, Story and Subtask put in place (by id), the rest untouched. */
export function mergeCreated(tree: JiraTree, created: JiraCreated): JiraTree {
  const story: JiraStory = {
    ...created.story,
    subtasks: [],
  };
  const stories = upsert<JiraStory>(tree.stories, story, (old) => ({
    ...created.story,
    subtasks: old.subtasks,
  })).map((s) =>
    s.id === created.story.id
      ? { ...s, subtasks: upsert<JiraTicket>(s.subtasks, created.subtask, () => created.subtask) }
      : s,
  );
  return { ...tree, epic: created.epic, stories };
}
