// ReviewPanel: the right card of S-36, "What to check" about the selected screen, with the decision.
// Props: row (the queue row: id, name, author, updatedAt, commentCount), canDecide (the Administrator), writeReason (why
// writing is blocked now: archived application or no connection; null when it is not), onDecide('APPROVE' | 'RETURN'),
// headingRef (the focus goes to the title after a decision), now.
// It reads the screen (GET /screens/{id}, useScreen) and, in parallel, the last comment of its thread with one tiny read
// (page = the comment count, pageSize 1; if the total says another comment arrived, the new last one is read). From the
// detail it computes: whether the template is complete (n of 7), the links, the pending Subtasks, the Miro link and the
// seven fields with a check or an empty circle (reviewSummary). Nothing is shown that the API does not give.
// The decisions ("Return for changes", needs a comment, and "Approve") are in the hero of the page (ReviewPage), disabled with
// the reason when writing is blocked; the footer of this card carries the note: the reason (read with the buttons), what returning
// needs, or, for the Developer, "Only an Administrator can approve or return a screen." (D-145). "Open screen" goes to the
// detail of the screen.
import {
  Check,
  CircleDashed,
  Clock,
  Eye,
  ExternalLink,
  Link2,
  ListTodo,
  Monitor,
  SquareCheck,
} from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { useNavigate } from 'react-router';

import { getErrorMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import {
  Banner,
  Button,
  cx,
  ICON_STROKE_WIDTH,
  Skeleton,
  useDelayedLoading,
} from '../../components/ui';
import type { ScreenComment } from '../comments/commentTypes';
import type { ScreenSummary } from '../screens/screenTypes';
import { useScreen } from '../screens/useScreen';
import { formatTimestamp } from '../variables/variableLabels';

import { relativeTime, reviewSummary } from './reviewModel';
import {
  LAST_COMMENT_TITLE,
  NO_COMMENTS_TEXT,
  OPEN_SCREEN_LABEL,
  READ_ONLY_NOTE,
  RETURN_NOTE,
  TEMPLATE_FIELDS_TITLE,
  WHAT_TO_CHECK,
  WRITE_REASON_ID,
} from './reviewTexts';

interface ReviewPanelProps {
  row: Pick<ScreenSummary, 'id' | 'name' | 'author' | 'updatedAt' | 'commentCount'>;
  canDecide: boolean;
  writeReason: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  now: number;
}

const ICON = { size: 18, strokeWidth: ICON_STROKE_WIDTH, 'aria-hidden': true } as const;

type CheckTone = 'screen' | 'jira' | 'variable' | 'success' | 'warning';

/** Written out so Tailwind finds the classes: the tile of each check has the color of what it is about. */
const CHECK_TILE: Record<CheckTone, string> = {
  screen: 'bg-screen-soft text-screen-ink',
  jira: 'bg-jira-soft text-jira-ink',
  variable: 'bg-variable-soft text-variable-ink',
  success: 'bg-success-bg text-success-ink',
  warning: 'bg-warning-bg text-warning-ink',
};

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="flex items-center gap-2 text-micro font-bold tracking-wider text-variable-ink uppercase before:h-3.5 before:w-1 before:rounded-pill before:bg-variable before:content-['']"
    >
      {children}
    </h3>
  );
}

