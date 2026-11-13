// ApplicationProvider: loads GET /applications (every page) once the session is authenticated and keeps the
// selected application. Only the id is stored (localStorage), and only when the user selects one.
// Without a valid stored id it picks the first ACTIVE application, or the first one if all are archived, and sticks
// to that pick (in memory only, never stored) while the session lasts: if the application on screen is archived later,
// it stays selected and the read-only strip appears (S-09b) instead of the shell jumping to another application.
// reload() blanks the list while it reads again; refresh() keeps the current one until the new one arrives.
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
  const { status: sessionStatus, phase, user, endReason, lastUser } = useSession();
  const userId = sessionStatus === 'authenticated' && phase !== 'expired' && user ? user.id : null;

  // While the "session ended" dialog is open (S-43b) the page keeps showing what was already loaded.
  const endedUserId =
    sessionStatus === 'anonymous' && endReason !== null && endReason !== 'logout'
      ? (lastUser?.id ?? null)
      : null;
  const viewUserId = userId ?? endedUserId;

  const [result, setResult] = useState<LoadResult | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(() => readSelectedApplicationId());
  /** The application picked by default for a user, kept so it does not change when its status does. */
  const [defaultPick, setDefaultPick] = useState<{ userId: number; id: number | null } | null>(
    null,
  );

  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;
    fetchAllApplications(client).then(
      (applications) => {
        if (cancelled) return;
        setResult({ userId, applications, error: null });
        setDefaultPick((previous) =>
          previous?.userId === userId
            ? previous
            : { userId, id: pickDefault(applications)?.id ?? null },
        );
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

  // Reads the list again but keeps showing the one already loaded until the new one arrives, so the selector, the
  // application card and the archived strip change in place instead of flashing a loading state.
  const refresh = useCallback(() => {
    setReloadTick((tick) => tick + 1);
  }, []);

  const selectApplication = useCallback((id: number) => {
    setSelectedId(id);
    writeSelectedApplicationId(id);
  }, []);

  const value = useMemo<ApplicationValue>(() => {
    const own = result !== null && result.userId === viewUserId ? result : null;
    const status: ApplicationValue['status'] =
      viewUserId === null ? 'idle' : own === null ? 'loading' : own.error ? 'error' : 'ready';
    const applications = own?.applications ?? [];
    const pickedId = defaultPick?.userId === viewUserId ? defaultPick.id : null;
    const current =
      applications.find((a) => a.id === selectedId) ??
      applications.find((a) => a.id === pickedId) ??
      (status === 'ready' ? pickDefault(applications) : null);
    return {
      status,
      error: own?.error ?? null,
      applications,
      currentApplication: current,
      currentApplicationId: current?.id ?? null,
      selectApplication,
      reload,
      refresh,
    };
  }, [result, viewUserId, selectedId, defaultPick, selectApplication, reload, refresh]);

  return <ApplicationContext value={value}>{children}</ApplicationContext>;
}
