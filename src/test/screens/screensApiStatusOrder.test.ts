// Order of the checks of PUT /screens/{id}/status and POST /screens/{id}/review in the in-memory screens API
// (fakeScreensApi, fakeScreenStatus). It must answer in the order of the real server (contract 0.3.5, D-88):
//   status  400 -> 404 -> 422 APPLICATION_ARCHIVED -> 412 -> 422 INVALID_TRANSITION -> 422 TEMPLATE_INCOMPLETE
//   review  400 -> 404 -> 422 APPLICATION_ARCHIVED -> 422 NOT_IN_REVIEW -> 422 COMMENT_REQUIRED
// The page tests rely on it: a fake that checked in another order would let a test pass for a reason the server
// never produces.
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { Screen } from '../../modules/screens/screenTypes';
import { makeScreensApi } from '../helpers/fakeScreensApi';
import { STATUS_TRANSITIONS } from '../helpers/fakeScreenStatus';
import { makeApplication, makeApplicationsClient } from '../helpers/renderApp';
import { sampleScreens } from '../helpers/renderScreens';

type Fake = ReturnType<typeof makeScreensApi>;
type Status = Screen['documentationStatus'];

const FULL_TEMPLATE: Screen['template'] = {
  onStart: 'a',
  workingProcess: 'b',
  architecture: 'c',
  dataModel: 'd',
  requirements: 'e',
  knownIssues: 'f',
  risks: 'g',
};

/** Detalle (12) is the screen under test; `status` and `template` are set per case. */
function api(status: Status, options: { archived?: boolean; template?: Screen['template'] } = {}) {
  const apps = makeApplicationsClient([
    makeApplication(1, { name: 'SAR', status: options.archived ? 'ARCHIVED' : 'ACTIVE' }),
  ]);
  return makeScreensApi(apps, {
    screenDetails: sampleScreens().map((s) =>
      s.id === 12
        ? { ...s, documentationStatus: status, template: options.template ?? FULL_TEMPLATE }
        : s,
    ),
  });
}

async function failure(attempt: Promise<unknown>): Promise<ApiError | null> {
  try {
    await attempt;
  } catch (thrown) {
    if (thrown instanceof ApiError) return thrown;
    throw thrown;
  }
  return null;
}

const put = (fake: Fake, body: unknown, id = 12, ifMatch?: string) =>
  fake.client.put('/screens/{id}/status', { path: { id }, body, ifMatch } as never);
const post = (fake: Fake, body: unknown, id = 12) =>
  fake.client.post('/screens/{id}/review', { path: { id }, body } as never);

