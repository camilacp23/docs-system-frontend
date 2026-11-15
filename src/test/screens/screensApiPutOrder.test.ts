// Order of the checks of PUT /screens/{id} in the in-memory screens API (fakeScreensApi, fakeScreenUpdate). It must answer
// in the order of the real server (contract 0.3.5, D-76, D-84, D-85, D-87): 400 -> 404 (the screen, the nested ids, then
// the variables, collections and screens) -> 422 APPLICATION_ARCHIVED -> 412 -> 422 APP_CONTEXT_PROTECTED ->
// SCREEN_IN_REVIEW -> CROSS_APPLICATION -> CONTEXT_SCREEN_MISMATCH -> 409 DUPLICATE_NAME, each rule from the first item to
// the last. The page tests rely on it: a fake that checked in another order would let a test pass for a reason the
// server never produces.
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { toScreenUpdate, valuesFromScreen } from '../../modules/screens/screenEditForm';
import type { Screen, ScreenUpdate } from '../../modules/screens/screenTypes';
import { makeScreensApi } from '../helpers/fakeScreensApi';
import { makeVariable } from '../helpers/fakeVariablesApi';
import { makeApplication, makeApplicationsClient } from '../helpers/renderApp';
import { sampleCollections } from '../helpers/renderCollections';
import { sampleScreens } from '../helpers/renderScreens';
import { sampleVariables } from '../helpers/renderVariables';

type Fake = ReturnType<typeof makeScreensApi>;

/** Detalle (12) is in progress here, so the rules after SCREEN_IN_REVIEW can be reached. */
function api(archived = false): Fake {
  const apps = makeApplicationsClient([
    makeApplication(1, { name: 'SAR', status: archived ? 'ARCHIVED' : 'ACTIVE' }),
  ]);
  return makeScreensApi(apps, {
    screenDetails: sampleScreens().map((s) =>
      s.id === 12 ? { ...s, documentationStatus: 'IN_PROGRESS' as const } : s,
    ),
    collections: sampleCollections(),
    // A context variable without origin screen (6) and a variable of another application (7).
    variables: [
      ...sampleVariables(),
      makeVariable(6, 'locSinOrigen', { scope: 'CONTEXT' }),
      makeVariable(7, 'gAjena', { applicationId: 2 }),
    ],
  });
}

function setStatus(fake: Fake, id: number, documentationStatus: Screen['documentationStatus']) {
  fake.state.screens = fake.state.screens.map((s) =>
    s.id === id ? { ...s, documentationStatus } : s,
  );
}

const current = (fake: Fake, id: number): Screen => {
  const found = fake.state.screens.find((s) => s.id === id);
  if (found === undefined) throw new Error(`no screen ${id}`);
  return found;
};

/** The body PUT would send for the screen as it is, changed by `patch`. */
function updateOf(screen: Screen, patch?: (body: ScreenUpdate) => void): ScreenUpdate {
  const body = toScreenUpdate(valuesFromScreen(screen));
  patch?.(body);
  return body;
}

const put = (fake: Fake, id: number, patch?: (body: ScreenUpdate) => void, ifMatch?: string) =>
  fake.client.put('/screens/{id}', {
    path: { id },
    ifMatch,
    body: updateOf(current(fake, id), patch),
  });

async function errorOf(attempt: Promise<unknown>): Promise<ApiError> {
  try {
    await attempt;
  } catch (thrown) {
    if (thrown instanceof ApiError) return thrown;
    throw thrown;
  }
  throw new Error('the request did not fail');
}

const codeOf = async (attempt: Promise<unknown>) => {
  try {
    await attempt;
  } catch (thrown) {
    if (thrown instanceof ApiError) return thrown.code;
    throw thrown;
  }
  return 'OK';
};

/** The first component, link or navigation of a body, which exist in the sample screen. */
const first = <T>(items: readonly T[]): T => {
  const found = items[0];
  if (found === undefined) throw new Error('the sample screen has no such item');
  return found;
};

