// reportProblem: what the reports page tells the user when a call on a report did not work, and whether the list must be
// read again. reportProblem(thrown) -> { kind, text, reload }.
//   kind 'conflict'  PRECONDITION_FAILED (412, the S-44 pattern): someone else changed the report; the page offers "Reload".
//   kind 'message'   any other error, with its text from the catalog (src/api/messages.ts), never the server text.
//   reload           true for 412, 409 REPORT_NOT_READY and 404: what the page shows is out of date, so the list is read
//                    again and the switch takes the value the server holds.
import { isApiError } from '../../api/ApiError';
import { getThrownMessage } from '../../api/messages';

export interface ReportProblem {
  kind: 'conflict' | 'message';
  text: string;
  reload: boolean;
}

const RELOAD_CODES: readonly string[] = ['PRECONDITION_FAILED', 'REPORT_NOT_READY', 'NOT_FOUND'];

export function reportProblem(thrown: unknown): ReportProblem {
  const code = isApiError(thrown) ? thrown.code : null;
  return {
    kind: code === 'PRECONDITION_FAILED' ? 'conflict' : 'message',
    text: getThrownMessage(thrown, { element: 'report' }),
    reload: code !== null && RELOAD_CODES.includes(code),
  };
}
