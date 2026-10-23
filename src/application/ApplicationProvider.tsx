// ApplicationProvider: loads GET /applications (every page) once the session is authenticated and keeps the
// selected application. Only the id is stored (localStorage), and only when the user selects one.
// Without a valid stored id it picks the first ACTIVE application, or the first one if all are archived.
// Props: children; client (optional, tests only; defaults to the app API client).
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, isApiError } from '../api/ApiError';
import type { ApiClient } from '../api/client';
import { api } from '../session/instance';
import { useSession } from '../session/useSession';

import { ApplicationContext, type Application, type ApplicationValue } from './ApplicationContext';
import { readSelectedApplicationId, writeSelectedApplicationId } from './selectionStorage';

const PAGE_SIZE = 100; // maximum allowed by the contract

interface ApplicationProviderProps {
  children: ReactNode;
  client?: ApiClient;
}

/** Outcome of one load, tagged with the user it belongs to so it is never shown to another user. */
type LoadResult =
  | { userId: number; applications: Application[]; error: null }
  | { userId: number; applications: []; error: ApiError };

async function fetchAllApplications(client: ApiClient): Promise<Application[]> {
  const all: Application[] = [];
  for (let page = 1; ; page++) {
    const { body } = await client.get('/applications', { query: { page, pageSize: PAGE_SIZE } });
    all.push(...body.data);
    if (body.data.length === 0 || all.length >= body.total) return all;
  }
}

function pickDefault(applications: Application[]): Application | null {
  return applications.find((a) => a.status === 'ACTIVE') ?? applications[0] ?? null;
}

export function ApplicationProvider({ children, client = api }: ApplicationProviderProps) {
  const { status: sessionStatus, phase, user } = useSession();
  const userId = sessionStatus === 'authenticated' && phase !== 'expired' && user ? user.id : null;

  const [result, setResult] = useState<LoadResult | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(() => readSelectedApplicationId());

  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;
    fetchAllApplications(client).then(
      (applications) => {
        if (!cancelled) setResult({ userId, applications, error: null });
      },
      (thrown: unknown) => {
        if (cancelled) return;
        const error = isApiError(thrown)
          ? thrown
          : new ApiError({ status: 0, code: 'UNEXPECTED_RESPONSE' });
        setResult({ userId, applications: [], error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId, client, reloadTick]);

  const reload = useCallback(() => {
    setResult(null);
    setReloadTick((tick) => tick + 1);
  }, []);

  const selectApplication = useCallback((id: number) => {
    setSelectedId(id);
    writeSelectedApplicationId(id);
  }, []);

  const value = useMemo<ApplicationValue>(() => {
    const own = result !== null && result.userId === userId ? result : null;
    const status: ApplicationValue['status'] =
      userId === null ? 'idle' : own === null ? 'loading' : own.error ? 'error' : 'ready';
    const applications = own?.applications ?? [];
    const current =
      applications.find((a) => a.id === selectedId) ??
      (status === 'ready' ? pickDefault(applications) : null);
    return {
      status,
      error: own?.error ?? null,
      applications,
      currentApplication: current,
      currentApplicationId: current?.id ?? null,
      selectApplication,
      reload,
    };
  }, [result, userId, selectedId, selectApplication, reload]);

  return <ApplicationContext value={value}>{children}</ApplicationContext>;
}
