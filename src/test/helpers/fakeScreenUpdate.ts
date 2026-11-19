// fakeScreenUpdate: the rules of PUT /screens/{id} for the in-memory screens API, in the order of the real server
// (contract 0.3.5, D-75, D-76, D-81, D-84, D-85, D-87):
//   400 (the body by itself: lengths, patterns, repeated names, targets, ids and links, navigation to itself)
//   404 (the screen, then the nested ids, then the variables, collections and screens the body points at)
//   422 APPLICATION_ARCHIVED -> 412 (If-Match) -> 422 APP_CONTEXT_PROTECTED -> SCREEN_IN_REVIEW -> CROSS_APPLICATION
//   (variable links, collection links, navigations, uses) -> CONTEXT_SCREEN_MISMATCH -> 409 DUPLICATE_NAME.
//   Each rule goes from the first item to the last and reports the first that fails, with `details.field`.
//   Only the links that are new or modified are judged by CROSS_APPLICATION and CONTEXT_SCREEN_MISMATCH (D-85).
// applyScreenUpdate(env, current, body, ifMatch) -> { screen, changed }: the nested items are reconciled by id (the rows
// the variables module keeps, `isOrigin`, are never touched), the status follows D-81 and an update that changes
// nothing returns the screen as it was. The swap of targets that re-creates one row (D-86) is not reproduced.
import { ApiError } from '../../api/ApiError';
import type { Screen, ScreenUpdate } from '../../modules/screens/screenTypes';
import { TEMPLATE_FIELDS } from '../../modules/screens/templateFields';

import { sameScreenVersion } from './fakeScreenStatus';

interface Named {
  id: number;
  name: string;
  applicationId: number;
}

export interface ScreenUpdateEnv {
  screens: readonly Screen[];
  variables: ReadonlyArray<
    Named & { scope: 'GLOBAL' | 'CONTEXT'; originScreen: { id: number; name: string } | null }
  >;
  collections: readonly Named[];
  application: { name: string; archived: boolean };
  etagOf: (id: number) => string;
  nextNestedId: () => number;
  now: () => string;
}

interface FieldError {
  field: string;
  rule: string;
  message: string;
}

const validation = (fields: FieldError[]) =>
  new ApiError({ status: 400, code: 'VALIDATION_ERROR', details: { fields } });

const notFound = (element: string, id: number, field: string) =>
  new ApiError({ status: 404, code: 'NOT_FOUND', details: { element, id, field } });

const hasContent = (text: string | null | undefined) =>
  typeof text === 'string' && text.trim() !== '';

/** The fields whose value was already used by an earlier item: the server reports each repeated position. */
function repeated<T>(
  items: readonly T[],
  keyOf: (item: T) => string | undefined,
  fieldOf: (index: number) => string,
): FieldError[] {
  const seen = new Set<string>();
  const found: FieldError[] = [];
  items.forEach((item, index) => {
    const key = keyOf(item);
    if (key === undefined) return;
    if (seen.has(key)) found.push({ field: fieldOf(index), rule: 'unique', message: 'repeated' });
    seen.add(key);
  });
  return found;
}

