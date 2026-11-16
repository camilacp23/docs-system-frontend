// ReviewPage: /review (S-36, S-37), the review queue. Loaded when the route is opened (lazyPage). The Administrator and the
// Developer reach it from the menu; the Reader has no Review item and the route shows No access (S-41b).
// Master and detail as in the frame (D-142): "Waiting" lists the screens In review of the selected application, the one
// waiting longest first (GET /screens, documentationStatus IN_REVIEW, sort updatedAt), 20 per page with "Load more"; the
// panel on the right shows "What to check" about the selected one (ReviewPanel). The first row is selected at the start.
//  - The Administrator decides from the panel: "Return for changes" (S-37b) and "Approve" (S-37c) open ReviewModal, the same
//    modal of the screen detail (comment required to return, optional to approve, 400 / COMMENT_REQUIRED on the field). After
//    a decision the row leaves the queue at once, the next screen is selected, a toast says what happened ("<name>
//    approved.", "<name> returned to In progress.") and the focus goes to the panel (or to the title when the queue is
//    empty). The menu counter is read again by the modal.
//  - NOT_IN_REVIEW (someone decided first) and NOT_FOUND show their catalog text in a banner and read the queue again;
//    APPLICATION_ARCHIVED (shown in the modal) also reads it again.
//  - The Developer sees the same queue and panel read only, with a note instead of the decisions (D-145, Table 56).
//  - The decisions are disabled with the reason when the application is archived or there is no connection (useWriteBlock).
// The queue is read again, with no polling, when the browser tab becomes visible again. Changing the application starts the
// page over. Loading shows a skeleton after 300 ms; a failed first read shows the server-error state with a retry; a failed
// re-read keeps the list and says so.
import { ClipboardCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '../../api/messages';
import { useApplication } from '../../application/useApplication';
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHeader,
  Skeleton,
  useDelayedLoading,
  useToast,
} from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';
import { useCurrentUser } from '../../session/useCurrentUser';
import { ReviewModal } from '../screens/ReviewModal';
import { workflowToast } from '../screens/screenWorkflow';

import { ReviewPanel } from './ReviewPanel';
import { ReviewQueueList } from './ReviewQueueList';
import { nextSelection } from './reviewModel';
import {
  EMPTY_QUEUE_TEXT,
  EMPTY_QUEUE_TITLE,
  queueSubtitle,
  REVIEW_TITLE,
  WAITING_TITLE,
} from './reviewTexts';
import { useReviewQueue } from './useReviewQueue';

const CLOCK_TICK_MS = 60_000;

/** Changing the application starts the queue over. */
export function ReviewPage() {
  const { currentApplicationId } = useApplication();
  return (
    <ReviewQueuePage key={currentApplicationId ?? 'none'} applicationId={currentApplicationId} />
  );
}

