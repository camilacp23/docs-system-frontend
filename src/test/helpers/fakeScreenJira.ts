// fakeScreenJira: GET /screens/{id}/jira-tickets and POST /screens/{id}/jira-ticket of the in-memory screens API, with
// the checks of the real server in its order (contract 0.3.5, D-90 to D-97). It never calls Jira: Jira is a state.
//   POST  400 (shape of the body, then the summaries: required -> singleLine -> maxLength in UTF-16 units) -> 404 (the
//         screen) -> 422 APPLICATION_ARCHIVED -> 422 STORY_NOT_IN_SCREEN -> 502 JIRA_UNAVAILABLE (nothing was created) ->
//         the creation -> 502 JIRA_PARTIAL_FAILURE (something was created). Creating is allowed on a screen IN_REVIEW.
//   GET   404 (the screen). Without `refresh` it answers the local copy and never calls Jira. With `refresh=true` on an
//         active application whose Jira is available it brings the copy up to date from `remote` (only the rows that
//         change, D-97) and `sync.lastSyncedAt` is the moment of the refresh; otherwise it answers the local copy with
//         `sync.stale = true` (D-95). `sync.jiraAvailable` is `jira.available`. Stories and Subtasks go by id.
// The issues are created with provisional values: status "To Do", category TO_DO, the issue type of the level (D-90).
// `createFailure` arms the next creation: `unavailable` (nothing created), `partial` after the `epic` or the `story`
// (they are saved, the request fails), `unsaved` with a `reason` (the keys that could not be saved are reported).
import { ApiError } from '../../api/ApiError';
import type {
  JiraCreated,
  JiraTicket,
  JiraTicketCreate,
  JiraTree,
} from '../../modules/screens/jiraTypes';
import type { Screen } from '../../modules/screens/screenTypes';

export const JIRA_BASE_URL = 'https://jira.example.test';
const SUMMARY_MAX_UTF16 = 255;
const DESCRIPTION_MAX = 10000;

export interface StoredTicket extends JiraTicket {
  screenId: number;
  parentId: number | null;
}

export type CreateFailure =
  | { kind: 'unavailable' }
  | { kind: 'partial'; after: 'epic' | 'story' }
  | { kind: 'unsaved'; reason: 'SCREEN_DELETED' | 'SAVE_FAILED' };

export interface FakeJira {
  /** Jira is configured and the circuit breaker is not open. */
  available: boolean;
  tickets: StoredTicket[];
  /** What Jira reports for a ticket id on a completed refresh. */
  remote: Map<number, Partial<Pick<JiraTicket, 'status' | 'statusCategory' | 'summary'>>>;
  createFailure: CreateFailure | null;
  projectKey: string;
  nextId: number;
  nextKeyNumber: number;
}

export interface JiraEnv {
  application: { name: string; archived: boolean };
  now: () => string;
}

export function makeFakeJira(overrides: Partial<FakeJira> = {}): FakeJira {
  return {
    available: true,
    tickets: [],
    remote: new Map(),
    createFailure: null,
    projectKey: 'TECHEA',
    nextId: 9000,
    nextKeyNumber: 101,
    ...overrides,
  };
}

function ticket(
  screenId: number,
  parentId: number | null,
  id: number,
  key: string,
  level: JiraTicket['hierarchyLevel'],
  summary: string,
  status: string,
  category: JiraTicket['statusCategory'],
  lastSyncedAt = '2026-10-05T08:40:00.000Z',
): StoredTicket {
  return {
    id,
    screenId,
    parentId,
    jiraIssueKey: key,
    hierarchyLevel: level,
    issueType: level === 'EPIC' ? 'Epic' : level === 'STANDARD' ? 'Story' : 'Subtask',
    summary,
    status,
    statusCategory: category,
    url: `${JIRA_BASE_URL}/browse/${key}`,
    lastSyncedAt,
  };
}

