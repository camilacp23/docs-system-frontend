// AddTodoModal: "Add to-do" of the Future to do tab (S-24a, S-24b, S-24c, P-04), for the Administrator and the Developer.
// Props: screen ({ id, name }), tree (the screen's Jira tree: its Stories are the options and its Epic gives the project),
// onClose, onCreated(created) (POST /screens/{id}/jira-ticket answered 201: the tab puts the answer in the tree and says
// so), onReloadTree() (read the tree again: the Stories changed or something was created).
// The to-do becomes a Jira Subtask under a Story: an existing Story of the Epic or a new one (summary and an optional
// description), plus the Subtask (summary, optional description). Without an Epic the first to-do creates it and the modal
// says so. Creating is allowed on a screen in review (D-92). The summaries are checked in the client (todoForm.ts: required
// after trimming, single line, 255 characters as Jira counts them); the API is the authority and its field errors land on
// the same fields. The subtitle names the project of the Epic when there is one.
// Refusals, by code, never by the server text:
//   STORY_NOT_IN_SCREEN   its message; the Stories are read again and the choice is repaired.
//   JIRA_UNAVAILABLE      its message; the shell learns Jira is down; everything typed stays.
//   JIRA_PARTIAL_FAILURE  with `storyId`: the Story was created, so it is chosen ("Just created") and a retry adds only the
//                         Subtask; with only the Epic: the same form is sent again and reuses it; with `unsaved` keys: the
//                         message lists them. Nothing typed is lost; the tree is read again.
//   others                the catalog text in a banner (APPLICATION_ARCHIVED ...).
// The button is disabled with the reason when the application is archived or the browser is offline (useWriteBlock).
// Layout (the one of the New variable modal): wide, two columns of headed groups, Story (existing or new) on the left and the To-do
// (summary, description) on the right; the footer says what it creates, or why it is disabled.
// Focus is trapped, starts on the first control, Esc and Cancel close it (not while sending) and returns to the button.
import { BookOpen, Info, ListTodo, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { isApiError } from '../../api/ApiError';
import { getErrorMessage, getFieldErrors, getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import {
  Banner,
  Button,
  cx,
  FormField,
  ICON_STROKE_WIDTH,
  Modal,
  Tag,
  Textarea,
  TextField,
} from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';
import { useJiraStatus } from '../../layout/jiraStatusContext';
import { ModalGroup } from '../shared/ModalGroup';

import { projectKeyOf } from './jiraTree';
import type { JiraCreated, JiraTree } from './jiraTypes';
import {
  DESCRIPTION_MAX_LENGTH,
  STORY_SUMMARY_LABEL,
  SUMMARY_MAX_LENGTH,
  TODO_SUMMARY_LABEL,
  toTodoBody,
  validateTodoForm,
  type TodoErrors,
  type TodoForm,
} from './todoForm';

export const ADD_TODO_TITLE = 'Add to-do';
export const CREATE_LABEL = 'Create in Jira';
export const FIRST_TODO_NOTICE = "This screen's Epic is created in Jira with this first to-do.";
export const SUBTASK_HELP = 'Becomes a Subtask in Jira.';
export const JUST_CREATED_LABEL = 'Just created';

interface AddTodoModalProps {
  screen: { id: number; name: string };
  tree: JiraTree;
  onClose: () => void;
  onCreated: (created: JiraCreated) => void;
  onReloadTree: () => void;
}

interface Failure {
  tone: 'warning' | 'danger';
  text: string;
}

interface StoryOption {
  id: number;
  key: string;
  summary: string;
}

const FIELD_LABELS = {
  'newStory.summary': STORY_SUMMARY_LABEL,
  'subtask.summary': TODO_SUMMARY_LABEL,
  'newStory.description': 'Story description',
  'subtask.description': 'To-do description',
};

function Counter({ value }: { value: string }) {
  return (
    <span aria-hidden="true">
      {value.length}/{SUMMARY_MAX_LENGTH}
    </span>
  );
}

export function AddTodoModal({
  screen,
  tree,
  onClose,
  onCreated,
  onReloadTree,
}: AddTodoModalProps) {
  const client = useApi();
  const { report } = useJiraStatus();
  const { blocked, reason } = useWriteBlock();
  const formId = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const storySummaryRef = useRef<HTMLInputElement>(null);
  const todoSummaryRef = useRef<HTMLInputElement>(null);
  const [justCreated, setJustCreated] = useState<{ id: number; key: string } | null>(null);

  const stories: StoryOption[] = tree.stories.map((story) => ({
    id: story.id,
    key: story.jiraIssueKey,
    summary: story.summary,
  }));
  // A Story created by a failed request is offered even if the tree has not been read again yet (or could not be).
  const options =
    justCreated !== null && !stories.some((story) => story.id === justCreated.id)
      ? [...stories, { id: justCreated.id, key: justCreated.key, summary: '' }]
      : stories;
  const hasStories = options.length > 0;

  const [chosen, setChosen] = useState<TodoForm>({
    mode: hasStories ? 'existing' : 'new',
    storyId: options[0]?.id ?? null,
    storySummary: '',
    storyDescription: '',
    todoSummary: '',
    todoDescription: '',
  });
  const [errors, setErrors] = useState<TodoErrors>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [sending, setSending] = useState(false);
  // The fields are disabled while sending: the focus goes back to the one that failed once they are enabled again.
  const [refocus, setRefocus] = useState<'storySummary' | 'todoSummary' | null>(null);
  useEffect(() => {
    if (refocus === null) return;
    (refocus === 'storySummary' ? storySummaryRef : todoSummaryRef).current?.focus();
  }, [refocus]);

  // The Stories can change under the modal (read again after a refusal): the choice is repaired as it is read, so it
  // always names a Story that is in the list (the first one when the chosen one is gone) and the mode is "new" when
  // there is none.
  const form: TodoForm = {
    ...chosen,
    mode: chosen.mode === 'existing' && options.length === 0 ? 'new' : chosen.mode,
    storyId: options.some((option) => option.id === chosen.storyId)
      ? chosen.storyId
      : (options[0]?.id ?? null),
  };

  const project = projectKeyOf(tree);
  const subtitle = `Screen ${screen.name}${project === null ? '' : ` · project ${project}`}`;
  const patch = (changes: Partial<TodoForm>) => {
    setChosen((current) => ({ ...current, ...changes }));
  };

  const fail = (text: string, tone: Failure['tone'] = 'danger') => {
    setFailure({ tone, text });
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (sending || blocked) return;
    const found = validateTodoForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFailure(null);
      if (found.storySummary !== undefined) storySummaryRef.current?.focus();
      else if (found.todoSummary !== undefined) todoSummaryRef.current?.focus();
      return;
    }
    setSending(true);
    setFailure(null);
    try {
      const result = await client.post('/screens/{id}/jira-ticket', {
        path: { id: screen.id },
        body: toTodoBody(form),
      });
      onCreated(result.body.data);
    } catch (thrown) {
      setSending(false);
      if (!isApiError(thrown)) {
        fail(getThrownMessage(thrown));
        return;
      }
      const text = getErrorMessage(thrown, { element: 'screen' }) ?? getThrownMessage(thrown);
      switch (thrown.code) {
        case 'VALIDATION_ERROR': {
          const next: TodoErrors = {};
          for (const entry of getFieldErrors(thrown, FIELD_LABELS)) {
            if (entry.field === 'newStory.summary') next.storySummary = entry.message;
            else if (entry.field === 'subtask.summary') next.todoSummary = entry.message;
            else fail(entry.message);
          }
          setErrors(next);
          setRefocus(next.storySummary !== undefined ? 'storySummary' : 'todoSummary');
          break;
        }
        case 'STORY_NOT_IN_SCREEN':
          fail(text);
          onReloadTree();
          break;
        case 'JIRA_UNAVAILABLE':
          report(false);
          fail(text);
          break;
        case 'JIRA_PARTIAL_FAILURE': {
          const storyId = thrown.details?.storyId;
          const key = thrown.details?.key;
          const unsaved = thrown.details?.unsaved;
          if (Array.isArray(unsaved)) {
            fail(text);
          } else if (typeof storyId === 'number') {
            // The Story exists in Jira and here: a retry adds only the Subtask, without duplicating anything.
            setJustCreated({ id: storyId, key: typeof key === 'string' ? key : '' });
            patch({ mode: 'existing', storyId });
            fail(text, 'warning');
          } else {
            // Only the Epic was created: the same form is sent again and the Epic is reused.
            fail(text, 'warning');
          }
          onReloadTree();
          break;
        }
        default:
          fail(text);
      }
    }
  };

  const showNew = form.mode === 'new';
  return (
    <Modal
      open
      size="xl"
      initialFocusRef={hasStories ? firstRef : storySummaryRef}
      onClose={() => {
        if (!sending) onClose();
      }}
      icon={<ListTodo size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      title={ADD_TODO_TITLE}
      description={subtitle}
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          {reason ? (
            <p className="text-small text-warning-ink">{reason}</p>
          ) : (
            <p className="flex items-start gap-2 text-small text-ink-500">
              <Info
                aria-hidden="true"
                size={16}
                strokeWidth={ICON_STROKE_WIDTH}
                className="mt-px shrink-0"
              />
              <span>
                <span className="block font-semibold text-ink-700">Created in Jira</span>
                The to-do becomes a Subtask under the Story you choose.
              </span>
            </p>
          )}
          <span className="flex shrink-0 items-center gap-2">
            <Button onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="primary"
              loading={sending}
              disabled={blocked}
              iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            >
              {CREATE_LABEL}
            </Button>
          </span>
        </div>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void send(event)}
        className="flex flex-col gap-4"
      >
        {tree.epic === null && <Banner tone="info">{FIRST_TODO_NOTICE}</Banner>}
        {failure !== null && <Banner tone={failure.tone}>{failure.text}</Banner>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-x-8">
          <ModalGroup title="Story" icon={<BookOpen size={13} strokeWidth={ICON_STROKE_WIDTH} />}>
            <fieldset className="flex flex-col gap-2" disabled={sending}>
              <legend className="sr-only">
                <span>Story</span>
                <span aria-hidden="true" className="text-danger">
                  *
                </span>
              </legend>
              {hasStories && (
                <div
                  className={cx(
                    'flex flex-col gap-1.5 rounded-control border p-3',
                    form.mode === 'existing' ? 'border-accent bg-info-bg' : 'border-border-subtle',
                  )}
                >
                  <label className="flex items-center gap-2.5 text-body-lg font-semibold text-ink-900">
                    <input
                      ref={firstRef}
                      type="radio"
                      name="story-mode"
                      checked={form.mode === 'existing'}
                      onChange={() => {
                        patch({
                          mode: 'existing',
                          storyId: form.storyId ?? options[0]?.id ?? null,
                        });
                      }}
                      className="size-4 accent-primary"
                    />
                    Add to an existing story
                  </label>
                  <div
                    role="radiogroup"
                    aria-label="Existing stories"
                    className="flex flex-col gap-1 pl-6"
                  >
                    {options.map((option) => (
                      <label
                        key={option.id}
                        className="flex items-center gap-2.5 text-body text-ink-900"
                      >
                        <input
                          type="radio"
                          name="story"
                          checked={form.mode === 'existing' && form.storyId === option.id}
                          onChange={() => {
                            patch({ mode: 'existing', storyId: option.id });
                          }}
                          className="size-4 accent-primary"
                        />
                        <span className="font-mono text-label text-ink-900">{option.key}</span>
                        <span>{option.summary}</span>
                        {justCreated?.id === option.id && (
                          <Tag tone="success">{JUST_CREATED_LABEL}</Tag>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div
                className={cx(
                  'flex flex-col gap-3 rounded-control border p-3',
                  showNew ? 'border-accent bg-info-bg' : 'border-border-subtle',
                )}
              >
                <label className="flex items-center gap-2.5 text-body-lg font-semibold text-ink-900">
                  <input
                    type="radio"
                    name="story-mode"
                    checked={showNew}
                    onChange={() => {
                      patch({ mode: 'new' });
                    }}
                    className="size-4 accent-primary"
                  />
                  Create a new story
                </label>
                {showNew && (
                  <div className="flex flex-col gap-3 pl-6">
                    <FormField
                      label={STORY_SUMMARY_LABEL}
                      required
                      error={errors.storySummary}
                      help={<Counter value={form.storySummary} />}
                    >
                      {(control) => (
                        <TextField
                          {...control}
                          ref={storySummaryRef}
                          disabled={sending}
                          value={form.storySummary}
                          onChange={(event) => {
                            patch({ storySummary: event.target.value });
                            if (errors.storySummary !== undefined) {
                              setErrors((current) => ({ ...current, storySummary: undefined }));
                            }
                          }}
                        />
                      )}
                    </FormField>
                    <FormField label="Story description">
                      {(control) => (
                        <Textarea
                          {...control}
                          rows={2}
                          maxLength={DESCRIPTION_MAX_LENGTH}
                          disabled={sending}
                          value={form.storyDescription}
                          onChange={(event) => {
                            patch({ storyDescription: event.target.value });
                          }}
                        />
                      )}
                    </FormField>
                  </div>
                )}
              </div>
              {errors.story !== undefined && (
                <p role="alert" className="text-small text-danger">
                  {errors.story}
                </p>
              )}
            </fieldset>
          </ModalGroup>
          <div className="flex flex-col gap-5 border-t border-divider pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <ModalGroup title="To-do" icon={<ListTodo size={13} strokeWidth={ICON_STROKE_WIDTH} />}>
              <FormField
                label={TODO_SUMMARY_LABEL}
                required
                error={errors.todoSummary}
                help={
                  <span className="flex justify-between gap-2">
                    <span>{SUBTASK_HELP}</span>
                    <Counter value={form.todoSummary} />
                  </span>
                }
              >
                {(control) => (
                  <TextField
                    {...control}
                    ref={todoSummaryRef}
                    disabled={sending}
                    value={form.todoSummary}
                    onChange={(event) => {
                      patch({ todoSummary: event.target.value });
                      if (errors.todoSummary !== undefined) {
                        setErrors((current) => ({ ...current, todoSummary: undefined }));
                      }
                    }}
                  />
                )}
              </FormField>
              <FormField label="Description">
                {(control) => (
                  <Textarea
                    {...control}
                    maxLength={DESCRIPTION_MAX_LENGTH}
                    disabled={sending}
                    value={form.todoDescription}
                    onChange={(event) => {
                      patch({ todoDescription: event.target.value });
                    }}
                  />
                )}
              </FormField>
            </ModalGroup>
          </div>
        </div>
      </form>
    </Modal>
  );
}