describe('PUT /screens/{id}/status in the fake API', () => {
  it('checks 400 before 404 (APPROVED is not a valid body)', async () => {
    const error = await failure(put(api('DRAFT'), { status: 'APPROVED' }, 99));
    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it('checks 404 before APPLICATION_ARCHIVED', async () => {
    const error = await failure(put(api('DRAFT', { archived: true }), { status: 'DRAFT' }, 99));
    expect(error?.code).toBe('NOT_FOUND');
  });

  it('checks APPLICATION_ARCHIVED before 412', async () => {
    const fake = api('DRAFT', { archived: true });
    const error = await failure(put(fake, { status: 'IN_PROGRESS' }, 12, 'W/"stale"'));
    expect(error?.code).toBe('APPLICATION_ARCHIVED');
  });

  it('checks 412 before INVALID_TRANSITION and tells the current ETag', async () => {
    const fake = api('DRAFT');
    const error = await failure(put(fake, { status: 'IN_REVIEW' }, 12, 'W/"stale"'));
    expect(error?.code).toBe('PRECONDITION_FAILED');
    expect(error?.details).toMatchObject({ currentETag: fake.etagOf(12) });
  });

  it('checks INVALID_TRANSITION before TEMPLATE_INCOMPLETE', async () => {
    // DRAFT -> IN_REVIEW is not allowed, and the template is empty: the transition is judged first.
    const fake = api('DRAFT', { template: { ...FULL_TEMPLATE, risks: null } });
    const error = await failure(put(fake, { status: 'IN_REVIEW' }));
    expect(error?.code).toBe('INVALID_TRANSITION');
    expect(error?.details).toEqual({ from: 'DRAFT', to: 'IN_REVIEW' });
  });

  it('answers INVALID_TRANSITION for the status the screen already has', async () => {
    const error = await failure(put(api('DRAFT'), { status: 'DRAFT' }));
    expect(error?.code).toBe('INVALID_TRANSITION');
    expect(error?.details).toEqual({ from: 'DRAFT', to: 'DRAFT' });
  });

  it('answers TEMPLATE_INCOMPLETE last, with the missing fields in template order', async () => {
    const fake = api('IN_PROGRESS', {
      template: { ...FULL_TEMPLATE, requirements: null, onStart: '  ', risks: null },
    });
    const error = await failure(put(fake, { status: 'IN_REVIEW' }));
    expect(error?.code).toBe('TEMPLATE_INCOMPLETE');
    expect(error?.details).toEqual({ fields: ['onStart', 'requirements', 'risks'] });
  });

  it('allows exactly the transitions of Table 61', async () => {
    const all: Status[] = ['UNDOCUMENTED', 'DRAFT', 'IN_PROGRESS', 'IN_REVIEW'];
    for (const from of ['UNDOCUMENTED', 'DRAFT', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED'] as const) {
      for (const to of all) {
        const error = await failure(put(api(from), { status: to }));
        const allowed = STATUS_TRANSITIONS[from].includes(to);
        expect(error === null, `${from} -> ${to}`).toBe(allowed);
        if (!allowed) expect(error?.code, `${from} -> ${to}`).toBe('INVALID_TRANSITION');
      }
    }
  });

  it('moves the status and the ETag, and checks If-Match when it comes', async () => {
    const fake = api('DRAFT');
    const before = fake.etagOf(12);
    const result = (await put(fake, { status: 'IN_PROGRESS' }, 12, before)) as {
      body: { data: Screen };
      etag: string;
    };
    expect(result.body.data.documentationStatus).toBe('IN_PROGRESS');
    expect(result.etag).toBe(fake.etagOf(12));
    expect(result.etag).not.toBe(before);
  });
});

describe('POST /screens/{id}/review in the fake API', () => {
  it('checks 400 before 404 (a RETURN needs a comment)', async () => {
    for (const body of [{ decision: 'RETURN' }, { decision: 'RETURN', comment: '' }]) {
      expect((await failure(post(api('IN_REVIEW'), body, 99)))?.code).toBe('VALIDATION_ERROR');
    }
    const nullComment = { decision: 'RETURN', comment: null };
    expect((await failure(post(api('IN_REVIEW'), nullComment, 99)))?.code).toBe('VALIDATION_ERROR');
  });

  it('checks 404 before APPLICATION_ARCHIVED', async () => {
    const fake = api('IN_REVIEW', { archived: true });
    expect((await failure(post(fake, { decision: 'APPROVE' }, 99)))?.code).toBe('NOT_FOUND');
  });

  it('checks APPLICATION_ARCHIVED before NOT_IN_REVIEW', async () => {
    const fake = api('DRAFT', { archived: true });
    expect((await failure(post(fake, { decision: 'APPROVE' })))?.code).toBe('APPLICATION_ARCHIVED');
  });

  it('checks NOT_IN_REVIEW before COMMENT_REQUIRED', async () => {
    const fake = api('IN_PROGRESS');
    expect((await failure(post(fake, { decision: 'RETURN', comment: '   ' })))?.code).toBe(
      'NOT_IN_REVIEW',
    );
  });

  it('answers COMMENT_REQUIRED last, for a RETURN whose comment has only spaces', async () => {
    const fake = api('IN_REVIEW');
    expect((await failure(post(fake, { decision: 'RETURN', comment: '   ' })))?.code).toBe(
      'COMMENT_REQUIRED',
    );
    expect(fake.state.screens.find((s) => s.id === 12)?.documentationStatus).toBe('IN_REVIEW');
  });

  it('has no 412: the operation takes no If-Match', async () => {
    const fake = api('IN_REVIEW');
    const result = (await fake.client.post('/screens/{id}/review', {
      path: { id: 12 },
      body: { decision: 'APPROVE' },
      ifMatch: 'W/"stale"',
    } as never)) as { body: { data: Screen } };
    expect(result.body.data.documentationStatus).toBe('APPROVED');
  });

  it('approves with no comment, or only spaces, without adding a comment', async () => {
    for (const body of [
      { decision: 'APPROVE' },
      { decision: 'APPROVE', comment: null },
      { decision: 'APPROVE', comment: '  ' },
    ]) {
      const fake = api('IN_REVIEW');
      const before = fake.state.screens.find((s) => s.id === 12)?.commentCount ?? 0;
      const result = (await post(fake, body)) as { body: { data: Screen } };
      expect(result.body.data.documentationStatus).toBe('APPROVED');
      expect(result.body.data.commentCount).toBe(before);
    }
  });

  it('adds a comment on APPROVE with content and on RETURN, and moves the ETag', async () => {
    const approve = api('IN_REVIEW');
    const approved = (await post(approve, { decision: 'APPROVE', comment: 'Good.' })) as {
      body: { data: Screen };
    };
    expect(approved.body.data.commentCount).toBe(3);

    const fake = api('IN_REVIEW');
    const before = fake.etagOf(12);
    const returned = (await post(fake, { decision: 'RETURN', comment: ' Fix the risks. ' })) as {
      body: { data: Screen };
      etag: string;
    };
    expect(returned.body.data.documentationStatus).toBe('IN_PROGRESS');
    expect(returned.body.data.commentCount).toBe(3);
    expect(returned.etag).not.toBe(before);
  });
});
