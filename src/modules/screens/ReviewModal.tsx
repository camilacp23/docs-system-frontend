// ReviewModal: the Administrator's decision on a screen in review, Approve or Return (S-37c, S-37b).
// Props: screen ({ id, name }), decision ('APPROVE' | 'RETURN'), onClose, onReviewed(screen, etag) (the decision was
// applied: the detail takes the screen and its new ETag), onRefused(error) (the screen is no longer in review or no
// longer exists: the detail reads it again and shows the message).
// POST /screens/{id}/review, without If-Match (the contract declares none).
//  - Return needs a comment: the client checks it after trimming (an empty or spaces-only comment is not sent and the
//    field says why); the API stays the authority (COMMENT_REQUIRED and a 400 on `comment` also land on the field).
//    The comment is sent as typed: trimming only decides whether it has content (D-88). 4000 characters at most.
//  - Approve has an optional comment; one with only spaces is not sent. Both are posted on the screen's comments.
//  - The refusals that need the page (NOT_IN_REVIEW, NOT_FOUND) go to onRefused; any other (APPLICATION_ARCHIVED ...)
//    is shown in the modal with its catalog text. The decision is disabled with the reason when the application is
//    archived or the browser is offline (useWriteBlock).
// Focus is trapped, Esc and Cancel close it (not while sending) and the focus returns to the button that opened it.
import { Check, CornerUpLeft } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { ApiError, isApiError } from '../../api/ApiError';
import { getErrorMessage, getFieldErrors, getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { Banner, Button, FormField, ICON_STROKE_WIDTH, Modal, Textarea } from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';

import type { Screen } from './screenTypes';

const COMMENT_MAX_LENGTH = 4000;
const COMMENT_HELP_RETURN = "It is posted on the screen's comments.";
const COMMENT_HELP_APPROVE = "Posted on the screen's comments.";

interface ReviewModalProps {
  screen: { id: number; name: string };
  decision: 'APPROVE' | 'RETURN';
  onClose: () => void;
  onReviewed: (screen: Screen, etag: string | null) => void;
  onRefused: (error: ApiError) => void;
}

function commentRequiredText(): string {
  return getErrorMessage(new ApiError({ status: 422, code: 'COMMENT_REQUIRED' })) ?? '';
}

export function ReviewModal({
  screen,
  decision,
  onClose,
  onReviewed,
  onRefused,
}: ReviewModalProps) {
  const client = useApi();
  const { blocked, reason } = useWriteBlock();
  const formId = useId();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // The field is disabled while sending, so the focus goes back to it after the render that enables it again.
  const [refocus, setRefocus] = useState(0);
  useEffect(() => {
    if (refocus > 0) commentRef.current?.focus();
  }, [refocus]);
  const isReturn = decision === 'RETURN';

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (sending || blocked) return;
    const hasText = comment.trim() !== '';
    if (isReturn && !hasText) {
      setCommentError(commentRequiredText());
      commentRef.current?.focus();
      return;
    }
    setSending(true);
    setFailure(null);
    setCommentError(null);
    try {
      const result = await client.post('/screens/{id}/review', {
        path: { id: screen.id },
        body: isReturn
          ? { decision: 'RETURN', comment }
          : hasText
            ? { decision: 'APPROVE', comment }
            : { decision: 'APPROVE' },
      });
      onReviewed(result.body.data, result.etag);
    } catch (thrown) {
      setSending(false);
      if (!isApiError(thrown)) {
        setFailure(getThrownMessage(thrown));
      } else if (thrown.code === 'NOT_IN_REVIEW' || thrown.code === 'NOT_FOUND') {
        onRefused(thrown);
      } else if (thrown.code === 'COMMENT_REQUIRED') {
        setCommentError(commentRequiredText());
        setRefocus((count) => count + 1);
      } else if (thrown.code === 'VALIDATION_ERROR') {
        const onComment = getFieldErrors(thrown, { comment: 'Comment' }).find(
          (entry) => entry.field === 'comment',
        );
        if (onComment) {
          setCommentError(onComment.message);
          setRefocus((count) => count + 1);
        } else {
          setFailure(getThrownMessage(thrown));
        }
      } else {
        setFailure(getThrownMessage(thrown, { element: 'screen' }));
      }
    }
  };

  return (
    <Modal
      open
      initialFocusRef={commentRef}
      icon={
        isReturn ? (
          <CornerUpLeft size={18} strokeWidth={ICON_STROKE_WIDTH} />
        ) : (
          <Check size={18} strokeWidth={ICON_STROKE_WIDTH} />
        )
      }
      onClose={() => {
        if (!sending) onClose();
      }}
      title={isReturn ? `Return ${screen.name} to “In progress”` : `Approve ${screen.name}?`}
      description={isReturn ? 'The author will see your comment and can edit again.' : undefined}
      footer={
        <>
          <Button onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={sending}
            disabled={blocked}
          >
            {isReturn ? 'Return' : 'Approve'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void send(event)}
        className="flex flex-col gap-4"
      >
        {!isReturn && (
          <p>
            {screen.name} becomes the official reference. Editing it later returns it to In
            progress.
          </p>
        )}
        <FormField
          label={isReturn ? 'Comment for the author' : 'Comment (optional)'}
          required={isReturn}
          error={commentError ?? undefined}
          help={
            isReturn ? (
              <span className="flex justify-between gap-2">
                <span>{COMMENT_HELP_RETURN}</span>
                <span aria-hidden="true">
                  {comment.length}/{COMMENT_MAX_LENGTH}
                </span>
              </span>
            ) : (
              COMMENT_HELP_APPROVE
            )
          }
        >
          {(control) => (
            <Textarea
              {...control}
              ref={commentRef}
              rows={isReturn ? 4 : 3}
              maxLength={COMMENT_MAX_LENGTH}
              disabled={sending}
              value={comment}
              onChange={(event) => {
                setComment(event.target.value);
                if (commentError !== null && event.target.value.trim() !== '') {
                  setCommentError(null);
                }
              }}
            />
          )}
        </FormField>
        {reason && <p className="text-small text-warning-ink">{reason}</p>}
        {failure && <Banner tone="danger">{failure}</Banner>}
      </form>
    </Modal>
  );
}
