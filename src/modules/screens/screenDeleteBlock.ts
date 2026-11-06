// screenDeleteBlock: why Delete is disabled for a screen right now, if it is (SDD Table 56: the interface disables,
// with the reason, what the role may do but the state prevents).
// deleteBlockReason(screen, writeReason) -> the text to show, or null when the action is available.
//   writeReason  the reason of useWriteBlock (archived application or offline), the first the server would give
//   App (OnStart)  the text of APP_CONTEXT_PROTECTED (it can't be deleted)
//   In review      the text of SCREEN_IN_REVIEW
// The order is the one of the API (APPLICATION_ARCHIVED, APP_CONTEXT_PROTECTED, SCREEN_IN_REVIEW, D-82). This is
// usability only: the API stays the authority and its refusal is shown if the state changed meanwhile. The texts
// are the catalog's, not new ones.
import { ApiError } from '../../api/ApiError';
import { getErrorMessage } from '../../api/messages';

import type { ApiDocumentationStatus } from './screenTypes';

function catalogText(code: string): string {
  return getErrorMessage(new ApiError({ status: 422, code })) ?? '';
}

export function deleteBlockReason(
  screen: { isAppContext: boolean; documentationStatus: ApiDocumentationStatus },
  writeReason: string | null,
): string | null {
  if (writeReason !== null) return writeReason;
  if (screen.isAppContext) return catalogText('APP_CONTEXT_PROTECTED');
  if (screen.documentationStatus === 'IN_REVIEW') return catalogText('SCREEN_IN_REVIEW');
  return null;
}