/** The tree of the frame S-23 (Epic TECHEA-101, two Stories, four Subtasks; 3 of them not done) for one screen. */
export function sampleJiraTickets(screenId: number): StoredTicket[] {
  return [
    ticket(screenId, null, 1, 'TECHEA-101', 'EPIC', 'Detalle (SAR)', 'In Progress', 'IN_PROGRESS'),
    ticket(
      screenId,
      1,
      2,
      'TECHEA-102',
      'STANDARD',
      'Validation improvements',
      'In Progress',
      'IN_PROGRESS',
    ),
    ticket(
      screenId,
      2,
      3,
      'TECHEA-103',
      'SUBTASK',
      'Validate required fields before Patch',
      'To Do',
      'TO_DO',
    ),
    ticket(
      screenId,
      2,
      4,
      'TECHEA-104',
      'SUBTASK',
      'Show error when Patch fails',
      'In Progress',
      'IN_PROGRESS',
    ),
    ticket(screenId, 1, 5, 'TECHEA-105', 'STANDARD', 'Performance', 'To Do', 'TO_DO'),
    ticket(
      screenId,
      5,
      6,
      'TECHEA-106',
      'SUBTASK',
      'Delegate the gallery filter',
      'To Do',
      'TO_DO',
    ),
    ticket(screenId, 5, 7, 'TECHEA-107', 'SUBTASK', 'Remove unused collection', 'Done', 'DONE'),
  ];
}

function validation(field: string, rule: string): ApiError {
  return new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    details: { fields: [{ field, rule, message: 'x' }] },
  });
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function checkText(value: unknown, field: string): void {
  if (!isObject(value) || typeof value.summary !== 'string')
    throw validation(`${field}.summary`, 'required');
  if (value.summary.length < 1) throw validation(`${field}.summary`, 'minLength');
  const { description } = value;
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') throw validation(`${field}.description`, 'type');
    if (description.length > DESCRIPTION_MAX) throw validation(`${field}.description`, 'maxLength');
  }
}

/** 400: the shape of the body (before the screen is looked up), then each summary. */
export function checkJiraCreateBody(body: unknown): JiraTicketCreate {
  if (!isObject(body)) throw validation('body', 'type');
  for (const key of Object.keys(body)) {
    if (!['storyId', 'newStory', 'subtask'].includes(key))
      throw validation(key, 'additionalProperties');
  }
  const hasStoryId = body.storyId !== undefined;
  const hasNewStory = body.newStory !== undefined;
  if (hasStoryId === hasNewStory) throw validation('body', 'oneOf');
  if (hasStoryId && (!Number.isInteger(body.storyId) || (body.storyId as number) < 1)) {
    throw validation('storyId', 'minimum');
  }
  if (body.subtask === undefined) throw validation('subtask', 'required');
  if (hasNewStory) checkText(body.newStory, 'newStory');
  checkText(body.subtask, 'subtask');
  const fields: Array<[string, string]> = [];
  if (hasNewStory)
    fields.push(['newStory.summary', (body.newStory as { summary: string }).summary]);
  fields.push(['subtask.summary', (body.subtask as { summary: string }).summary]);
  for (const [field, summary] of fields) {
    if (summary.trim() === '') throw validation(field, 'required');
    if (/[\r\n]/.test(summary)) throw validation(field, 'singleLine');
    if (summary.length > SUMMARY_MAX_UTF16) throw validation(field, 'maxLength');
  }
  return body as unknown as JiraTicketCreate;
}

const publicTicket = ({
  screenId: _screen,
  parentId: _parent,
  ...rest
}: StoredTicket): JiraTicket => {
  void [_screen, _parent];
  return rest;
};

function byId(a: StoredTicket, b: StoredTicket): number {
  return a.id - b.id;
}

/** The ids of the not-done Subtasks of a screen: the `pendingSubtasks` of its detail. */
export function pendingSubtasksOf(jira: FakeJira, screenId: number): number {
  return jira.tickets.filter(
    (t) => t.screenId === screenId && t.hierarchyLevel === 'SUBTASK' && t.statusCategory !== 'DONE',
  ).length;
}

export function listJiraTree(
  jira: FakeJira,
  env: JiraEnv,
  screenId: number,
  refresh: boolean,
): JiraTree {
  const own = jira.tickets.filter((t) => t.screenId === screenId);
  let stale = false;
  let completedAt: string | null = null;
  if (refresh) {
    if (env.application.archived || !jira.available) {
      stale = true;
    } else {
      completedAt = env.now();
      for (const row of own) {
        const change = jira.remote.get(row.id);
        if (change === undefined) continue;
        const next = { ...row, ...change };
        const differs = (['status', 'statusCategory', 'summary'] as const).some(
          (key) => next[key] !== row[key],
        );
        if (differs) {
          Object.assign(row, next, { lastSyncedAt: completedAt });
        }
      }
    }
  }
  const rows = jira.tickets.filter((t) => t.screenId === screenId).sort(byId);
  const epic = rows.find((t) => t.hierarchyLevel === 'EPIC') ?? null;
  const stories = rows
    .filter((t) => t.hierarchyLevel === 'STANDARD')
    .map((story) => ({
      ...publicTicket(story),
      subtasks: rows.filter((t) => t.parentId === story.id).map(publicTicket),
    }));
  const newest =
    rows
      .map((t) => t.lastSyncedAt)
      .sort()
      .at(-1) ?? null;
  return {
    epic: epic === null ? null : publicTicket(epic),
    stories,
    sync: { jiraAvailable: jira.available, stale, lastSyncedAt: completedAt ?? newest },
  };
}