function ReviewQueuePage({ applicationId }: { applicationId: number | null }) {
  const toast = useToast();
  const user = useCurrentUser();
  const canDecide = user?.role === 'ADMINISTRATOR';
  const { reason: writeReason } = useWriteBlock();
  const queue = useReviewQueue(applicationId);
  const { refresh } = queue;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deciding, setDeciding] = useState<'APPROVE' | 'RETURN' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const titleRef = useRef<HTMLHeadingElement>(null);
  const panelTitleRef = useRef<HTMLHeadingElement>(null);
  const [focusAfterDecision, setFocusAfterDecision] = useState(0);
  const rowsCount = useRef(0);
  const { showSkeleton } = useDelayedLoading(queue.status === 'loading' && queue.rows.length === 0);

  useEffect(() => {
    rowsCount.current = queue.rows.length;
  });
  useEffect(() => {
    // The relative times ("2 days ago") are measured against a clock that moves on; this is not a read of the API.
    const timer = setInterval(() => {
      setNow(Date.now());
    }, CLOCK_TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    // Someone else may have decided while the tab was hidden: read the queue again when it is visible.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);
  useEffect(() => {
    if (focusAfterDecision === 0) return;
    // The button that was pressed is gone with its row: the focus goes to what replaced it.
    (rowsCount.current > 0 ? panelTitleRef : titleRef).current?.focus();
  }, [focusAfterDecision]);

  const selected = queue.rows.find((row) => row.id === selectedId) ?? queue.rows[0] ?? null;

  if (queue.status === 'error' && queue.rows.length === 0) {
    return (
      <ErrorState
        variant="server-error"
        requestId={queue.error?.requestId ?? undefined}
        className="flex-1"
        onAction={refresh}
      />
    );
  }

  const loadingFirst = queue.status === 'loading' && queue.rows.length === 0;

  return (
    <>
      <PageHeader
        icon={<ClipboardCheck size={20} strokeWidth={ICON_STROKE_WIDTH} />}
        title={REVIEW_TITLE}
        titleRef={titleRef}
        description={loadingFirst ? ' ' : queueSubtitle(queue.total)}
      />

      {problem !== null && (
        <Banner
          tone="danger"
          onDismiss={() => {
            setProblem(null);
          }}
        >
          {problem}
        </Banner>
      )}
      {queue.status === 'error' && queue.rows.length > 0 && (
        <Banner
          tone="warning"
          actions={
            <Button size="sm" onClick={refresh}>
              Try again
            </Button>
          }
        >
          The queue couldn&apos;t be refreshed. You are seeing the last copy.
        </Banner>
      )}

      {loadingFirst ? (
        showSkeleton ? (
          <div role="status" aria-label="Loading the queue" className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null
      ) : selected === null ? (
        <section
          aria-label={WAITING_TITLE}
          className="rounded-card border border-border-subtle bg-surface shadow-card"
        >
          <EmptyState
            icon={<ClipboardCheck strokeWidth={ICON_STROKE_WIDTH} />}
            title={EMPTY_QUEUE_TITLE}
            description={EMPTY_QUEUE_TEXT}
          />
        </section>
      ) : (
        <div className="grid flex-1 grid-cols-[minmax(0,22rem)_minmax(0,1fr)] items-stretch gap-4">
          <section
            aria-labelledby="review-waiting-title"
            className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card"
          >
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 id="review-waiting-title" className="text-card-title font-bold text-ink-900">
                {WAITING_TITLE}
              </h2>
              <span className="rounded-pill bg-badge-warning-bg px-2 text-tag font-bold text-badge-warning-ink">
                {queue.total}
              </span>
            </header>
            <ReviewQueueList
              rows={queue.rows}
              total={queue.total}
              selectedId={selected.id}
              onSelect={setSelectedId}
              hasMore={queue.hasMore}
              loadingMore={queue.loadingMore}
              moreFailed={queue.moreFailed}
              onLoadMore={queue.loadMore}
              now={now}
            />
          </section>
          <ReviewPanel
            key={selected.id}
            row={selected}
            canDecide={canDecide}
            writeReason={writeReason}
            headingRef={panelTitleRef}
            now={now}
            onDecide={(decision) => {
              setProblem(null);
              setDeciding(decision);
            }}
          />
        </div>
      )}

      {deciding !== null && selected !== null && (
        <ReviewModal
          screen={selected}
          decision={deciding}
          onClose={() => {
            setDeciding(null);
          }}
          onReviewed={() => {
            const ids = queue.rows.map((row) => row.id);
            setSelectedId(nextSelection(ids, selected.id));
            queue.remove(selected.id);
            toast.show({
              message: workflowToast(deciding === 'APPROVE' ? 'approve' : 'return', selected.name),
            });
            setDeciding(null);
            setFocusAfterDecision((count) => count + 1);
          }}
          onRefused={(error) => {
            setDeciding(null);
            setProblem(getErrorMessage(error, { element: 'screen' }) ?? '');
            refresh();
          }}
          onFailure={(error) => {
            if (error.code === 'APPLICATION_ARCHIVED') refresh();
          }}
        />
      )}
    </>
  );
}