function CheckCard({
  icon,
  title,
  text,
  tone,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  tone: CheckTone;
}) {
  return (
    <li className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface px-3.5 py-3 shadow-button">
      <span
        aria-hidden="true"
        className={cx(
          'flex size-9 shrink-0 items-center justify-center rounded-control',
          CHECK_TILE[tone],
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <strong className="text-body-lg font-semibold text-ink-900">{title}</strong>
        <span className="text-small text-ink-500">{text}</span>
      </span>
    </li>
  );
}

/** The last comment of a thread with `count` comments, in one read (page = count, pageSize 1). */
function useLastComment(screenId: number, count: number) {
  const client = useApi();
  return useApiResource<ScreenComment | null>(
    `review-last:${screenId}:${count}`,
    async (signal) => {
      if (count < 1) return { body: null, etag: null };
      const read = (page: number) =>
        client.get('/screens/{id}/comments', {
          path: { id: screenId },
          query: { page, pageSize: 1 },
          signal,
        });
      let answer = await read(count);
      // Someone commented after the queue was read: the newest one is the last of the new total.
      if (answer.body.total !== count && answer.body.total > 0)
        answer = await read(answer.body.total);
      return { body: answer.body.data[0] ?? null, etag: null };
    },
  );
}

export function ReviewPanel({ row, canDecide, writeReason, headingRef, now }: ReviewPanelProps) {
  const navigate = useNavigate();
  const detail = useScreen(row.id);
  const last = useLastComment(row.id, row.commentCount);
  const loaded = detail.status === 'ready' ? detail.data : null;
  const { showSkeleton } = useDelayedLoading(detail.status === 'loading' && loaded === null);
  const summary = loaded === null ? null : reviewSummary(loaded);
  const blocked = writeReason !== null;
  const reasonId = WRITE_REASON_ID;

  return (
    <section
      aria-labelledby="review-panel-title"
      className="flex min-h-0 flex-col overflow-hidden rounded-modal border border-review-border bg-surface shadow-card"
    >
      <header className="flex items-center gap-3.5 border-b border-review-border/60 bg-linear-to-r from-review-soft to-surface px-5 py-4">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-card bg-(image:--gradient-review-blue) text-on-primary shadow-nav-tile"
        >
          <Monitor {...ICON} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="review-panel-title"
            ref={headingRef}
            tabIndex={-1}
            className="truncate font-mono text-body-lg font-bold text-ink-900 focus:outline-none"
          >
            {row.name}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-500">
            <span>Author: {row.author.name}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 rounded-pill bg-review-soft px-2 py-0.5 font-semibold text-review-ink">
              <Clock aria-hidden="true" size={12} strokeWidth={ICON_STROKE_WIDTH} />
              <span>
                In review since{' '}
                <time dateTime={row.updatedAt} title={formatTimestamp(row.updatedAt)}>
                  {relativeTime(row.updatedAt, now)}
                </time>
              </span>
            </span>
          </p>
        </div>
        <Button
          iconLeft={<Eye aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
          onClick={() => {
            void navigate(`/screens/${row.id}`);
          }}
        >
          {OPEN_SCREEN_LABEL}
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-5 px-5 py-4">
        {detail.status === 'error' && (
          <Banner
            tone="danger"
            actions={
              <Button size="sm" onClick={detail.reload}>
                Try again
              </Button>
            }
          >
            {detail.error === null
              ? ''
              : (getErrorMessage(detail.error, { element: 'screen' }) ?? '')}
          </Banner>
        )}
        {loaded === null && detail.status !== 'error' && showSkeleton && (
          <div role="status" aria-label="Loading the screen" className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {summary !== null && (
          <>
            <section aria-labelledby="review-check-title" className="flex flex-col gap-2.5">
              <SectionTitle id="review-check-title">{WHAT_TO_CHECK}</SectionTitle>
              <ul className="grid grid-cols-2 gap-3">
                <CheckCard
                  icon={<SquareCheck {...ICON} />}
                  tone={summary.template.complete ? 'success' : 'warning'}
                  title={summary.template.complete ? 'Template complete' : 'Template incomplete'}
                  text={`${summary.template.done} of ${summary.template.total} fields`}
                />
                <CheckCard
                  icon={<Link2 {...ICON} />}
                  tone="screen"
                  title="Links"
                  text={summary.links}
                />
                <CheckCard
                  icon={<ListTodo {...ICON} />}
                  tone="jira"
                  title="Future to do"
                  text={summary.todo}
                />
                <CheckCard
                  icon={<ExternalLink {...ICON} />}
                  tone="variable"
                  title="Miro diagram"
                  text={summary.miro}
                />
              </ul>
            </section>
            <section aria-labelledby="review-fields-title" className="flex flex-col gap-2.5">
              <SectionTitle id="review-fields-title">{TEMPLATE_FIELDS_TITLE}</SectionTitle>
              <div aria-hidden="true" className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-border-subtle">
                  <div
                    className={cx(
                      'h-full rounded-pill',
                      summary.template.complete ? 'bg-success' : 'bg-variable',
                    )}
                    style={{ width: `${(summary.template.done / summary.template.total) * 100}%` }}
                  />
                </div>
                <span className="text-small font-semibold text-ink-500">
                  {summary.template.done} of {summary.template.total}
                </span>
              </div>
              <ul className="grid grid-cols-4 gap-2">
                {summary.fields.map((field) => (
                  <li
                    key={field.key}
                    className={cx(
                      'flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 text-label font-medium',
                      field.done ? 'bg-success-bg text-success-ink' : 'bg-disabled-bg text-ink-700',
                    )}
                  >
                    {field.done ? (
                      <Check aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
                    ) : (
                      <CircleDashed aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
                    )}
                    {field.label}
                    <span className="sr-only">{field.done ? ': has content' : ': empty'}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
        <section aria-labelledby="review-last-title" className="flex flex-col gap-2.5">
          <SectionTitle id="review-last-title">{LAST_COMMENT_TITLE}</SectionTitle>
          {last.status === 'error' ? (
            <p className="text-small text-danger">The last comment couldn&apos;t be loaded.</p>
          ) : last.data === null ? (
            last.status === 'ready' && (
              <p className="text-body-lg text-ink-500">{NO_COMMENTS_TEXT}</p>
            )
          ) : (
            <figure className="flex gap-3 rounded-card border border-l-3 border-variable-border border-l-variable bg-variable-soft/50 px-3.5 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <blockquote className="line-clamp-4 text-body-lg break-words whitespace-pre-wrap text-ink-900">
                  {last.data.text}
                </blockquote>
                <figcaption className="text-small text-ink-500">
                  — {last.data.author.name}
                </figcaption>
              </div>
            </figure>
          )}
        </section>
      </div>

      <footer className="flex items-center gap-4 border-t border-review-border/60 bg-review-soft/40 px-5 py-3.5">
        <p
          id={reasonId}
          className={cx('text-small', blocked && canDecide ? 'text-warning-ink' : 'text-ink-500')}
        >
          {!canDecide ? READ_ONLY_NOTE : blocked ? writeReason : RETURN_NOTE}
        </p>
      </footer>
    </section>
  );
}
