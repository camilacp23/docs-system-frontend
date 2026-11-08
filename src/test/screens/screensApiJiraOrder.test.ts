// Order of the checks of the two Jira operations in the in-memory screens API (fakeScreensApi, fakeScreenJira). It must
// answer in the order of the real server (contract 0.3.5, D-92, D-94, D-95):
//   POST  400 (shape, then summaries) -> 404 -> 422 APPLICATION_ARCHIVED -> 422 STORY_NOT_IN_SCREEN -> 502 JIRA_UNAVAILABLE
//         -> the creation -> 502 JIRA_PARTIAL_FAILURE
//   GET   404; a refresh that cannot complete is still 200 with `sync.stale`, and never writes without a change (D-97)
// The page tests rely on it: a fake that checked in another order would let a test pass for a reason the server never
// produces.
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { JiraTicketCreate } from '../../modules/screens/jiraTypes';
import type { FakeJira } from '../helpers/fakeScreenJira';
import { sampleJiraTickets } from '../helpers/fakeScreenJira';
import { makeScreensApi } from '../helpers/fakeScreensApi';
import { makeApplication, makeApplicationsClient } from '../helpers/renderApp';
import { sampleScreens } from '../helpers/renderScreens';

const SCREEN = 12;

function api(options: { archived?: boolean; jira?: Partial<FakeJira>; tickets?: boolean } = {}) {
  const apps = makeApplicationsClient([
    makeApplication(1, { name: 'SAR', status: options.archived ? 'ARCHIVED' : 'ACTIVE' }),
  ]);
  return makeScreensApi(apps, {
    screenDetails: sampleScreens(),
    jira: { tickets: options.tickets === false ? [] : sampleJiraTickets(SCREEN), ...options.jira },
  });
}

type Fake = ReturnType<typeof api>;

async function create(fake: Fake, body: unknown, id: number = SCREEN) {
  try {
    const result = await fake.client.post('/screens/{id}/jira-ticket', {
      path: { id },
      body: body as JiraTicketCreate,
    });
    return result.body.data;
  } catch (thrown) {
    return thrown as ApiError;
  }
}

async function list(fake: Fake, refresh = false, id: number = SCREEN) {
  const result = await fake.client.get('/screens/{id}/jira-tickets', {
    path: { id },
    query: refresh ? { refresh: true } : {},
  });
  return result.body.data;
}

const SUBTASK = { summary: 'Add confirmation before leaving' };

function fieldOf(error: unknown): string | undefined {
  const fields = (error as ApiError).details?.fields as Array<{ field: string }> | undefined;
  return fields?.[0]?.field;
}

