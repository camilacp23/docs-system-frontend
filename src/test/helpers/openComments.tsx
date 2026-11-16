// openComments: opens the Comments tab of Detalle (screen 12) over the in-memory screens API, with the thread of the frame
// S-35 (sampleComments) or the one a test gives. The signed-in user is Ana Mora (id 7), whose own comments are the ones
// she can edit. Returns what renderScreens returns once the thread is on screen.
import { screen } from '@testing-library/react';

import type { Role } from '../../app/router/routes';
import type { ScreenComment } from '../../modules/comments/commentTypes';
import type { Screen } from '../../modules/screens/screenTypes';

import { makeApplication } from './renderApp';
import { renderScreens, sampleScreens, type RenderScreensOptions } from './renderScreens';

export const DEV_A = { id: 2, name: 'Sample Developer A' };
export const CAMILA = { id: 1, name: 'Camila Castillo' };
export const READER = { id: 5, name: 'Sample Reader' };
export const ANA = { id: 7, name: 'Ana Mora' };

export function makeComment(id: number, overrides: Partial<ScreenComment> = {}): ScreenComment {
  return {
    id,
    screenId: 12,
    author: DEV_A,
    text: `Comment ${id}`,
    reviewDecision: null,
    createdAt: `2026-10-04T10:${String(id % 60).padStart(2, '0')}:00`,
    updatedAt: null,
    ...overrides,
  };
}

/** The thread of S-35: an edited comment, a returned review, a reply and a question from the Reader. */
export function sampleComments(): ScreenComment[] {
  return [
    makeComment(31, {
      text: 'Template ready except Risks; adding them tomorrow.',
      createdAt: '2026-10-02T11:05:00',
      updatedAt: '2026-10-02T11:20:00',
    }),
    makeComment(32, {
      author: CAMILA,
      text: 'Known issues should mention the double Patch when saving twice.',
      reviewDecision: 'RETURN',
      createdAt: '2026-10-03T09:40:00',
    }),
    makeComment(33, {
      text: 'Added the double-save issue to Known issues. Submitting again.',
      createdAt: '2026-10-04T16:02:00',
    }),
    makeComment(34, {
      author: READER,
      text: 'Is btnGuardar also used in the mobile layout?',
      createdAt: '2026-10-04T17:15:00',
    }),
  ];
}

export interface OpenCommentsOptions {
  role?: Role;
  comments?: ScreenComment[];
  /** The `commentCount` the detail carries (default: the number of comments). */
  commentCount?: number;
  status?: Screen['documentationStatus'];
  archived?: boolean;
  prepare?: RenderScreensOptions['prepare'];
}

export async function openComments(options: OpenCommentsOptions = {}) {
  const comments = options.comments ?? sampleComments();
  const view = await renderScreens({
    role: options.role ?? 'DEVELOPER',
    path: '/screens/12?tab=comments',
    comments,
    prepare: options.prepare,
    applications: options.archived
      ? [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })]
      : undefined,
    screens: sampleScreens().map((s) =>
      s.id === 12
        ? {
            ...s,
            commentCount: options.commentCount ?? comments.length,
            documentationStatus: options.status ?? 'IN_REVIEW',
          }
        : s,
    ),
  });
  await screen.findByRole('heading', { name: 'Detalle', level: 1 });
  await screen.findByRole('tab', { name: /Comments/, selected: true });
  return view;
}