const USED_IN = /^(?!origin$)[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;
const COMPONENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function checkBody(body: ScreenUpdate, selfId: number): void {
  const fields: FieldError[] = [];
  const bad = (field: string, rule: string) => fields.push({ field, rule, message: 'invalid' });
  if (body.name.length < 1) bad('name', 'minLength');
  if (body.name.length > 150) bad('name', 'maxLength');
  if (typeof body.miroLink === 'string' && !/^https:\/\//.test(body.miroLink))
    bad('miroLink', 'pattern');
  body.components.forEach((component, i) => {
    if (!COMPONENT_NAME.test(component.name)) bad(`components[${i}].name`, 'pattern');
    if (component.type.length < 1) bad(`components[${i}].type`, 'minLength');
  });
  body.variableLinks.forEach((link, i) => {
    if (!USED_IN.test(link.usedIn)) bad(`variableLinks[${i}].usedIn`, 'pattern');
  });
  body.collectionLinks.forEach((link, i) => {
    if (!USED_IN.test(link.usedIn)) bad(`collectionLinks[${i}].usedIn`, 'pattern');
  });
  if (fields.length > 0) throw validation(fields);

  // The service: repeated names, targets, ids and links, then a navigation to the screen itself.
  const rules: FieldError[] = [
    ...repeated(
      body.components,
      (c) => c.name,
      (i) => `components[${i}].name`,
    ),
    ...repeated(
      body.components,
      (c) => (c.id === undefined ? undefined : String(c.id)),
      (i) => `components[${i}].id`,
    ),
  ];
  body.components.forEach((component, i) => {
    rules.push(
      ...repeated(
        component.uses ?? [],
        (u) => String(u.targetId),
        (j) => `components[${i}].uses[${j}].targetId`,
      ),
      ...repeated(
        component.uses ?? [],
        (u) => (u.id === undefined ? undefined : String(u.id)),
        (j) => `components[${i}].uses[${j}].id`,
      ),
    );
  });
  rules.push(
    ...repeated(
      body.variableLinks,
      (l) => `${l.variableId}|${l.usedIn}`,
      (i) => `variableLinks[${i}].usedIn`,
    ),
    ...repeated(
      body.variableLinks,
      (l) => (l.id === undefined ? undefined : String(l.id)),
      (i) => `variableLinks[${i}].id`,
    ),
    ...repeated(
      body.collectionLinks,
      (l) => `${l.collectionId}|${l.usedIn}`,
      (i) => `collectionLinks[${i}].usedIn`,
    ),
    ...repeated(
      body.collectionLinks,
      (l) => (l.id === undefined ? undefined : String(l.id)),
      (i) => `collectionLinks[${i}].id`,
    ),
    ...repeated(
      body.navigations,
      (n) => String(n.targetScreenId),
      (i) => `navigations[${i}].targetScreenId`,
    ),
    ...repeated(
      body.navigations,
      (n) => (n.id === undefined ? undefined : String(n.id)),
      (i) => `navigations[${i}].id`,
    ),
  );
  body.navigations.forEach((navigation, i) => {
    if (navigation.targetScreenId === selfId) {
      rules.push({
        field: `navigations[${i}].targetScreenId`,
        rule: 'self',
        message: 'A screen cannot navigate to itself.',
      });
    }
  });
  if (rules.length > 0) throw validation(rules);
}

type ReadUse = {
  id: number;
  targetType: 'VARIABLE' | 'COLLECTION';
  target: { id: number; name: string };
  description: string | null;
};

const usesOf = (component: Screen['components'][number]): ReadUse[] => component.uses;

function checkNestedIds(body: ScreenUpdate, current: Screen): void {
  body.components.forEach((component, i) => {
    if (component.id !== undefined && !current.components.some((c) => c.id === component.id))
      throw notFound('component', component.id, `components[${i}].id`);
  });
  body.components.forEach((component, i) => {
    const own = current.components.find((c) => c.id === component.id);
    (component.uses ?? []).forEach((use, j) => {
      if (
        use.id !== undefined &&
        !(own === undefined ? [] : usesOf(own)).some((u) => u.id === use.id)
      )
        throw notFound('component use', use.id, `components[${i}].uses[${j}].id`);
    });
  });
  body.variableLinks.forEach((link, i) => {
    const own = current.variableLinks.some((l) => l.id === link.id && !l.isOrigin);
    if (link.id !== undefined && !own)
      throw notFound('variable link', link.id, `variableLinks[${i}].id`);
  });
  body.collectionLinks.forEach((link, i) => {
    if (link.id !== undefined && !current.collectionLinks.some((l) => l.id === link.id))
      throw notFound('collection link', link.id, `collectionLinks[${i}].id`);
  });
  body.navigations.forEach((navigation, i) => {
    if (navigation.id !== undefined && !current.navigations.some((n) => n.id === navigation.id))
      throw notFound('navigation', navigation.id, `navigations[${i}].id`);
  });
}

function checkReferences(body: ScreenUpdate, env: ScreenUpdateEnv): void {
  const variable = (id: number, field: string) => {
    if (!env.variables.some((v) => v.id === id)) throw notFound('variable', id, field);
  };
  const collection = (id: number, field: string) => {
    if (!env.collections.some((c) => c.id === id)) throw notFound('collection', id, field);
  };
  body.variableLinks.forEach((l, i) => {
    variable(l.variableId, `variableLinks[${i}].variableId`);
  });
  body.collectionLinks.forEach((l, i) => {
    collection(l.collectionId, `collectionLinks[${i}].collectionId`);
  });
  body.components.forEach((component, i) => {
    (component.uses ?? []).forEach((use, j) => {
      const field = `components[${i}].uses[${j}].targetId`;
      if (use.targetType === 'VARIABLE') variable(use.targetId, field);
      else collection(use.targetId, field);
    });
  });
  body.navigations.forEach((n, i) => {
    if (!env.screens.some((s) => s.id === n.targetScreenId))
      throw notFound('screen', n.targetScreenId, `navigations[${i}].targetScreenId`);
  });
}

function checkRules(body: ScreenUpdate, current: Screen, env: ScreenUpdateEnv): void {
  if (current.isAppContext && body.name !== current.name)
    throw new ApiError({ status: 422, code: 'APP_CONTEXT_PROTECTED' });
  if (current.documentationStatus === 'IN_REVIEW')
    throw new ApiError({ status: 422, code: 'SCREEN_IN_REVIEW' });

  const app = current.applicationId;
  const stored = current.variableLinks.filter((l) => !l.isOrigin);
  const variableChanged = (link: ScreenUpdate['variableLinks'][number]) => {
    const before = stored.find((s) => s.id === link.id);
    return (
      before === undefined ||
      before.variable.id !== link.variableId ||
      before.accessMode !== link.accessMode ||
      before.usedIn !== link.usedIn
    );
  };
  const collectionChanged = (link: ScreenUpdate['collectionLinks'][number]) => {
    const before = current.collectionLinks.find((s) => s.id === link.id);
    return (
      before === undefined ||
      before.collection.id !== link.collectionId ||
      before.accessMode !== link.accessMode ||
      before.usedIn !== link.usedIn
    );
  };
  const cross = (field: string) =>
    new ApiError({ status: 422, code: 'CROSS_APPLICATION', details: { field } });

  body.variableLinks.forEach((link, i) => {
    const found = env.variables.find((v) => v.id === link.variableId);
    if (variableChanged(link) && found?.applicationId !== app)
      throw cross(`variableLinks[${i}].variableId`);
  });
  body.collectionLinks.forEach((link, i) => {
    const found = env.collections.find((c) => c.id === link.collectionId);
    if (collectionChanged(link) && found?.applicationId !== app)
      throw cross(`collectionLinks[${i}].collectionId`);
  });
  body.navigations.forEach((navigation, i) => {
    if (env.screens.find((s) => s.id === navigation.targetScreenId)?.applicationId !== app)
      throw cross(`navigations[${i}].targetScreenId`);
  });
  body.components.forEach((component, i) => {
    (component.uses ?? []).forEach((use, j) => {
      const found =
        use.targetType === 'VARIABLE'
          ? env.variables.find((v) => v.id === use.targetId)
          : env.collections.find((c) => c.id === use.targetId);
      if (found?.applicationId !== app) throw cross(`components[${i}].uses[${j}].targetId`);
    });
  });

  body.variableLinks.forEach((link, i) => {
    if (!variableChanged(link)) return;
    const variable = env.variables.find((v) => v.id === link.variableId);
    if (variable === undefined || variable.scope !== 'CONTEXT') return;
    const origin = variable.originScreen;
    if (origin !== null && (origin.id === current.id || link.accessMode === 'WRITE')) return;
    throw new ApiError({
      status: 422,
      code: 'CONTEXT_SCREEN_MISMATCH',
      details: {
        variableId: variable.id,
        variable: variable.name,
        originScreenId: origin?.id ?? null,
        screen: origin?.name ?? null,
        screenId: current.id,
        targetScreen: current.name,
        field: `variableLinks[${i}].variableId`,
      },
    });
  });
}

/** The editable part of a screen as the PUT would send it, for the "nothing changed" comparison. */
function editable(screen: Screen) {
  return JSON.stringify({
    name: screen.name,
    miroLink: screen.miroLink,
    template: screen.template,
    components: screen.components.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      onSelect: c.onSelect ?? null,
      description: c.description ?? null,
      uses: usesOf(c).map((u) => [u.id, u.targetType, u.target.id, u.description ?? null]),
    })),
    variableLinks: screen.variableLinks
      .filter((l) => !l.isOrigin)
      .map((l) => [l.id, l.variable.id, l.accessMode, l.usedIn]),
    collectionLinks: screen.collectionLinks.map((l) => [
      l.id,
      l.collection.id,
      l.accessMode,
      l.usedIn,
    ]),
    navigations: screen.navigations.map((n) => [n.id, n.targetScreen.id, n.description ?? null]),
  });
}

