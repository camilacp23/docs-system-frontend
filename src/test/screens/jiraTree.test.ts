// The pure parts of the Future to do tab: the form checks and the request body of "Add to-do" (todoForm), and the helpers of
// the tree (jiraTree): the pending count, the project of the Epic, the merge of a creation, the link check and the reason
// that disables Add to-do.
import { describe, expect, it } from 'vitest';

import {
  addTodoBlockReason,
  JIRA_ADD_UNAVAILABLE_REASON,
  mergeCreated,
  pendingCount,
  projectKeyOf,
  safeJiraUrl,
} from '../../modules/screens/jiraTree';
import type { JiraCreated, JiraTree } from '../../modules/screens/jiraTypes';
import {
  summaryRule,
  toTodoBody,
  validateTodoForm,
  type TodoForm,
} from '../../modules/screens/todoForm';
import { listJiraTree, makeFakeJira, sampleJiraTickets } from '../helpers/fakeScreenJira';

const FORM: TodoForm = {
  mode: 'existing',
  storyId: 2,
  storySummary: '',
  storyDescription: '',
  todoSummary: 'A to-do',
  todoDescription: '',
};

function sampleTree(): JiraTree {
  const jira = makeFakeJira({ tickets: sampleJiraTickets(12) });
  return listJiraTree(
    jira,
    { application: { name: 'SAR', archived: false }, now: () => '' },
    12,
    false,
  );
}

describe('todoForm: summaryRule', () => {
  it('judges required after trimming, then line breaks, then the length in UTF-16 units', () => {
    expect(summaryRule('')).toBe('required');
    expect(summaryRule('  \t ')).toBe('required');
    expect(summaryRule(' \n ')).toBe('required');
    expect(summaryRule('one\ntwo')).toBe('singleLine');
    expect(summaryRule('one\r\ntwo')).toBe('singleLine');
    expect(summaryRule('x'.repeat(255))).toBeNull();
    expect(summaryRule('x'.repeat(256))).toBe('maxLength');
    expect(summaryRule('😀'.repeat(127))).toBeNull();
    expect(summaryRule('😀'.repeat(128))).toBe('maxLength');
    expect(summaryRule('Añadir confirmación')).toBeNull();
  });
});

describe('todoForm: validateTodoForm', () => {
  it('has no errors for a to-do under an existing Story', () => {
    expect(validateTodoForm(FORM)).toEqual({});
  });

  it('asks for the to-do summary with the catalog text of the rule', () => {
    expect(validateTodoForm({ ...FORM, todoSummary: '  ' })).toEqual({
      todoSummary: 'To-do summary is required.',
    });
    expect(validateTodoForm({ ...FORM, todoSummary: 'a\nb' })).toEqual({
      todoSummary: 'To-do summary must be a single line.',
    });
    expect(validateTodoForm({ ...FORM, todoSummary: 'x'.repeat(256) })).toEqual({
      todoSummary: 'To-do summary is too long.',
    });
  });

  it('checks the summary of the new Story only when a new Story is created', () => {
    expect(validateTodoForm({ ...FORM, storySummary: '' })).toEqual({});
    expect(validateTodoForm({ ...FORM, mode: 'new', storyId: null, storySummary: '' })).toEqual({
      storySummary: 'Story summary is required.',
    });
  });

  it('asks for a Story when the mode is existing and none is chosen', () => {
    expect(validateTodoForm({ ...FORM, storyId: null })).toEqual({ story: 'Choose a story.' });
  });
});

describe('todoForm: toTodoBody', () => {
  it('sends the chosen Story and the Subtask, with the texts as typed', () => {
    expect(toTodoBody({ ...FORM, todoSummary: '  A to-do ' })).toEqual({
      storyId: 2,
      subtask: { summary: '  A to-do ' },
    });
  });

  it('leaves out the descriptions that are empty or only spaces and keeps the others', () => {
    expect(toTodoBody({ ...FORM, todoDescription: '   ' }).subtask).toEqual({ summary: 'A to-do' });
    expect(toTodoBody({ ...FORM, todoDescription: 'Detail' }).subtask).toEqual({
      summary: 'A to-do',
      description: 'Detail',
    });
  });

  it('sends a new Story instead of a Story id, with its description', () => {
    expect(
      toTodoBody({
        ...FORM,
        mode: 'new',
        storySummary: 'Accessibility',
        storyDescription: 'Keyboard',
      }),
    ).toEqual({
      newStory: { summary: 'Accessibility', description: 'Keyboard' },
      subtask: { summary: 'A to-do' },
    });
  });

  it('ignores a leftover Story id when the mode is new', () => {
    const body = toTodoBody({ ...FORM, mode: 'new', storySummary: 'S' });
    expect(body).not.toHaveProperty('storyId');
  });
});