describe('POST /screens/{id}/jira-ticket: order of the errors', () => {
  it('answers 400 on the shape of the body before it looks up the screen', async () => {
    const error = await create(api(), { subtask: SUBTASK }, 999);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    const both = await create(api(), { storyId: 2, newStory: SUBTASK, subtask: SUBTASK }, 999);
    expect((both as ApiError).status).toBe(400);
  });

  it('judges the summaries as the contract says: required, singleLine, then maxLength in UTF-16 units', async () => {
    const fake = api();
    const rule = async (summary: string) => {
      const error = await create(fake, { storyId: 2, subtask: { summary } });
      const fields = (error as ApiError).details?.fields as Array<{ field: string; rule: string }>;
      return `${fields[0]?.field}:${fields[0]?.rule}`;
    };
    expect(await rule('')).toBe('subtask.summary:minLength');
    expect(await rule('   ')).toBe('subtask.summary:required');
    expect(await rule('one\ntwo')).toBe('subtask.summary:singleLine');
    expect(await rule('x'.repeat(256))).toBe('subtask.summary:maxLength');
    // An emoji counts as 2 units: 128 of them are 256.
    expect(await rule('😀'.repeat(128))).toBe('subtask.summary:maxLength');
    expect(
      await create(fake, { storyId: 2, subtask: { summary: 'x'.repeat(255) } }),
    ).toHaveProperty('subtask');
    const story = await create(fake, { newStory: { summary: ' ' }, subtask: SUBTASK });
    expect(fieldOf(story)).toBe('newStory.summary');
  });

  it('answers 404 for a screen that does not exist, before the application and the story', async () => {
    const error = await create(api({ archived: true }), { storyId: 99, subtask: SUBTASK }, 999);
    expect((error as ApiError).code).toBe('NOT_FOUND');
  });

  it('answers APPLICATION_ARCHIVED before STORY_NOT_IN_SCREEN', async () => {
    const error = await create(api({ archived: true }), { storyId: 99, subtask: SUBTASK });
    expect((error as ApiError).code).toBe('APPLICATION_ARCHIVED');
  });

  it('answers STORY_NOT_IN_SCREEN before JIRA_UNAVAILABLE, for an id of another kind of issue too', async () => {
    const fake = api({ jira: { available: false } });
    for (const storyId of [999, 1, 3]) {
      const error = await create(fake, { storyId, subtask: SUBTASK });
      expect((error as ApiError).code).toBe('STORY_NOT_IN_SCREEN');
      expect((error as ApiError).details).toEqual({ storyId });
    }
  });

  it('answers JIRA_UNAVAILABLE when nothing was created, and creates nothing', async () => {
    const fake = api({ jira: { available: false }, tickets: false });
    const error = await create(fake, { newStory: { summary: 'A story' }, subtask: SUBTASK });
    expect((error as ApiError).code).toBe('JIRA_UNAVAILABLE');
    expect(fake.jira.tickets).toHaveLength(0);
    // A Subtask that fails under a Story that already existed created nothing new: JIRA_UNAVAILABLE as well.
    const second = api();
    second.jira.createFailure = { kind: 'partial', after: 'story' };
    const failed = await create(second, { storyId: 2, subtask: SUBTASK });
    expect((failed as ApiError).code).toBe('JIRA_UNAVAILABLE');
    expect(second.jira.tickets).toHaveLength(7);
  });

  it('creates the Epic, the Story and the Subtask with provisional values, in the order of `created`', async () => {
    const fake = api({ tickets: false });
    const result = await create(fake, {
      newStory: { summary: 'Initial documentation tasks' },
      subtask: SUBTASK,
    });
    expect(result).toMatchObject({
      created: ['EPIC', 'STANDARD', 'SUBTASK'],
      epic: {
        issueType: 'Epic',
        summary: 'Detalle (SAR)',
        status: 'To Do',
        statusCategory: 'TO_DO',
      },
      story: { issueType: 'Story', summary: 'Initial documentation tasks' },
      subtask: { issueType: 'Subtask', jiraIssueKey: 'TECHEA-103' },
    });
    expect(fake.state.screens.find((s) => s.id === SCREEN)?.pendingSubtasks).toBe(1);
  });

  it('creates only the Subtask under an existing Story, also on a screen in review', async () => {
    const fake = api();
    expect(fake.state.screens.find((s) => s.id === SCREEN)?.documentationStatus).toBe('IN_REVIEW');
    const result = await create(fake, { storyId: 2, subtask: SUBTASK });
    expect(result).toMatchObject({ created: ['SUBTASK'], story: { id: 2 } });
    expect(fake.state.screens.find((s) => s.id === SCREEN)?.pendingSubtasks).toBe(4);
  });

  it('answers JIRA_PARTIAL_FAILURE with the story id, and a retry with it never duplicates', async () => {
    const fake = api({ tickets: false });
    fake.jira.createFailure = { kind: 'partial', after: 'story' };
    const error = (await create(fake, {
      newStory: { summary: 'A story' },
      subtask: SUBTASK,
    })) as ApiError;
    expect(error.code).toBe('JIRA_PARTIAL_FAILURE');
    const storyId = error.details?.storyId as number;
    expect(error.details).toMatchObject({ key: 'TECHEA-102', created: { epic: 'TECHEA-101' } });
    expect(fake.jira.tickets.map((t) => t.hierarchyLevel)).toEqual(['EPIC', 'STANDARD']);
    const retry = await create(fake, { storyId, subtask: SUBTASK });
    expect(retry).toMatchObject({ created: ['SUBTASK'] });
    expect(fake.jira.tickets.filter((t) => t.hierarchyLevel === 'EPIC')).toHaveLength(1);
    expect(fake.jira.tickets.filter((t) => t.hierarchyLevel === 'STANDARD')).toHaveLength(1);
  });

  it('answers JIRA_PARTIAL_FAILURE without a story id when only the Epic was created, and the retry reuses it', async () => {
    const fake = api({ tickets: false });
    fake.jira.createFailure = { kind: 'partial', after: 'epic' };
    const error = (await create(fake, {
      newStory: { summary: 'A story' },
      subtask: SUBTASK,
    })) as ApiError;
    expect(error.details).toEqual({ key: 'TECHEA-101', created: { epic: 'TECHEA-101' } });
    const retry = await create(fake, { newStory: { summary: 'A story' }, subtask: SUBTASK });
    expect(retry).toMatchObject({ created: ['STANDARD', 'SUBTASK'] });
    expect(fake.jira.tickets.filter((t) => t.hierarchyLevel === 'EPIC')).toHaveLength(1);
  });

  it('reports the keys that could not be saved, with the reason', async () => {
    const lost = api({ tickets: false });
    lost.jira.createFailure = { kind: 'unsaved', reason: 'SCREEN_DELETED' };
    const deleted = (await create(lost, {
      newStory: { summary: 'A story' },
      subtask: SUBTASK,
    })) as ApiError;
    expect(deleted.details).toEqual({
      created: { epic: 'TECHEA-101', story: 'TECHEA-102' },
      unsaved: ['TECHEA-101', 'TECHEA-102'],
      reason: 'SCREEN_DELETED',
    });
    expect(lost.jira.tickets).toHaveLength(0);
    const failed = api({ tickets: false });
    failed.jira.createFailure = { kind: 'unsaved', reason: 'SAVE_FAILED' };
    const saveFailed = (await create(failed, {
      newStory: { summary: 'A story' },
      subtask: SUBTASK,
    })) as ApiError;
    expect(saveFailed.details).toMatchObject({ unsaved: ['TECHEA-102'], reason: 'SAVE_FAILED' });
  });
});

