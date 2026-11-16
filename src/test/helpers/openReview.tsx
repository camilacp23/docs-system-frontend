// openReview: opens the review queue (/review) over the in-memory screens API with the data of the frame S-36: three
// screens In review in the application SAR, the one waiting longest first (Reportes 4 days, Busqueda 3 days, Detalle 2 days
// at the fixed clock), each with its detail (template complete, links, to-dos, Miro) and a thread whose last comment is the
// one the panel shows. The clock is fixed with `fixReviewClock()` (only Date is faked): "now" is 2026-10-06 16:02 local time.
// Options: role, screens (replaces the screens), comments, applications, path, prepare (arms the fake before the first read).
// Returns what renderScreens returns once the queue is on screen.
import { screen } from '@testing-library/react';
import { vi, type Mock } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ScreenComment } from '../../modules/comments/commentTypes';
import type { Screen } from '../../modules/screens/screenTypes';

import { makeScreenDetail } from './fakeScreensApi';
import { CAMILA, DEV_A, makeComment } from './openComments';
import { renderScreens, sampleScreens, type RenderScreensOptions } from './renderScreens';

export const DEV_B = { id: 3, name: 'Sample Developer B' };

/** The system time of these tests: 2026-10-06 16:02 in local time. Only Date is faked (timers keep running). */
export function fixReviewClock(): void {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 6, 16, 2, 0) });
}

const FULL_TEMPLATE: Screen['template'] = {
  onStart: 'UpdateContext({locMostrarDetalle: false})',
  workingProcess: 'The user reviews the selected record.',
  architecture: 'Header container, form frmDetalle.',
  dataModel: 'Reads gRegistroSel.',
  requirements: 'Show the selected record.',
  knownIssues: 'Double save.',
  risks: 'None known.',
};

/** A screen In review with a complete template, as the queue holds them. */
export function reviewScreen(id: number, name: string, overrides: Partial<Screen> = {}): Screen {
  return makeScreenDetail(id, name, {
    documentationStatus: 'IN_REVIEW',
    author: DEV_A,
    template: { ...FULL_TEMPLATE },
    commentCount: 1,
    pendingSubtasks: 0,
    ...overrides,
  });
}

export function reviewQueueScreens(): Screen[] {
  const links = {
    variableLinks: [
      {
        id: 1,
        variable: { id: 3, name: 'gRegistroSel' },
        accessMode: 'READ' as const,
        usedIn: 'a',
        isOrigin: false,
      },
      {
        id: 2,
        variable: { id: 4, name: 'locMostrarDetalle' },
        accessMode: 'WRITE' as const,
        usedIn: 'b',
        isOrigin: true,
      },
      {
        id: 3,
        variable: { id: 4, name: 'locMostrarDetalle' },
        accessMode: 'READ' as const,
        usedIn: 'c',
        isOrigin: false,
      },
    ],
    collectionLinks: [
      {
        id: 4,
        collection: { id: 11, name: 'colClientes' },
        accessMode: 'READ' as const,
        usedIn: 'd',
      },
    ],
    components: [
      { id: 301, name: 'btnGuardar', type: 'Button', onSelect: null, description: null, uses: [] },
      { id: 302, name: 'lblNombre', type: 'Label', onSelect: null, description: null, uses: [] },
    ],
  };
  return [
    ...sampleScreens().filter((s) => s.id !== 12 && s.id !== 13 && s.id !== 14),
    reviewScreen(12, 'Detalle', {
      updatedAt: '2026-10-04T16:02:00',
      commentCount: 4,
      pendingSubtasks: 3,
      miroLink: 'https://miro.com/app/board/uXjVDetalle=/',
      ...links,
    }),
    reviewScreen(13, 'Busqueda', {
      author: DEV_B,
      updatedAt: '2026-10-03T10:00:00',
      commentCount: 2,
    }),
    reviewScreen(14, 'Reportes', { updatedAt: '2026-10-02T09:00:00', commentCount: 0 }),
  ];
}

export function reviewQueueComments(): ScreenComment[] {
  return [
    makeComment(41, { screenId: 12, text: 'Older note.', createdAt: '2026-10-03T08:00:00' }),
    makeComment(42, { screenId: 12, text: 'More notes.', createdAt: '2026-10-03T09:00:00' }),
    makeComment(43, {
      screenId: 12,
      author: CAMILA,
      reviewDecision: 'RETURN',
      text: 'Known issues should mention the double Patch.',
      createdAt: '2026-10-03T09:40:00',
    }),
    makeComment(44, {
      screenId: 12,
      text: 'Added the double-save issue to Known issues. Submitting again.',
      createdAt: '2026-10-04T16:02:00',
    }),
    makeComment(45, { screenId: 13, text: 'Busqueda first.', createdAt: '2026-10-02T10:00:00' }),
    makeComment(46, {
      screenId: 13,
      text: 'Busqueda last comment.',
      createdAt: '2026-10-02T11:00:00',
    }),
  ];
}

export interface OpenReviewOptions extends Pick<RenderScreensOptions, 'applications' | 'prepare'> {
  role?: 'ADMINISTRATOR' | 'DEVELOPER' | 'READER';
  screens?: Screen[];
  comments?: ScreenComment[];
  path?: string;
}

export async function openReview(options: OpenReviewOptions = {}) {
  fixReviewClock();
  const view = await renderScreens({
    role: options.role ?? 'ADMINISTRATOR',
    path: options.path ?? '/review',
    applications: options.applications,
    screens: options.screens ?? reviewQueueScreens(),
    comments: options.comments ?? reviewQueueComments(),
    prepare: options.prepare,
  });
  await screen.findByRole('heading', { name: 'Review', level: 1 });
  return view;
}

/**
 * Makes the next `times` reads of the queue (GET /screens sorted by updatedAt) fail with a 500, and nothing else: the
 * application card and the menu counter read the same operation, so `failNext` could be spent by them.
 */
export function failQueueReads(api: { client: unknown }, times = 1): void {
  const get = (api.client as { get: Mock }).get;
  const real = get.getMockImplementation() as (path: string, options?: unknown) => Promise<unknown>;
  let left = times;
  get.mockImplementation((path: string, options?: { query?: { sort?: string } }) => {
    if (path === '/screens' && options?.query?.sort === 'updatedAt' && left > 0) {
      left -= 1;
      return Promise.reject(new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
    }
    return real(path, options);
  });
}
