// Order of the checks of a write in the in-memory screens API (fakeScreensApi). It must answer in the order of the
// real one (contract 0.3.5, D-82, D-84): POST 400 -> 404 -> 422 APPLICATION_ARCHIVED -> 409 DUPLICATE_NAME and
// DELETE 404 -> 422 APPLICATION_ARCHIVED -> 422 APP_CONTEXT_PROTECTED -> 422 SCREEN_IN_REVIEW. The page tests rely on
// it: a fake that checked in another order would let a test pass for a reason the server never produces.
// The order of PUT /screens/{id} is in screensApiPutOrder.test.ts.
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ScreenCreate } from '../../modules/screens/screenTypes';
import { makeScreenDetail, makeScreensApi } from '../helpers/fakeScreensApi';
import { makeApplication, makeApplicationsClient } from '../helpers/renderApp';
import { sampleScreens } from '../helpers/renderScreens';

function api(archived = false) {
  const apps = makeApplicationsClient([
    makeApplication(1, { name: 'SAR', status: archived ? 'ARCHIVED' : 'ACTIVE' }),
  ]);
  return makeScreensApi(apps, { screenDetails: sampleScreens() });
}

const create = (extra: Partial<ScreenCreate> = {}): ScreenCreate => ({
  applicationId: 1,
  name: 'Nueva',
  template: makeScreenDetail(1, 'x').template,
  components: [],
  variableLinks: [],
  collectionLinks: [],
  navigations: [],
  ...extra,
});

async function codeOf(attempt: Promise<unknown>): Promise<string> {
  try {
    await attempt;
  } catch (thrown) {
    if (thrown instanceof ApiError) return thrown.code;
    throw thrown;
  }
  return 'OK';
}

describe('POST /screens in the fake API', () => {
  it('checks 400 before 404', async () => {
    const fake = api();
    const result = await codeOf(
      fake.client.post('/screens', { body: create({ applicationId: 99, miroLink: 'http://x' }) }),
    );
    expect(result).toBe('VALIDATION_ERROR');
  });

  it('checks 404 before APPLICATION_ARCHIVED', async () => {
    const fake = api(true);
    expect(
      await codeOf(fake.client.post('/screens', { body: create({ applicationId: 99 }) })),
    ).toBe('NOT_FOUND');
  });

  it('checks APPLICATION_ARCHIVED before DUPLICATE_NAME', async () => {
    const fake = api(true);
    expect(await codeOf(fake.client.post('/screens', { body: create({ name: 'Detalle' }) }))).toBe(
      'APPLICATION_ARCHIVED',
    );
  });

  it('answers DUPLICATE_NAME last, with its container', async () => {
    const fake = api();
    try {
      await fake.client.post('/screens', { body: create({ name: 'Detalle' }) });
      expect.unreachable();
    } catch (thrown) {
      expect((thrown as ApiError).details).toMatchObject({
        field: 'name',
        type: 'screen',
        name: 'Detalle',
        application: 'SAR',
        container: 'application',
      });
    }
  });

  it('starts UNDOCUMENTED, or DRAFT when a field has content, and ignores spaces (D-81)', async () => {
    const fake = api();
    const empty = await fake.client.post('/screens', { body: create({ name: 'A' }) });
    expect(empty.body.data.documentationStatus).toBe('UNDOCUMENTED');
    const spaces = await fake.client.post('/screens', {
      body: create({ name: 'B', template: { ...create().template, risks: '   ' } }),
    });
    expect(spaces.body.data.documentationStatus).toBe('UNDOCUMENTED');
    const content = await fake.client.post('/screens', {
      body: create({ name: 'C', template: { ...create().template, risks: 'Fragile' } }),
    });
    expect(content.body.data.documentationStatus).toBe('DRAFT');
  });
});

describe('DELETE /screens/{id} in the fake API', () => {
  it('checks 404 first', async () => {
    const fake = api(true);
    expect(await codeOf(fake.client.delete('/screens/{id}', { path: { id: 999 } }))).toBe(
      'NOT_FOUND',
    );
  });

  it('checks APPLICATION_ARCHIVED before APP_CONTEXT_PROTECTED', async () => {
    const fake = api(true);
    expect(await codeOf(fake.client.delete('/screens/{id}', { path: { id: 10 } }))).toBe(
      'APPLICATION_ARCHIVED',
    );
  });

  it('checks APPLICATION_ARCHIVED before SCREEN_IN_REVIEW', async () => {
    const fake = api(true);
    expect(await codeOf(fake.client.delete('/screens/{id}', { path: { id: 12 } }))).toBe(
      'APPLICATION_ARCHIVED',
    );
  });

  it('checks APP_CONTEXT_PROTECTED before SCREEN_IN_REVIEW', async () => {
    const fake = api();
    fake.state.screens = fake.state.screens.map((s) =>
      s.id === 10 ? { ...s, documentationStatus: 'IN_REVIEW' } : s,
    );
    expect(await codeOf(fake.client.delete('/screens/{id}', { path: { id: 10 } }))).toBe(
      'APP_CONTEXT_PROTECTED',
    );
  });

  it('answers SCREEN_IN_REVIEW for a screen in review and deletes any other', async () => {
    const fake = api();
    expect(await codeOf(fake.client.delete('/screens/{id}', { path: { id: 12 } }))).toBe(
      'SCREEN_IN_REVIEW',
    );
    expect(await codeOf(fake.client.delete('/screens/{id}', { path: { id: 13 } }))).toBe('OK');
    expect(fake.state.screens.some((s) => s.id === 13)).toBe(false);
  });
});

describe('GET /screens in the fake API', () => {
  it('answers 404 for an application that does not exist (D-70) and 400 for a sort it does not know', async () => {
    const fake = api();
    expect(await codeOf(fake.client.get('/screens', { query: { applicationId: 99 } }))).toBe(
      'NOT_FOUND',
    );
    expect(
      await codeOf(fake.client.get('/screens', { query: { applicationId: 1, sort: 'bogus' } })),
    ).toBe('VALIDATION_ERROR');
  });

  it('lists App (OnStart) first whatever the order', async () => {
    const fake = api();
    for (const sort of ['name', '-name', 'updatedAt', '-pendingSubtasks', 'documentationStatus']) {
      const { body } = await fake.client.get('/screens', {
        query: { applicationId: 1, sort },
      });
      expect(body.data[0]?.name, sort).toBe('App (OnStart)');
    }
  });
});