export function applyScreenUpdate(
  env: ScreenUpdateEnv,
  current: Screen,
  body: ScreenUpdate,
  ifMatch: string | undefined,
): { screen: Screen; changed: boolean } {
  // 422 APPLICATION_ARCHIVED -> 412 -> the business rules -> 409.
  if (env.application.archived) throw new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' });
  if (ifMatch !== undefined && !sameScreenVersion(ifMatch, env.etagOf(current.id))) {
    throw new ApiError({
      status: 412,
      code: 'PRECONDITION_FAILED',
      details: { element: 'screen', currentETag: env.etagOf(current.id) },
    });
  }
  checkRules(body, current, env);
  if (
    env.screens.some(
      (s) =>
        s.id !== current.id && s.applicationId === current.applicationId && s.name === body.name,
    )
  ) {
    throw new ApiError({
      status: 409,
      code: 'DUPLICATE_NAME',
      details: {
        field: 'name',
        type: 'screen',
        name: body.name,
        application: env.application.name,
        container: 'application',
      },
    });
  }

  const refVariable = (id: number) => {
    const found = env.variables.find((v) => v.id === id);
    return { id, name: found?.name ?? '' };
  };
  const refCollection = (id: number) => {
    const found = env.collections.find((c) => c.id === id);
    return { id, name: found?.name ?? '' };
  };
  const next: Screen = {
    ...current,
    name: body.name,
    miroLink: body.miroLink ?? null,
    template: Object.fromEntries(
      TEMPLATE_FIELDS.map((field) => [field.key, body.template[field.key] ?? null]),
    ) as Screen['template'],
    components: body.components.map((component) => ({
      id: component.id ?? env.nextNestedId(),
      name: component.name,
      type: component.type,
      onSelect: component.onSelect ?? null,
      description: component.description ?? null,
      uses: (component.uses ?? []).map((use) => ({
        id: use.id ?? env.nextNestedId(),
        targetType: use.targetType,
        target:
          use.targetType === 'VARIABLE' ? refVariable(use.targetId) : refCollection(use.targetId),
        description: use.description ?? null,
      })),
    })),
    // The rows of origin stay as they are, first, whatever the body says.
    variableLinks: [
      ...current.variableLinks.filter((l) => l.isOrigin),
      ...body.variableLinks.map((link) => ({
        id: link.id ?? env.nextNestedId(),
        variable: refVariable(link.variableId),
        accessMode: link.accessMode,
        usedIn: link.usedIn,
        isOrigin: false,
        originUsedIn: null,
      })),
    ],
    collectionLinks: body.collectionLinks.map((link) => ({
      id: link.id ?? env.nextNestedId(),
      collection: refCollection(link.collectionId),
      accessMode: link.accessMode,
      usedIn: link.usedIn,
    })),
    navigations: body.navigations.map((navigation) => ({
      id: navigation.id ?? env.nextNestedId(),
      targetScreen: {
        id: navigation.targetScreenId,
        name: env.screens.find((s) => s.id === navigation.targetScreenId)?.name ?? '',
      },
      description: navigation.description ?? null,
    })),
  };
  if (editable(next) === editable(current)) return { screen: current, changed: false };

  // D-81: an APPROVED screen goes back to IN_PROGRESS; an UNDOCUMENTED one with new content becomes DRAFT.
  const gainedContent = TEMPLATE_FIELDS.some(
    (field) => !hasContent(current.template[field.key]) && hasContent(next.template[field.key]),
  );
  const documentationStatus =
    current.documentationStatus === 'APPROVED'
      ? 'IN_PROGRESS'
      : current.documentationStatus === 'UNDOCUMENTED' && gainedContent
        ? 'DRAFT'
        : current.documentationStatus;
  return { screen: { ...next, documentationStatus, updatedAt: env.now() }, changed: true };
}

/** The 400 and 404 of the body, before anything else (the screen itself was found by the caller). */
export function checkScreenUpdateRequest(
  body: ScreenUpdate,
  current: Screen,
  env: ScreenUpdateEnv,
) {
  checkNestedIds(body, current);
  checkReferences(body, env);
}

export { checkBody as checkScreenUpdateBody };