describe('PUT /screens/{id} in the fake API: 400 and 404', () => {
  it('checks 400 before 404', async () => {
    const fake = api();
    const body = updateOf(current(fake, 12), (b) => {
      b.miroLink = 'http://x';
    });
    expect(await codeOf(fake.client.put('/screens/{id}', { path: { id: 999 }, body }))).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('answers 400 with the position of a repeated component name, target, link and navigation', async () => {
    const fake = api();
    const error = await errorOf(
      put(fake, 12, (b) => {
        b.components[1] = { ...b.components[1]!, name: 'btnGuardar' };
        b.components[0]!.uses = [
          ...(b.components[0]!.uses ?? []),
          { targetType: 'VARIABLE', targetId: 3 },
        ];
        b.variableLinks.push({ variableId: 3, accessMode: 'READ', usedIn: 'btnGuardar.OnSelect' });
        b.navigations.push({ targetScreenId: 11 });
      }),
    );
    expect(error.details?.fields).toEqual([
      expect.objectContaining({ field: 'components[1].name', rule: 'unique' }),
      expect.objectContaining({ field: 'components[0].uses[2].targetId', rule: 'unique' }),
      expect.objectContaining({ field: 'variableLinks[1].usedIn', rule: 'unique' }),
      expect.objectContaining({ field: 'navigations[1].targetScreenId', rule: 'unique' }),
    ]);
  });

  it('answers 400 with rule self for a navigation to the screen itself, and 400 for usedIn origin', async () => {
    const fake = api();
    const self = await errorOf(
      put(fake, 12, (b) => {
        b.navigations = [{ targetScreenId: 12 }];
      }),
    );
    expect(self.details?.fields).toEqual([
      expect.objectContaining({ field: 'navigations[0].targetScreenId', rule: 'self' }),
    ]);
    const origin = await errorOf(
      put(fake, 12, (b) => {
        b.variableLinks[0] = { ...first(b.variableLinks), usedIn: 'origin' };
      }),
    );
    expect(origin.details?.fields).toEqual([
      expect.objectContaining({ field: 'variableLinks[0].usedIn', rule: 'pattern' }),
    ]);
  });

  it('answers 404 with the position of a nested id that is not of the screen, also an origin row', async () => {
    const fake = api();
    const component = await errorOf(
      put(fake, 12, (b) => {
        b.components[2] = { ...b.components[2]!, id: 9999 };
      }),
    );
    expect(component.code).toBe('NOT_FOUND');
    expect(component.details).toMatchObject({ element: 'component', field: 'components[2].id' });

    const use = await errorOf(
      put(fake, 12, (b) => {
        // The id of a use under another component is not valid here.
        b.components[2] = {
          ...b.components[2]!,
          uses: [{ id: 401, targetType: 'VARIABLE', targetId: 3 }],
        };
      }),
    );
    expect(use.details).toMatchObject({
      element: 'component use',
      field: 'components[2].uses[0].id',
    });

    const origin = await errorOf(
      put(fake, 12, (b) => {
        b.variableLinks.push({ id: 501, variableId: 4, accessMode: 'WRITE', usedIn: 'OnVisible' });
      }),
    );
    expect(origin.details).toMatchObject({
      element: 'variable link',
      field: 'variableLinks[1].id',
    });
  });

  it('answers 404 for a variable or a screen that does not exist, the nested ids first', async () => {
    const fake = api();
    const variable = await errorOf(
      put(fake, 12, (b) => {
        b.variableLinks[0] = { ...first(b.variableLinks), variableId: 999 };
      }),
    );
    expect(variable.details).toMatchObject({
      element: 'variable',
      field: 'variableLinks[0].variableId',
    });
    const navigation = await errorOf(
      put(fake, 12, (b) => {
        b.navigations[0] = { ...first(b.navigations), targetScreenId: 999 };
      }),
    );
    expect(navigation.details).toMatchObject({ field: 'navigations[0].targetScreenId' });
    const both = await errorOf(
      put(fake, 12, (b) => {
        b.variableLinks[0] = { ...first(b.variableLinks), variableId: 999 };
        b.components[0] = { ...first(b.components), id: 9999 };
      }),
    );
    expect(both.details).toMatchObject({ field: 'components[0].id' });
  });
});

describe('PUT /screens/{id} in the fake API: 422, 412 and 409', () => {
  it('checks 404 before APPLICATION_ARCHIVED and APPLICATION_ARCHIVED before 412', async () => {
    const fake = api(true);
    expect(
      await codeOf(
        put(fake, 12, (b) => {
          b.components[0] = { ...first(b.components), id: 9999 };
        }),
      ),
    ).toBe('NOT_FOUND');
    expect(await codeOf(put(fake, 12, undefined, 'W/"stale"'))).toBe('APPLICATION_ARCHIVED');
  });

  it('checks 412 before the rules: a stale If-Match on a screen in review is a 412', async () => {
    const fake = api();
    setStatus(fake, 12, 'IN_REVIEW');
    expect(await codeOf(put(fake, 12, undefined, 'W/"stale"'))).toBe('PRECONDITION_FAILED');
    expect(await codeOf(put(fake, 12, undefined, fake.etagOf(12)))).toBe('SCREEN_IN_REVIEW');
  });

  it('checks APP_CONTEXT_PROTECTED before SCREEN_IN_REVIEW', async () => {
    const fake = api();
    setStatus(fake, 10, 'IN_REVIEW');
    expect(
      await codeOf(
        put(fake, 10, (b) => {
          b.name = 'Start';
        }),
      ),
    ).toBe('APP_CONTEXT_PROTECTED');
    // Without a new name, the same screen reports the review.
    expect(await codeOf(put(fake, 10))).toBe('SCREEN_IN_REVIEW');
  });

  it('checks SCREEN_IN_REVIEW before CROSS_APPLICATION, and that before CONTEXT_SCREEN_MISMATCH', async () => {
    const fake = api();
    // Index 1 breaks CONTEXT_SCREEN_MISMATCH and index 2 breaks CROSS_APPLICATION: the rule goes first, not the index.
    const body = (b: ScreenUpdate) => {
      b.variableLinks.push(
        { variableId: 5, accessMode: 'READ', usedIn: 'OnVisible' },
        { variableId: 7, accessMode: 'READ', usedIn: 'OnHidden' },
      );
    };
    const cross = await errorOf(put(fake, 12, body));
    expect(cross.code).toBe('CROSS_APPLICATION');
    expect(cross.details).toMatchObject({ field: 'variableLinks[2].variableId' });

    setStatus(fake, 12, 'IN_REVIEW');
    expect(await codeOf(put(fake, 12, body))).toBe('SCREEN_IN_REVIEW');
  });

  it('judges a context variable of another screen: only WRITE, and none without origin (D-52, D-64)', async () => {
    const fake = api();
    const read = await errorOf(
      put(fake, 12, (b) => {
        b.variableLinks.push({ variableId: 5, accessMode: 'READ', usedIn: 'OnVisible' });
      }),
    );
    expect(read.code).toBe('CONTEXT_SCREEN_MISMATCH');
    expect(read.details).toMatchObject({
      field: 'variableLinks[1].variableId',
      variable: 'locOrden',
      screen: 'Inicio',
    });
    const none = await errorOf(
      put(fake, 12, (b) => {
        b.variableLinks.push({ variableId: 6, accessMode: 'WRITE', usedIn: 'OnVisible' });
      }),
    );
    expect(none.details).toMatchObject({ variable: 'locSinOrigen', originScreenId: null });
    expect(
      await codeOf(
        put(fake, 12, (b) => {
          b.variableLinks.push({ variableId: 5, accessMode: 'WRITE', usedIn: 'OnVisible' });
        }),
      ),
    ).toBe('OK');
  });

  it('does not judge again a link that already existed and did not change (D-85)', async () => {
    const fake = api();
    // A saved link to a variable of another application.
    fake.state.screens = fake.state.screens.map((s) =>
      s.id === 12
        ? {
            ...s,
            variableLinks: [
              ...s.variableLinks,
              {
                id: 503,
                variable: { id: 7, name: 'gAjena' },
                accessMode: 'READ' as const,
                usedIn: 'OnVisible',
                isOrigin: false,
              },
            ],
          }
        : s,
    );
    expect(await codeOf(put(fake, 12))).toBe('OK');
    // Changing its access mode makes it modified, so it is judged.
    expect(
      await codeOf(
        put(fake, 12, (b) => {
          b.variableLinks[1] = { ...b.variableLinks[1]!, accessMode: 'WRITE' };
        }),
      ),
    ).toBe('CROSS_APPLICATION');
  });

  it('answers DUPLICATE_NAME last, with its container', async () => {
    const fake = api();
    const error = await errorOf(
      put(fake, 12, (b) => {
        b.name = 'Inicio';
      }),
    );
    expect(error.code).toBe('DUPLICATE_NAME');
    expect(error.details).toMatchObject({
      field: 'name',
      application: 'SAR',
      container: 'application',
    });
  });
});

describe('PUT /screens/{id} in the fake API: what it writes', () => {
  it('reconciles by id, swaps names and never touches or deletes the origin rows (D-26, D-84)', async () => {
    const fake = api();
    await put(fake, 12, (b) => {
      b.components[0] = { ...first(b.components), name: 'lblNombre' };
      b.components[1] = { ...b.components[1]!, name: 'btnGuardar' };
      b.variableLinks = [];
    });
    const saved = current(fake, 12);
    expect(saved.components.slice(0, 2).map((c) => [c.id, c.name])).toEqual([
      [301, 'lblNombre'],
      [302, 'btnGuardar'],
    ]);
    // The origin row stays although the body has no variable links.
    expect(saved.variableLinks.map((l) => [l.id, l.isOrigin])).toEqual([[501, true]]);
  });

  it('answers the same ETag and writes nothing when nothing changes (D-71)', async () => {
    const fake = api();
    const before = fake.etagOf(12);
    const updatedAt = current(fake, 12).updatedAt;

    const same = await put(fake, 12, undefined, before);

    expect(same.etag).toBe(before);
    expect(same.body.data.updatedAt).toBe(updatedAt);
  });

  it('sends an APPROVED screen back to IN_PROGRESS only when something changes (D-81)', async () => {
    const fake = api();
    setStatus(fake, 12, 'APPROVED');
    const before = fake.etagOf(12);

    expect((await put(fake, 12)).body.data.documentationStatus).toBe('APPROVED');
    const edited = await put(fake, 12, (b) => {
      b.navigations = [];
    });

    expect(edited.body.data.documentationStatus).toBe('IN_PROGRESS');
    expect(edited.etag).not.toBe(before);
  });

  it('makes an UNDOCUMENTED screen a DRAFT when a field gains content, not for spaces (D-81)', async () => {
    const fake = api();
    const spaces = await put(fake, 14, (b) => {
      b.template.risks = '   ';
    });
    expect(spaces.body.data.documentationStatus).toBe('UNDOCUMENTED');
    const content = await put(fake, 14, (b) => {
      b.template.risks = 'Fragile';
    });
    expect(content.body.data.documentationStatus).toBe('DRAFT');
  });
});