describe('GET /screens/{id}/jira-tickets', () => {
  it('answers 404 for a screen that does not exist', async () => {
    await expect(list(api(), false, 999)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('answers an empty tree with no Epic and no date', async () => {
    const tree = await list(api({ tickets: false }));
    expect(tree).toEqual({
      epic: null,
      stories: [],
      sync: { jiraAvailable: true, stale: false, lastSyncedAt: null },
    });
  });

  it('answers the tree by id with the newest date of the copy, without calling Jira', async () => {
    const tree = await list(api());
    expect(tree.epic?.jiraIssueKey).toBe('TECHEA-101');
    expect(tree.stories.map((s) => s.jiraIssueKey)).toEqual(['TECHEA-102', 'TECHEA-105']);
    expect(tree.stories[0]?.subtasks.map((s) => s.jiraIssueKey)).toEqual([
      'TECHEA-103',
      'TECHEA-104',
    ]);
    expect(tree.sync).toEqual({
      jiraAvailable: true,
      stale: false,
      lastSyncedAt: '2026-10-05T08:40:00.000Z',
    });
  });

  it('without refresh is not stale even when Jira is down (that is what jiraAvailable says)', async () => {
    const tree = await list(api({ jira: { available: false } }));
    expect(tree.sync).toMatchObject({ jiraAvailable: false, stale: false });
  });

  it('a refresh brings only the rows that changed and moves the date', async () => {
    const fake = api();
    fake.jira.remote.set(3, { status: 'Done', statusCategory: 'DONE' });
    fake.jira.remote.set(6, { status: 'To Do', statusCategory: 'TO_DO' });
    const tree = await list(fake, true);
    expect(tree.stories[0]?.subtasks[0]).toMatchObject({ status: 'Done', statusCategory: 'DONE' });
    expect(tree.sync.stale).toBe(false);
    expect(tree.sync.lastSyncedAt).not.toBe('2026-10-05T08:40:00.000Z');
    // The unchanged row keeps its own date (D-97).
    expect(tree.stories[1]?.subtasks[0]?.lastSyncedAt).toBe('2026-10-05T08:40:00.000Z');
    expect(fake.state.screens.find((s) => s.id === SCREEN)?.pendingSubtasks).toBe(2);
  });

  it('a refresh that cannot complete answers 200 with the local copy and stale = true', async () => {
    const down = api({ jira: { available: false } });
    down.jira.remote.set(3, { status: 'Done', statusCategory: 'DONE' });
    const tree = await list(down, true);
    expect(tree.sync).toEqual({
      jiraAvailable: false,
      stale: true,
      lastSyncedAt: '2026-10-05T08:40:00.000Z',
    });
    expect(tree.stories[0]?.subtasks[0]?.status).toBe('To Do');
    const archived = await list(api({ archived: true }), true);
    expect(archived.sync).toMatchObject({ jiraAvailable: true, stale: true });
  });
});
