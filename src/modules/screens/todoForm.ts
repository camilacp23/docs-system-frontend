// todoForm: the form model of "Add to-do" (S-24a, S-24b): what the client checks before sending, and the request body.
// The client checks only what the contract declares for the two summaries, so a mistake is told before the call; the API
// stays the authority (the same rules come back as a 400 on the field):
//   required   a summary of only spaces or line breaks (after trimming)         → "<Label> is required."
//   singleLine a summary with line breaks                                        → "<Label> must be a single line."
//   maxLength  more than 255 characters counted as Jira counts them (UTF-16 units: an emoji is 2, which is what
//              String.length gives) → "<Label> is too long."
// Texts come from the rule catalog of src/api/messages.ts. Summaries and descriptions are sent as typed (trimming only
// decides whether there is content); an empty description is left out of the body.
import { getRuleMessage } from '../../api/messages';

import type { JiraTicketCreate } from './jiraTypes';

export const SUMMARY_MAX_LENGTH = 255;
export const DESCRIPTION_MAX_LENGTH = 10000;

export const STORY_SUMMARY_LABEL = 'Story summary';
export const TODO_SUMMARY_LABEL = 'To-do summary';

export type StoryMode = 'existing' | 'new';

export interface TodoForm {
  mode: StoryMode;
  storyId: number | null;
  storySummary: string;
  storyDescription: string;
  todoSummary: string;
  todoDescription: string;
}

export type TodoErrors = Partial<Record<'storySummary' | 'todoSummary' | 'story', string>>;

/** The rule a summary breaks, or null. Line breaks are told before the length. */
export function summaryRule(value: string): 'required' | 'singleLine' | 'maxLength' | null {
  if (value.trim() === '') return 'required';
  if (/[\r\n]/.test(value)) return 'singleLine';
  if (value.length > SUMMARY_MAX_LENGTH) return 'maxLength';
  return null;
}

function summaryError(value: string, label: string): string | undefined {
  const rule = summaryRule(value);
  return rule === null ? undefined : getRuleMessage(rule, label);
}

/** The mistakes the client can see, by field; an empty object when the form can be sent. */
export function validateTodoForm(form: TodoForm): TodoErrors {
  const errors: TodoErrors = {};
  if (form.mode === 'existing' && form.storyId === null) {
    errors.story = 'Choose a story.';
  }
  if (form.mode === 'new') {
    const story = summaryError(form.storySummary, STORY_SUMMARY_LABEL);
    if (story !== undefined) errors.storySummary = story;
  }
  const todo = summaryError(form.todoSummary, TODO_SUMMARY_LABEL);
  if (todo !== undefined) errors.todoSummary = todo;
  return errors;
}

function text(summary: string, description: string) {
  return description.trim() === '' ? { summary } : { summary, description };
}

/** The body of POST /screens/{id}/jira-ticket: the chosen Story or the new one, and the Subtask. */
export function toTodoBody(form: TodoForm): JiraTicketCreate {
  const subtask = text(form.todoSummary, form.todoDescription);
  return form.mode === 'existing' && form.storyId !== null
    ? { storyId: form.storyId, subtask }
    : { newStory: text(form.storySummary, form.storyDescription), subtask };
}
