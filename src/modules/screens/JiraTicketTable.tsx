// JiraTicketTable: the tree Epic → Stories → Subtasks of the Future to do tab (S-23) as a native table.
// Props: tree (JiraTree), highlightId (the Subtask just created, drawn with a light background).
// The Epic is the header of the card (JiraTicketsTab); here each Story is a row with a button that folds its Subtasks
// (aria-expanded and aria-controls naming the rows it hides) and each Subtask is a row below it. Keys are in IBM Plex
// Mono; a Story shows the type of its issue ("Story") after the summary; only a Subtask has the category tag. The row
// header says what the row is for screen readers ("Subtask of TECHEA-102"). Everything is reachable with Tab; the
// buttons work with Enter and Space.
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { cx, ICON_STROKE_WIDTH, Tag } from '../../components/ui';

import { JiraLink } from './JiraLink';
import { CATEGORY_TAG } from './jiraTree';
import type { JiraStory, JiraTicket, JiraTree } from './jiraTypes';

const HEAD_CLASS =
  'px-4 py-2.5 text-left text-micro font-bold tracking-wider text-ink-500 uppercase';
const CELL_CLASS = 'px-4 py-2.5 align-middle text-label text-ink-900';

function subtaskRowId(id: number): string {
  return `jira-subtask-${id}`;
}

function StoryRow({
  story,
  expanded,
  onToggle,
}: {
  story: JiraStory;
  expanded: boolean;
  onToggle: () => void;
}) {
  const controls = story.subtasks.map((s) => subtaskRowId(s.id)).join(' ');
  return (
    <tr className="border-t border-divider bg-search-bg">
      <th scope="row" className={cx(CELL_CLASS, 'font-normal')}>
        <span className="flex items-center gap-1.5">
          {story.subtasks.length > 0 ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={controls}
              aria-label={`Subtasks of ${story.jiraIssueKey}`}
              onClick={onToggle}
              className="flex size-6 items-center justify-center rounded-chip text-ink-700 hover:bg-control-active"
            >
              {expanded ? (
                <ChevronDown aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
              ) : (
                <ChevronRight aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
              )}
            </button>
          ) : (
            <span aria-hidden="true" className="size-6" />
          )}
          <span className="font-mono text-label font-semibold text-ink-900">
            {story.jiraIssueKey}
          </span>
        </span>
      </th>
      <td className={CELL_CLASS}>
        <strong className="font-bold">{story.summary}</strong>{' '}
        <span className="text-small text-ink-500">{story.issueType}</span>
      </td>
      <td className={CELL_CLASS}>{story.status}</td>
      <td className={CELL_CLASS} />
      <td className={cx(CELL_CLASS, 'text-right')}>
        <JiraLink ticket={story} />
      </td>
    </tr>
  );
}

function SubtaskRow({
  subtask,
  parentKey,
  hidden,
  highlighted,
}: {
  subtask: JiraTicket;
  parentKey: string;
  hidden: boolean;
  highlighted: boolean;
}) {
  const category = CATEGORY_TAG[subtask.statusCategory];
  return (
    <tr
      id={subtaskRowId(subtask.id)}
      hidden={hidden}
      data-just-created={highlighted || undefined}
      className={cx('border-t border-divider', highlighted && 'bg-info-bg')}
    >
      <th scope="row" className={cx(CELL_CLASS, 'pl-12 font-normal')}>
        <span className="sr-only">{`Subtask of ${parentKey}: `}</span>
        <span className="font-mono text-label text-ink-900">{subtask.jiraIssueKey}</span>
        {highlighted && <span className="sr-only"> (just created)</span>}
      </th>
      <td className={CELL_CLASS}>{subtask.summary}</td>
      <td className={CELL_CLASS}>{subtask.status}</td>
      <td className={CELL_CLASS}>
        <Tag tone={category.tone}>
          <span aria-hidden="true">●</span> {category.label}
        </Tag>
      </td>
      <td className={cx(CELL_CLASS, 'text-right')}>
        <JiraLink ticket={subtask} />
      </td>
    </tr>
  );
}

function StoryGroup({
  story,
  expanded,
  onToggle,
  highlightId,
}: {
  story: JiraStory;
  expanded: boolean;
  onToggle: () => void;
  highlightId: number | null;
}) {
  return (
    <>
      <StoryRow story={story} expanded={expanded} onToggle={onToggle} />
      {story.subtasks.map((subtask) => (
        <SubtaskRow
          key={subtask.id}
          subtask={subtask}
          parentKey={story.jiraIssueKey}
          hidden={!expanded}
          highlighted={subtask.id === highlightId}
        />
      ))}
    </>
  );
}

export function JiraTicketTable({
  tree,
  highlightId,
}: {
  tree: JiraTree;
  highlightId: number | null;
}) {
  const [folded, setFolded] = useState<ReadonlySet<number>>(new Set());
  const toggle = (id: number) => {
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return (
    <div className="overflow-x-auto border-t border-border-subtle">
      <table className="w-full text-left">
        <caption className="sr-only">Jira Stories and Subtasks of this screen</caption>
        <thead className="bg-search-bg">
          <tr>
            <th scope="col" className={HEAD_CLASS}>
              Key
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Summary
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Jira status
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Category
            </th>
            <th scope="col" className={HEAD_CLASS}>
              <span className="sr-only">Link</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tree.stories.length === 0 && (
            <tr className="border-t border-divider">
              <td colSpan={5} className={cx(CELL_CLASS, 'text-ink-500')}>
                This Epic has no Stories yet.
              </td>
            </tr>
          )}
          {tree.stories.map((story) => (
            <StoryGroup
              key={story.id}
              story={story}
              expanded={!folded.has(story.id)}
              onToggle={() => {
                toggle(story.id);
              }}
              highlightId={highlightId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
