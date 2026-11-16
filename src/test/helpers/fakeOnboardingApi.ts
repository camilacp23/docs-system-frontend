// fakeOnboardingApi: in-memory fake of GET /onboarding/summary (and the screens read of the shell) behind the API client
// (no fetch).
// makeOnboardingApi(apps, init) -> { state, client, calls, callsTo, failNext, hold, screens }
//   init: summaries (what each application answers, by id; default: application 1 with `makeSummary()`), plus the screens
//   fake options. It answers like the server (SDD 7.2.7, D-124): 404 NOT_FOUND for an application that does not exist, a
//   weak ETag, the same shape for the three roles and for an archived application. `state.summaries` can change between reads.
//   failNext('GET /onboarding/summary', error) makes the next read fail once; hold(predicate) keeps the matching read waiting
//   until release() is called.
// makeSummary(overrides) -> the answer of an application with data of the contract (names of its examples); makeEmptySummary()
//   is an application with only App (OnStart): empty lists, no template text.
import { vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

import { makeScreensApi, type ScreensApiInit } from './fakeScreensApi';
import type { RecordedApiCall } from './fakeVariablesApi';
import type { makeApplicationsClient } from './renderApp';

export type SummaryData = components['schemas']['OnboardingEnvelope']['data'];

export const SAMPLE_MIRO = 'https://miro.com/app/board/uXjVSAR=/';

/** An application with data of the contract: figures that are NOT the ones drawn in the frames. */
export function makeSummary(overrides: Partial<SummaryData> = {}): SummaryData {
  return {
    application: { id: 1, name: 'SAR' },
    counts: { screens: 31, variables: 47, collections: 9, components: 123 },
    approvedPercent: 41.7,
    appContextScreen: {
      id: 10,
      name: 'App (OnStart)',
      documentationStatus: 'IN_PROGRESS',
      miroLink: SAMPLE_MIRO,
      template: {
        onStart: 'Set(gUsuarioActual, User());\nClearCollect(colCatalogo, Catalogo)',
        workingProcess: 'Loads the user, then the catalog.',
        architecture: null,
        dataModel: 'Reads Catalogo.',
        requirements: null,
        knownIssues: '',
        risks: '   ',
      },
    },
    keyScreens: [
      {
        screen: { id: 3, name: 'Inicio' },
        documentationStatus: 'APPROVED',
        connections: 14,
        depth: 1,
        miroLink: null,
      },
      {
        screen: { id: 12, name: 'Detalle' },
        documentationStatus: 'IN_REVIEW',
        connections: 9,
        depth: 1,
        miroLink: `${SAMPLE_MIRO}?moveToWidget=12`,
      },
      {
        screen: { id: 7, name: 'Solicitudes' },
        documentationStatus: 'IN_PROGRESS',
        connections: 21,
        depth: 2,
        miroLink: null,
      },
      {
        screen: { id: 19, name: 'Administración' },
        documentationStatus: 'DRAFT',
        connections: 6,
        depth: null,
        miroLink: null,
      },
    ],
    globalVariables: [
      {
        variable: { id: 11, name: 'gUsuarioActual' },
        dataType: 'RECORD',
        originScreen: null,
        usedByScreens: 18,
      },
      {
        variable: { id: 14, name: 'gFiltros' },
        dataType: 'TABLE',
        originScreen: { id: 3, name: 'Inicio' },
        usedByScreens: 1,
      },
    ],
    topComponents: [
      {
        component: { id: 88, name: 'galSolicitudes' },
        screen: { id: 7, name: 'Solicitudes' },
        uses: 5,
      },
      { component: { id: 91, name: 'btnGuardar' }, screen: { id: 12, name: 'Detalle' }, uses: 1 },
    ],
    ...overrides,
  };
}

/** An application with only App (OnStart): nothing documented, every list empty. */
export function makeEmptySummary(overrides: Partial<SummaryData> = {}): SummaryData {
  return makeSummary({
    counts: { screens: 1, variables: 0, collections: 0, components: 0 },
    approvedPercent: 0,
    appContextScreen: {
      id: 10,
      name: 'App (OnStart)',
      documentationStatus: 'UNDOCUMENTED',
      miroLink: null,
      template: {
        onStart: null,
        workingProcess: null,
        architecture: null,
        dataModel: null,
        requirements: null,
        knownIssues: null,
        risks: null,
      },
    },
    keyScreens: [],
    globalVariables: [],
    topComponents: [],
    ...overrides,
  });
}

export interface OnboardingApiInit extends ScreensApiInit {
  /** What each application answers, by id. Application 1 answers `makeSummary()` when it is not given. */
  summaries?: Record<number, SummaryData>;
}

function notFound(id: unknown): ApiError {
  return new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'application', id } });
}

export function makeOnboardingApi(
  apps: ReturnType<typeof makeApplicationsClient>,
  init: OnboardingApiInit = {},
) {
  const screens = makeScreensApi(apps, init);
  const state = { summaries: init.summaries ?? { 1: makeSummary() } };
  const calls: RecordedApiCall[] = [];
  const failures = new Map<string, ApiError[]>();
  const holds: Array<{ predicate: (call: RecordedApiCall) => boolean; gate: Promise<void> }> = [];

  function failNext(operation: string, error: ApiError) {
    failures.set(operation, [...(failures.get(operation) ?? []), error]);
  }

  function hold(predicate: (call: RecordedApiCall) => boolean) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    holds.push({ predicate, gate });
    return { release };
  }

  async function getSummary(options: RecordedApiCall['options']) {
    const call: RecordedApiCall = { method: 'GET', path: '/onboarding/summary', options };
    calls.push(call);
    for (const held of holds) if (held.predicate(call)) await held.gate;
    const failure = failures.get('GET /onboarding/summary')?.shift();
    if (failure) throw failure;
    const applicationId = options.query?.applicationId;
    const known = apps.state.applications.some((a) => a.id === applicationId);
    const found = typeof applicationId === 'number' ? state.summaries[applicationId] : undefined;
    if (!known || found === undefined) throw notFound(applicationId);
    const data: SummaryData = found;
    return {
      body: { data },
      status: 200,
      etag: `W/"onboarding-${String(applicationId)}-${JSON.stringify(data).length}"`,
      location: null,
    };
  }

  const get = vi.fn((path: string, options: RecordedApiCall['options'] = {}) => {
    if (path === '/onboarding/summary') return getSummary(options);
    return (screens.client.get as (p: string, o?: unknown) => Promise<unknown>)(path, options);
  });
  const client = { ...screens.client, get } as unknown as ApiClient;

  const callsTo = (operation: string) =>
    operation === 'GET /onboarding/summary' ? calls : screens.callsTo(operation);

  return { state, client, calls, callsTo, failNext, hold, screens };
}
