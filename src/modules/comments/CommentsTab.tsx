// CommentsTab: the Comments tab of the screen detail (S-35), for the three roles.
// Props: screen (the detail: id, author, status and the `commentCount` the thread is read from), onCountChange(total) (the
// thread's count changed: the tab badge and the side card follow it, without waiting for the detail to be read again).
// A two-column page: the thread and its composer on the left, "About this discussion" on the right.
//  - The thread is a labelled list (`ol`) in the order of the API, oldest first, read from the newest end (useComments,
//    D-144); "Load earlier comments" puts older ones above. A failing read shows its error and a retry here, not on the
//    whole page. An empty thread says so.
//  - The composer is at the foot (CommentComposer); a new comment appears at the end and takes the focus' place in view.
//  - Edit is offered only on the signed-in user's own ordinary comments (CommentItem); the API stays the authority.
// A polite live region announces "Comment added." and "Comment updated.".
import { MessageSquare } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '../../api/messages';
import {
  Banner,
  Button,
  EmptyState,
  ICON_STROKE_WIDTH,
  Skeleton,
  useDelayedLoading,
} from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';
import { useCurrentUser } from '../../session/useCurrentUser';
import type { Screen } from '../screens/screenTypes';

import { CommentComposer } from './CommentComposer';
import { CommentItem } from './CommentItem';
import { CommentSidePanel } from './CommentSidePanel';
import {
  EMPTY_THREAD_TEXT,
  EMPTY_THREAD_TITLE,
  LOAD_EARLIER_LABEL,
  POSTED_NOTICE,
  THREAD_LABEL,
  earlierText,
} from './commentTexts';
import { useComments } from './useComments';

/** A non-breaking space: the same notice twice in a row becomes a new value, so it is announced again. */
const NBSP = String.fromCharCode(160);

interface CommentsTabProps {
  screen: Pick<Screen, 'id' | 'author' | 'documentationStatus' | 'commentCount'>;
  onCountChange: (total: number) => void;
}

export function CommentsTab({ screen, onCountChange }: CommentsTabProps) {
  const user = useCurrentUser();
  const { reason: writeReason } = useWriteBlock();
  const thread = useComments(screen.id, screen.commentCount);
  const { showSkeleton } = useDelayedLoading(thread.status === 'loading');
  const [notice, setNotice] = useState('');
  const endRef = useRef<HTMLLIElement>(null);
  const [scrollToEnd, setScrollToEnd] = useState(0);

  useEffect(() => {
    if (thread.status === 'ready') onCountChange(thread.total);
  }, [thread.status, thread.total, onCountChange]);

  useEffect(() => {
    if (scrollToEnd > 0) endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [scrollToEnd]);

  // The same text twice in a row would not be announced again: a non-breaking space makes it a new value.
  const announce = (text: string) => {
    setNotice((previous) => (previous === text ? `${text}${NBSP}` : text));
  };

  const ready = thread.status === 'ready';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,20rem)] items-start gap-4">
      <section
        aria-label="Discussion"
        className="flex min-h-96 flex-col gap-4 rounded-card border border-border-subtle bg-surface p-5 shadow-card"
      >
        {thread.status === 'error' && (
          <Banner
            tone="danger"
            actions={
              <Button size="sm" onClick={thread.reload}>
                Try again
              </Button>
            }
          >
            {thread.error === null
              ? "The comments couldn't be loaded."
              : (getErrorMessage(thread.error, { element: 'screen' }) ?? '')}
          </Banner>
        )}
        {thread.status === 'loading' &&
          (showSkeleton ? (
            <div role="status" aria-label="Loading comments" className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null)}
        {ready && thread.earlierLeft && (
          <div className="flex flex-col items-center gap-1.5">
            <Button
              loading={thread.loadingEarlier}
              onClick={thread.loadEarlier}
              aria-describedby="comments-earlier-count"
            >
              {LOAD_EARLIER_LABEL}
            </Button>
            <span id="comments-earlier-count" className="text-small text-ink-500">
              {earlierText(thread.earlierCount)}
            </span>
            {thread.earlierFailed && (
              <p role="alert" className="text-small text-danger">
                The earlier comments couldn&apos;t be loaded. Try again.
              </p>
            )}
          </div>
        )}
        {ready && thread.items.length === 0 && (
          <EmptyState
            icon={<MessageSquare strokeWidth={ICON_STROKE_WIDTH} />}
            title={EMPTY_THREAD_TITLE}
            description={EMPTY_THREAD_TEXT}
          />
        )}
        {ready && thread.items.length > 0 && (
          <ol
            aria-label={THREAD_LABEL}
            className="relative flex flex-col gap-3.5 before:absolute before:inset-y-4 before:left-4.5 before:w-px before:bg-border-subtle"
          >
            {thread.items.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                screenAuthorId={screen.author.id}
                canEdit={user !== null && comment.author.id === user.id}
                blockedReason={writeReason}
                etag={thread.etagOf(comment)}
                onSaved={thread.replace}
                onReload={thread.reload}
                onNotice={announce}
              />
            ))}
            <li ref={endRef} aria-hidden="true" className="h-0" />
          </ol>
        )}
        <div className="mt-auto">
          <CommentComposer
            screenId={screen.id}
            onPosted={(comment, etag) => {
              thread.append(comment, etag);
              announce(POSTED_NOTICE);
              setScrollToEnd((count) => count + 1);
            }}
          />
        </div>
        <p role="status" className="sr-only">
          {notice}
        </p>
      </section>
      <CommentSidePanel
        screen={screen}
        comments={thread.items}
        total={ready ? thread.total : screen.commentCount}
        partial={ready && thread.earlierLeft}
      />
    </div>
  );
}
