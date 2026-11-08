// useScreenStatusChange: sends a status change of a screen (PUT /screens/{id}/status, with If-Match = the ETag of
// the detail) and says what happened.
// useScreenStatusChange({ screen, etag, apply, reload, onTemplateIncomplete?, onDone? }) -> { running, problem,
//   clearProblem, run(action) }
//   running   the key of the action in flight (every action is disabled meanwhile, so two cannot overlap)
//   problem   what the page shows when the change did not happen: { kind: 'conflict' | 'message', text }, the text from
//             the catalog by `code` (never the server message)
// On success the detail takes the answer and its new ETag (`apply`, no second read), a toast tells what happened
// ("<name> submitted for review.") and `onDone` runs (the page moves the focus: the button that was pressed may be gone).
// Errors, by code:
//   PRECONDITION_FAILED (412)  conflict: S-44 with the option to reload
//   INVALID_TRANSITION         its text, and the detail is read again (the status changed meanwhile)
//   TEMPLATE_INCOMPLETE        onTemplateIncomplete(error) when given; otherwise its text
//   NOT_FOUND                  the detail is read again (the page shows "doesn't exist")
//   anything else              its catalog text (APPLICATION_ARCHIVED ...)
import { useCallback, useEffect, useRef, useState } from 'react';

import { isApiError, type ApiError } from '../../api/ApiError';
import { getErrorMessage, getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useToast } from '../../components/ui';

import type { Screen } from './screenTypes';
import { workflowToast, type WorkflowAction, type WorkflowActionKey } from './screenWorkflow';

export interface StatusProblem {
  kind: 'conflict' | 'message';
  text: string;
}

interface Options {
  screen: Pick<Screen, 'id' | 'name'>;
  etag: string | null;
  apply: (screen: Screen, etag: string | null) => void;
  reload: () => void;
  onTemplateIncomplete?: (error: ApiError) => void;
  onDone?: () => void;
}

export function useScreenStatusChange(options: Options) {
  const client = useApi();
  const toast = useToast();
  const [running, setRunning] = useState<WorkflowActionKey | null>(null);
  const [problem, setProblem] = useState<StatusProblem | null>(null);
  const latest = useRef(options);
  const busy = useRef(false);

  useEffect(() => {
    latest.current = options;
  });

  const run = useCallback(
    async (action: Extract<WorkflowAction, { kind: 'status' }>) => {
      if (busy.current) return;
      busy.current = true;
      setRunning(action.key);
      setProblem(null);
      const { screen, etag, apply, reload, onTemplateIncomplete, onDone } = latest.current;
      try {
        const result = await client.put('/screens/{id}/status', {
          path: { id: screen.id },
          body: { status: action.to },
          ifMatch: etag ?? undefined,
        });
        apply(result.body.data, result.etag);
        toast.show({ message: workflowToast(action.key, screen.name) });
        onDone?.();
      } catch (thrown) {
        if (!isApiError(thrown)) {
          setProblem({ kind: 'message', text: getThrownMessage(thrown) });
        } else if (thrown.code === 'PRECONDITION_FAILED') {
          setProblem({
            kind: 'conflict',
            text: getErrorMessage(thrown, { element: 'screen' }) ?? '',
          });
        } else if (thrown.code === 'TEMPLATE_INCOMPLETE' && onTemplateIncomplete) {
          onTemplateIncomplete(thrown);
        } else {
          setProblem({ kind: 'message', text: getThrownMessage(thrown, { element: 'screen' }) });
          if (thrown.code === 'INVALID_TRANSITION' || thrown.code === 'NOT_FOUND') reload();
        }
      } finally {
        busy.current = false;
        setRunning(null);
      }
    },
    [client, toast],
  );

  const clearProblem = useCallback(() => {
    setProblem(null);
  }, []);

  return { running, problem, clearProblem, run };
}
