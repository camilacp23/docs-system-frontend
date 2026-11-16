// CommentItem: one entry of the thread (S-35). Two looks:
//  - an ordinary comment: the author's initials, the name, a tag only when it is true (D-143: "Screen author" when the
//    author wrote the screen), "Oct 2 · 11:05", the mark "edited" when `updatedAt` is not null, the text as written (line
//    breaks kept) and, for the author only, the action Edit;
//  - a review comment (`reviewDecision`): a distinct entry "Approved" or "Returned for changes" with the reviewer, the
//    time, the tag "Reviewer" and the mark "Can't be edited". It has no Edit action (D-56, CP-11).
// Props: comment, screenAuthorId, canEdit (the signed-in user wrote it), blockedReason (archived application or no
// connection: Edit is disabled with this reason), etag (the tag to send as If-Match, D-123), onSaved(comment, etag),
// onReload (re-read the thread, "Reload" of the conflict), onNotice(text) (an announcement for screen readers).
// Editing happens in line: PUT /comments/{id} with the text as typed and If-Match. The same text sends nothing and just
// closes the editor. Refusals by `code`: 412 shows the S-44 banner (Reload / Keep my changes visible); REVIEW_COMMENT_LOCKED,
// APPLICATION_ARCHIVED, FORBIDDEN (AUTHOR_ONLY), NOT_FOUND and the rest show their catalog text under the box.
import { Check, Lock, Pencil, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { isApiError } from '../../api/ApiError';
import { getErrorMessage, getFieldErrors, getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { Avatar, Banner, Button, cx, ICON_STROKE_WIDTH, Tag } from '../../components/ui';

import { CommentEditor } from './CommentEditor';
import { authorTag, formatCommentTime, isBlank } from './commentModel';
import {
  BLANK_COMMENT_TEXT,
  CONFLICT_EXTRA,
  DECISION_TITLE,
  EDITED_LABEL,
  EDIT_LABEL,
  LOCKED_LABEL,
  UPDATED_NOTICE,
} from './commentTexts';
import type { ScreenComment } from './commentTypes';

interface CommentItemProps {
  comment: ScreenComment;
  screenAuthorId: number;
  canEdit: boolean;
  blockedReason: string | null;
  etag: string;
  onSaved: (comment: ScreenComment, etag: string | null) => void;
  onReload: () => void;
  onNotice: (text: string) => void;
}

const ICON = { size: 16, strokeWidth: ICON_STROKE_WIDTH, 'aria-hidden': true } as const;

function ReviewEntry({ comment }: { comment: ScreenComment }) {
  const decision = comment.reviewDecision ?? 'RETURN';
  const returned = decision === 'RETURN';
  return (
    <li className="relative flex gap-3">
      <span
        aria-hidden="true"
        className={cx(
          'z-10 flex size-9 shrink-0 items-center justify-center rounded-pill border',
          returned
            ? 'border-warning-border bg-warning-bg text-warning-ink'
            : 'border-success-border bg-success-bg text-success-ink',
        )}
      >
        {returned ? <RotateCcw {...ICON} /> : <Check {...ICON} />}
      </span>
      <article
        className={cx(
          'min-w-0 flex-1 rounded-control border px-3.5 py-2.5',
          returned ? 'border-warning-border bg-warning-bg' : 'border-success-border bg-success-bg',
        )}
      >
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label">
          <strong className="text-body-lg font-semibold text-ink-900">
            {DECISION_TITLE[decision]}
          </strong>
          <span className="text-ink-700">
            {comment.author.name} · {formatCommentTime(comment.createdAt)}
          </span>
          <Tag>Reviewer</Tag>
          <span className="ml-auto inline-flex items-center gap-1 text-small text-ink-700">
            <Lock {...ICON} size={14} />
            {LOCKED_LABEL}
          </span>
        </header>
        <p className="mt-1 text-body-lg break-words whitespace-pre-wrap text-ink-900">
          {comment.text}
        </p>
      </article>
    </li>
  );
}

export function CommentItem(props: CommentItemProps) {
  const { comment } = props;
  return comment.reviewDecision === null ? (
    <OrdinaryEntry {...props} />
  ) : (
    <ReviewEntry comment={comment} />
  );
}

function OrdinaryEntry({
  comment,
  screenAuthorId,
  canEdit,
  blockedReason,
  etag,
  onSaved,
  onReload,
  onNotice,
}: CommentItemProps) {
  const client = useApi();
  const tag = authorTag(comment, screenAuthorId);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [conflictHidden, setConflictHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refocus, setRefocus] = useState(0);
  const [backToButton, setBackToButton] = useState(0);

  useEffect(() => {
    if (refocus > 0) boxRef.current?.focus();
  }, [refocus]);
  useEffect(() => {
    if (backToButton > 0) editButtonRef.current?.focus();
  }, [backToButton]);

  const open = () => {
    setDraft(comment.text);
    setError(null);
    setConflict(null);
    setConflictHidden(false);
    setEditing(true);
    setRefocus((count) => count + 1);
  };

  const close = () => {
    setEditing(false);
    setBackToButton((count) => count + 1);
  };

  const save = async () => {
    if (saving || blockedReason !== null || conflict !== null) return;
    if (isBlank(draft)) {
      setError(BLANK_COMMENT_TEXT);
      boxRef.current?.focus();
      return;
    }
    if (draft === comment.text) {
      // The same text changes nothing: no request, no new "edited" mark.
      close();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await client.put('/comments/{id}', {
        path: { id: comment.id },
        body: { text: draft },
        ifMatch: etag,
      });
      onSaved(result.body.data, result.etag);
      onNotice(UPDATED_NOTICE);
      setSaving(false);
      close();
    } catch (thrown) {
      setSaving(false);
      if (isApiError(thrown) && thrown.code === 'PRECONDITION_FAILED') {
        setConflict(getErrorMessage(thrown, { element: 'comment' }) ?? '');
        setConflictHidden(false);
        return;
      }
      if (isApiError(thrown) && thrown.code === 'VALIDATION_ERROR') {
        const onText = getFieldErrors(thrown, { text: 'Comment' }).find(
          (entry) => entry.field === 'text',
        );
        setError(
          onText === undefined
            ? getThrownMessage(thrown)
            : onText.rule === 'pattern' || onText.rule === 'minLength'
              ? BLANK_COMMENT_TEXT
              : onText.message,
        );
      } else {
        setError(getThrownMessage(thrown, { element: 'comment' }));
      }
      setRefocus((count) => count + 1);
    }
  };

  const reloadTheirVersion = () => {
    setConflict(null);
    setEditing(false);
    onReload();
  };

  return (
    <li className="relative flex gap-3">
      <Avatar name={comment.author.name} decorative className="z-10" />
      <article className="min-w-0 flex-1 overflow-hidden rounded-control border border-border-subtle bg-surface">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border-subtle bg-search-bg px-3.5 py-2 text-label">
          <strong className="text-body-lg font-semibold text-ink-900">{comment.author.name}</strong>
          {tag !== null && <Tag>{tag}</Tag>}
          <span className="text-ink-500">
            {formatCommentTime(comment.createdAt)}
            {comment.updatedAt !== null && ` · ${EDITED_LABEL}`}
          </span>
          {canEdit && !editing && (
            <Button
              ref={editButtonRef}
              size="sm"
              variant="ghost"
              className="ml-auto"
              disabled={blockedReason !== null}
              title={blockedReason ?? undefined}
              aria-label={`Edit comment from ${formatCommentTime(comment.createdAt)}`}
              onClick={open}
            >
              <Pencil {...ICON} size={14} />
              Edit
            </Button>
          )}
        </header>
        <div className="px-3.5 py-2.5">
          {editing ? (
            <div className="flex flex-col gap-2.5">
              {conflict !== null && !conflictHidden && (
                <Banner
                  tone="warning"
                  actions={
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          setConflictHidden(true);
                        }}
                      >
                        Keep my changes visible
                      </Button>
                      <Button size="sm" variant="primary" onClick={reloadTheirVersion}>
                        Reload
                      </Button>
                    </>
                  }
                >
                  {conflict} {CONFLICT_EXTRA}
                </Banner>
              )}
              <CommentEditor
                label={EDIT_LABEL}
                value={draft}
                onChange={(next) => {
                  setDraft(next);
                  if (error !== null) setError(null);
                }}
                error={conflict !== null && conflictHidden ? conflict : error}
                disabled={saving}
                disabledReason={blockedReason}
                textareaRef={boxRef}
                actions={
                  <>
                    <Button onClick={close} disabled={saving} size="sm">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={saving}
                      disabled={blockedReason !== null || conflict !== null}
                      onClick={() => {
                        void save();
                      }}
                    >
                      Save
                    </Button>
                  </>
                }
              />
            </div>
          ) : (
            <p className="text-body-lg break-words whitespace-pre-wrap text-ink-900">
              {comment.text}
            </p>
          )}
        </div>
      </article>
    </li>
  );
}
