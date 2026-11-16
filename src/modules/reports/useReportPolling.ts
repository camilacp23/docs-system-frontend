// useReportPolling: follows the PENDING reports on screen until each one is READY or FAILED (NFR-12, Figure 27).
// useReportPolling({ ids, onUpdate, onGone }) -> { timedOut: ReadonlySet<number>, checkAgain(id) }
//   ids       the ids of the reports on screen that are PENDING (visible rows or just created); one poller per id.
//   onUpdate  (report, etag): every answer of GET /reports/{id}, with the tag of that answer (the page keeps it for If-Match).
//   onGone    (id): the report is no longer readable (404 or 403): the page reads the list again.
// Rules (D-135): a request every POLL_INTERVAL_MS (3 s) per report, counted from the end of the previous answer, so two
// requests of one report never overlap; the first one a full interval after the report appears (the list was just
// read). The polling of a report stops at READY or FAILED, when the report leaves `ids`, when the page unmounts, and
// after POLL_CAP_MS (180 s) from its start: it is then in `timedOut` and `checkAgain(id)` starts another round.
// A hidden tab stops asking (the timers are cleared and the request in flight is aborted); when it is visible again every
// report is read at once. Every request has its AbortController; each poller counts its requests, and an answer that is
// not of the latest one (aborted, or overtaken after the tab came back) is dropped, so an old answer never replaces a newer one.
// A failed request that is not 404 or 403 (the network) is tried again at the next tick until the cap.
import { useCallback, useEffect, useRef, useState } from 'react';

import { isApiError } from '../../api/ApiError';
import { useApi } from '../../api/useApi';

import { POLL_CAP_MS, POLL_INTERVAL_MS, type ReportDetail } from './reportModel';

interface Poller {
  id: number;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  controller: AbortController | null;
  /** Number of the latest request; an answer of another number is stale. */
  sequence: number;
}

export interface ReportPollingOptions {
  ids: readonly number[];
  onUpdate: (report: ReportDetail, etag: string | null) => void;
  onGone: (id: number) => void;
}

function newPoller(id: number): Poller {
  return { id, startedAt: Date.now(), timer: null, controller: null, sequence: 0 };
}

export function useReportPolling({ ids, onUpdate, onGone }: ReportPollingOptions) {
  const client = useApi();
  const pollers = useRef(new Map<number, Poller>());
  const callbacks = useRef({ onUpdate, onGone });
  // Ids that reached the cap: they are not started again by a change of `ids`, only by checkAgain.
  const gaveUp = useRef(new Set<number>());
  // `poll` schedules itself: the timers call it through this ref.
  const pollRef = useRef<(poller: Poller) => void>(() => undefined);
  const [timedOutIds, setTimedOutIds] = useState<ReadonlySet<number>>(new Set());
  const idsKey = [...ids].sort((a, b) => a - b).join(',');

  useEffect(() => {
    callbacks.current = { onUpdate, onGone };
  });

  const stop = useCallback((poller: Poller) => {
    if (poller.timer !== null) clearTimeout(poller.timer);
    poller.controller?.abort();
    poller.timer = null;
    poller.controller = null;
    if (pollers.current.get(poller.id) === poller) pollers.current.delete(poller.id);
  }, []);

  const poll = useCallback(
    (poller: Poller) => {
      if (pollers.current.get(poller.id) !== poller) return;
      if (poller.timer !== null) clearTimeout(poller.timer);
      poller.timer = null;
      poller.controller?.abort();
      poller.controller = null;
      // A hidden tab does not ask; the visibility handler asks again when the tab is back.
      if (document.visibilityState === 'hidden') return;
      const controller = new AbortController();
      poller.controller = controller;
      const sequence = ++poller.sequence;
      const isCurrent = () =>
        !controller.signal.aborted &&
        sequence === poller.sequence &&
        pollers.current.get(poller.id) === poller;
      const next = () => {
        if (Date.now() - poller.startedAt >= POLL_CAP_MS) {
          stop(poller);
          gaveUp.current.add(poller.id);
          setTimedOutIds((current) => new Set(current).add(poller.id));
          return;
        }
        poller.timer = setTimeout(() => {
          pollRef.current(poller);
        }, POLL_INTERVAL_MS);
      };

      client.get('/reports/{id}', { path: { id: poller.id }, signal: controller.signal }).then(
        (answer) => {
          if (!isCurrent()) return;
          poller.controller = null;
          const report = answer.body.data;
          callbacks.current.onUpdate(report, answer.etag);
          if (report.status === 'PENDING') next();
          else stop(poller);
        },
        (thrown: unknown) => {
          if (!isCurrent()) return;
          poller.controller = null;
          if (isApiError(thrown) && (thrown.status === 404 || thrown.status === 403)) {
            stop(poller);
            callbacks.current.onGone(poller.id);
            return;
          }
          next();
        },
      );
    },
    [client, stop],
  );
  useEffect(() => {
    pollRef.current = poll;
  });

  const start = useCallback(
    (id: number) => {
      const poller = newPoller(id);
      pollers.current.set(id, poller);
      poller.timer = setTimeout(() => {
        poll(poller);
      }, POLL_INTERVAL_MS);
    },
    [poll],
  );

  // One poller per id on screen: started when the id appears, stopped when it leaves.
  useEffect(() => {
    const wanted = new Set(idsKey === '' ? [] : idsKey.split(',').map(Number));
    for (const poller of [...pollers.current.values()]) if (!wanted.has(poller.id)) stop(poller);
    for (const id of [...gaveUp.current]) if (!wanted.has(id)) gaveUp.current.delete(id);
    for (const id of wanted) if (!pollers.current.has(id) && !gaveUp.current.has(id)) start(id);
  }, [idsKey, start, stop]);

  // A hidden tab stops asking; the visible tab reads every report at once.
  useEffect(() => {
    const onVisibility = () => {
      for (const poller of [...pollers.current.values()]) {
        if (document.visibilityState === 'hidden') {
          if (poller.timer !== null) clearTimeout(poller.timer);
          poller.timer = null;
          poller.controller?.abort();
          poller.controller = null;
        } else {
          poll(poller);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [poll]);

  // Nothing keeps running after the page.
  useEffect(() => {
    const live = pollers.current;
    return () => {
      for (const poller of [...live.values()]) stop(poller);
    };
  }, [stop]);

  const checkAgain = useCallback(
    (id: number) => {
      gaveUp.current.delete(id);
      setTimedOutIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      const existing = pollers.current.get(id);
      if (existing) stop(existing);
      const poller = newPoller(id);
      pollers.current.set(id, poller);
      poll(poller);
    },
    [poll, stop],
  );

  const wanted = new Set(ids);
  const timedOut: ReadonlySet<number> = new Set([...timedOutIds].filter((id) => wanted.has(id)));
  return { timedOut, checkAgain };
}