function unavailable(): ApiError {
  return new ApiError({ status: 502, code: 'JIRA_UNAVAILABLE', details: null });
}

/** POST after the 400 and 404 checks. Saves what is created (even when the request then fails). */
export function createJiraTickets(
  jira: FakeJira,
  env: JiraEnv,
  screen: Screen,
  body: JiraTicketCreate,
): JiraCreated {
  if (env.application.archived) throw new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' });
  const existingEpic = jira.tickets.find(
    (t) => t.screenId === screen.id && t.hierarchyLevel === 'EPIC',
  );
  const existingStory =
    body.storyId === undefined
      ? undefined
      : jira.tickets.find(
          (t) =>
            t.id === body.storyId && t.screenId === screen.id && t.hierarchyLevel === 'STANDARD',
        );
  if (body.storyId !== undefined && existingStory === undefined) {
    throw new ApiError({
      status: 422,
      code: 'STORY_NOT_IN_SCREEN',
      details: { storyId: body.storyId },
    });
  }
  const failure = jira.createFailure;
  const nothingNew = existingEpic !== undefined && existingStory !== undefined;
  if (
    !jira.available ||
    failure?.kind === 'unavailable' ||
    (failure !== null && nothingNew && failure.kind === 'partial')
  ) {
    jira.createFailure = null;
    throw unavailable();
  }
  jira.createFailure = null;

  const make = (
    level: JiraTicket['hierarchyLevel'],
    parent: StoredTicket | null,
    summary: string,
  ): StoredTicket => {
    const key = `${jira.projectKey}-${jira.nextKeyNumber++}`;
    return ticket(
      screen.id,
      parent?.id ?? null,
      jira.nextId++,
      key,
      level,
      summary,
      'To Do',
      'TO_DO',
      env.now(),
    );
  };
  const created: JiraTicket['hierarchyLevel'][] = [];
  const keys: Record<string, string> = {};

  const epic = existingEpic ?? make('EPIC', null, `${screen.name} (${env.application.name})`);
  if (existingEpic === undefined) created.push('EPIC');
  const savedEpic =
    failure?.kind === 'unsaved' && failure.reason === 'SCREEN_DELETED' ? null : epic;
  if (existingEpic === undefined && savedEpic !== null) jira.tickets.push(epic);
  keys.epic = epic.jiraIssueKey;
  if (failure?.kind === 'partial' && failure.after === 'epic' && existingEpic === undefined) {
    throw new ApiError({
      status: 502,
      code: 'JIRA_PARTIAL_FAILURE',
      details: { key: epic.jiraIssueKey, created: { epic: epic.jiraIssueKey } },
    });
  }

  const story =
    existingStory ?? make('STANDARD', epic, (body.newStory as { summary: string }).summary);
  if (existingStory === undefined) created.push('STANDARD');
  keys.story = story.jiraIssueKey;
  if (failure?.kind === 'unsaved') {
    const unsaved =
      failure.reason === 'SCREEN_DELETED'
        ? [epic, story].filter((t) => created.includes(t.hierarchyLevel)).map((t) => t.jiraIssueKey)
        : [story.jiraIssueKey];
    throw new ApiError({
      status: 502,
      code: 'JIRA_PARTIAL_FAILURE',
      details: { created: { ...keys }, unsaved, reason: failure.reason },
    });
  }
  if (existingStory === undefined) jira.tickets.push(story);
  if (failure?.kind === 'partial' && failure.after === 'story') {
    throw new ApiError({
      status: 502,
      code: 'JIRA_PARTIAL_FAILURE',
      details: {
        key: story.jiraIssueKey,
        created: { ...keys },
        storyId: story.id,
      },
    });
  }

  const subtask = make('SUBTASK', story, body.subtask.summary);
  jira.tickets.push(subtask);
  created.push('SUBTASK');
  return {
    epic: publicTicket(epic),
    story: publicTicket(story),
    subtask: publicTicket(subtask),
    created,
  };
}