describe('jiraTree helpers', () => {
  it('counts the Subtasks that are not done', () => {
    expect(pendingCount(sampleTree())).toBe(3);
    expect(pendingCount({ ...sampleTree(), stories: [] })).toBe(0);
  });

  it('takes the project from the key of the Epic', () => {
    expect(projectKeyOf(sampleTree())).toBe('TECHEA');
    expect(projectKeyOf({ ...sampleTree(), epic: null })).toBeNull();
    const tree = sampleTree();
    expect(
      projectKeyOf({
        ...tree,
        epic: { ...(tree.epic as NonNullable<typeof tree.epic>), jiraIssueKey: 'AB_C1-17' },
      }),
    ).toBe('AB_C1');
  });

  it('draws a link only for http and https addresses', () => {
    expect(safeJiraUrl('https://jira.example.test/browse/A-1')).toBe(
      'https://jira.example.test/browse/A-1',
    );
    expect(safeJiraUrl('http://localhost:3002/browse/A-1')).toBe(
      'http://localhost:3002/browse/A-1',
    );
    expect(safeJiraUrl('javascript:alert(1)')).toBeNull();
    expect(safeJiraUrl('//jira.example.test/browse/A-1')).toBeNull();
    expect(safeJiraUrl('')).toBeNull();
    expect(safeJiraUrl(null)).toBeNull();
  });

  it('gives the write block first and Jira not responding second as the reason for Add to-do', () => {
    expect(addTodoBlockReason(null, false)).toBeNull();
    expect(addTodoBlockReason(null, true)).toBe(JIRA_ADD_UNAVAILABLE_REASON);
    expect(addTodoBlockReason('Read-only: the application is archived.', true)).toBe(
      'Read-only: the application is archived.',
    );
  });
});

describe('jiraTree: mergeCreated', () => {
  const tree = sampleTree();
  const base = {
    lastSyncedAt: '2026-10-06T10:00:00.000Z',
    url: 'https://jira.example.test/browse/X',
    status: 'To Do',
    statusCategory: 'TO_DO' as const,
  };
  const subtask = (id: number, key: string): JiraCreated['subtask'] => ({
    ...base,
    id,
    jiraIssueKey: key,
    hierarchyLevel: 'SUBTASK',
    issueType: 'Subtask',
    summary: `to-do ${key}`,
  });

  it('puts a Subtask under its existing Story, in id order, and leaves the rest alone', () => {
    const story = tree.stories[0] as NonNullable<(typeof tree.stories)[number]>;
    const created: JiraCreated = {
      epic: tree.epic as NonNullable<typeof tree.epic>,
      story,
      subtask: subtask(50, 'TECHEA-108'),
      created: ['SUBTASK'],
    };
    const merged = mergeCreated(tree, created);

    expect(merged.stories[0]?.subtasks.map((s) => s.jiraIssueKey)).toEqual([
      'TECHEA-103',
      'TECHEA-104',
      'TECHEA-108',
    ]);
    expect(merged.stories[1]).toBe(tree.stories[1]);
    expect(pendingCount(merged)).toBe(4);
    // The tree it came from is not changed.
    expect(tree.stories[0]?.subtasks).toHaveLength(2);
  });

  it('adds a new Story with its Subtask, and an Epic that did not exist', () => {
    const epicOnly: JiraTree = { ...tree, epic: null, stories: [] };
    const created: JiraCreated = {
      epic: tree.epic as NonNullable<typeof tree.epic>,
      story: {
        ...(tree.stories[0] as NonNullable<(typeof tree.stories)[number]>),
        subtasks: undefined,
      } as never,
      subtask: subtask(9, 'TECHEA-103'),
      created: ['EPIC', 'STANDARD', 'SUBTASK'],
    };
    const merged = mergeCreated(epicOnly, created);

    expect(merged.epic?.jiraIssueKey).toBe('TECHEA-101');
    expect(merged.stories).toHaveLength(1);
    expect(merged.stories[0]?.subtasks.map((s) => s.jiraIssueKey)).toEqual(['TECHEA-103']);
  });

  it('keeps the Subtasks of a Story that the answer names, and replaces the Story fields', () => {
    const story = {
      ...(tree.stories[1] as NonNullable<(typeof tree.stories)[number]>),
      summary: 'Renamed in Jira',
    };
    const merged = mergeCreated(tree, {
      epic: tree.epic as NonNullable<typeof tree.epic>,
      story,
      subtask: subtask(60, 'TECHEA-110'),
      created: ['SUBTASK'],
    });

    expect(merged.stories[1]?.summary).toBe('Renamed in Jira');
    expect(merged.stories[1]?.subtasks).toHaveLength(3);
  });
});
