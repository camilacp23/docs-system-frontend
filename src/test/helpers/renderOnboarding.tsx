// renderOnboarding: renderApp over the in-memory onboarding API (fakeOnboardingApi) in application 1 ("SAR", the one the
// shell selects), at /onboarding. The summary is `makeSummary()` (data of the contract) unless `summaries` says otherwise.
// Options: role (of the signed-in user, default ADMINISTRATOR), path (default /onboarding), applications, `summaries` (what
// each application answers, by id), `prepare` (arms failures or holds on the fake before the first read), settled.
// Returns what renderApp returns plus `api`.
import type { Role } from '../../app/router/routes';
import type { Application } from '../../application/ApplicationContext';

import {
  makeOnboardingApi,
  makeSummary,
  type OnboardingApiInit,
  type SummaryData,
} from './fakeOnboardingApi';
import { renderApp } from './renderApp';

export interface RenderOnboardingOptions {
  role?: Role;
  path?: string;
  applications?: Application[];
  summaries?: Record<number, SummaryData>;
  /** The steps already completed, by application id (the saved progress). */
  progress?: Record<number, number[]>;
  prepare?: (api: ReturnType<typeof makeOnboardingApi>) => void;
  settled?: boolean;
  /** The rest of the options of the fake (the screens the shell reads). */
  fake?: OnboardingApiInit;
}

export async function renderOnboarding(options: RenderOnboardingOptions = {}) {
  const role = options.role ?? 'ADMINISTRATOR';
  let api!: ReturnType<typeof makeOnboardingApi>;
  const view = await renderApp({
    role,
    path: options.path ?? '/onboarding',
    applications: options.applications,
    settled: options.settled,
    buildClient: (apps) => {
      api = makeOnboardingApi(apps, {
        ...options.fake,
        summaries: options.summaries ?? { 1: makeSummary() },
        ...(options.progress !== undefined && { progress: options.progress }),
      });
      options.prepare?.(api);
      return api.client;
    },
  });
  return { ...view, api };
}
