// CommentComposer: the box at the foot of the thread (S-35) that writes a comment on the screen.
// Props: screenId, onPosted(comment, etag) (the 201 arrived: the thread puts it at the end and the tab counts it).
// POST /screens/{id}/comments with `text` EXACTLY as typed (no trimming, D-122); 1 to 4000 characters and not blank. A
// blank text is not sent: the box says so (BLANK_COMMENT_TEXT), and the API's `pattern` 400 lands on the same message.
// Every role can comment, in any status; only an archived application or no connection block it (useWriteBlock): the
// box and the button are disabled and the reason is read with the box. Refusals use the catalog text by `code`
// (APPLICATION_ARCHIVED, NOT_FOUND, ...). After a 201 the box is empty and keeps the focus.
import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { isApiError } from '../../api/ApiError';
import { getFieldErrors, getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { Button, ICON_STROKE_WIDTH } from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';

import { CommentEditor } from './CommentEditor';
import { isBlank } from './commentModel';
import {
  BLANK_COMMENT_TEXT,
  COMPOSER_HINT,
  COMPOSER_LABEL,
  COMPOSER_PLACEHOLDER,
} from './commentTexts';
import type { ScreenComment } from './commentTypes';

interface CommentComposerProps {
  screenId: number;
  onPosted: (comment: ScreenComment, etag: string | null) => void;
}

export function CommentComposer({ screenId, onPosted }: CommentComposerProps) {
  const client = useApi();
  const { blocked, reason } = useWriteBlock();
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // The box is disabled while sending, so the focus goes back after the render that enables it again.
  const [refocus, setRefocus] = useState(0);
  useEffect(() => {
    if (refocus > 0) boxRef.current?.focus();
  }, [refocus]);

  const send = async () => {
    if (sending || blocked) return;
    if (isBlank(text)) {
      setError(BLANK_COMMENT_TEXT);
      boxRef.current?.focus();
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await client.post('/screens/{id}/comments', {
        path: { id: screenId },
        body: { text },
      });
      setText('');
      onPosted(result.body.data, result.etag);
    } catch (thrown) {
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
        setError(getThrownMessage(thrown, { element: 'screen' }));
      }
    } finally {
      setSending(false);
      setRefocus((count) => count + 1);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <CommentEditor
        label={COMPOSER_LABEL}
        placeholder={COMPOSER_PLACEHOLDER}
        hint={COMPOSER_HINT}
        value={text}
        onChange={(next) => {
          setText(next);
          if (error !== null) setError(null);
        }}
        error={error}
        disabled={sending}
        disabledReason={reason}
        textareaRef={boxRef}
        actions={
          <Button
            type="submit"
            variant="primary"
            loading={sending}
            disabled={blocked}
            iconLeft={<Send aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
          >
            Comment
          </Button>
        }
      />
    </form>
  );
}
