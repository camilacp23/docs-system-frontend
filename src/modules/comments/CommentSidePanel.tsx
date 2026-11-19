// CommentSidePanel: "About this discussion" next to the thread (S-35): the status of the screen, the number of comments,
// the last activity and the participants.
// Props: screen ({ documentationStatus, author }), comments (the loaded ones, oldest first), total (the count of the
// thread), partial (older comments are not loaded yet, so the participants are the ones seen so far).
// Participants are the screen's author plus whoever wrote a loaded comment, each with initials and a tag only when it is
// true (D-143): "Screen author", or "Reviewer" for someone who wrote a review comment. The API gives no role, so no other
// tag is drawn. Last activity is the latest creation or edit among the loaded comments (the newest end is always loaded).
import type { ReactNode } from 'react';

import { Avatar, StatusTag, Tag } from '../../components/ui';
import { toTagStatus } from '../screens/screenLabels';
import type { Screen } from '../screens/screenTypes';

import { formatCommentTime, participantsOf } from './commentModel';
import { PANEL_NOTE, PANEL_TITLE, PARTIAL_PARTICIPANTS_NOTE } from './commentTexts';
import type { ScreenComment } from './commentTypes';

function lastActivity(comments: readonly ScreenComment[]): string | null {
  let latest: string | null = null;
  for (const comment of comments) {
    const at = comment.updatedAt ?? comment.createdAt;
    if (latest === null || Date.parse(at) > Date.parse(latest)) latest = at;
  }
  return latest;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-divider py-2.5 text-label first:border-t-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-semibold text-ink-900">{children}</dd>
    </div>
  );
}

export function CommentSidePanel({
  screen,
  comments,
  total,
  partial,
}: {
  screen: Pick<Screen, 'documentationStatus' | 'author'>;
  comments: readonly ScreenComment[];
  total: number;
  partial: boolean;
}) {
  const last = lastActivity(comments);
  const participants = participantsOf(screen.author, comments);
  return (
    <aside
      aria-labelledby="comments-panel-title"
      className="sticky top-0 flex flex-col gap-4 rounded-card border border-border-subtle bg-surface p-5 shadow-card"
    >
      <h2 id="comments-panel-title" className="text-card-title font-bold text-ink-900">
        {PANEL_TITLE}
      </h2>
      <dl>
        <Row label="Status">
          <StatusTag status={toTagStatus(screen.documentationStatus)} />
        </Row>
        <Row label="Comments">{total}</Row>
        <Row label="Last activity">{last === null ? '—' : formatCommentTime(last)}</Row>
      </dl>
      <section aria-labelledby="comments-participants-title" className="flex flex-col gap-2">
        <h3
          id="comments-participants-title"
          className="text-micro font-bold tracking-wider text-ink-500 uppercase"
        >
          Participants
        </h3>
        <ul className="flex flex-col">
          {participants.map((person) => (
            <li
              key={person.id}
              className="flex items-center gap-2.5 border-t border-divider py-2 first:border-t-0"
            >
              <Avatar name={person.name} decorative className="size-7" />
              <span className="min-w-0 flex-1 text-label break-words text-ink-900">
                {person.name}
              </span>
              {person.tag !== null && <Tag>{person.tag}</Tag>}
            </li>
          ))}
        </ul>
        {partial && <p className="text-small text-ink-500">{PARTIAL_PARTICIPANTS_NOTE}</p>}
      </section>
      <p className="text-small text-ink-500">{PANEL_NOTE}</p>
    </aside>
  );
}
