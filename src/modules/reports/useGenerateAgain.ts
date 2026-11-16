// useGenerateAgain: "Generate again" on a FAILED report (D-55).
// useGenerateAgain({ onCreated, onProblem }) -> { generateAgain(report), busy: ReadonlySet<number> }
//   It reads GET /reports/{id} (the list has no parameters) and sends a NEW POST with those parameters and the same title;
//   the failed report stays in the list. `onCreated(report, etag)` gets the new PENDING report. The parameters are
//   sent as the API stored them (the normalized selection, D-118), which the contract accepts and which asks for exactly
//   the same report. Errors go to onProblem (the catalog texts; a 400 or 404 cannot be pointed at a field here).
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApi } from '../../api/useApi';

import { createReport } from './createReport';
import type { Report } from './reportModel';
import { reportProblem, type ReportProblem } from './reportProblem';

export interface GenerateAgainOptions {
  onCreated: (report: Report, etag: string | null) => void;
  onProblem: (problem: ReportProblem) => void;
}

export function useGenerateAgain(options: GenerateAgainOptions) {
  const client = useApi();
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set());
  const inFlight = useRef(new Set<number>());
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const generateAgain = useCallback(
    async (report: Pick<Report, 'id' | 'applicationId' | 'title'>) => {
      if (inFlight.current.has(report.id)) return;
      inFlight.current.add(report.id);
      setBusy(new Set(inFlight.current));
      try {
        const { body } = await client.get('/reports/{id}', { path: { id: report.id } });
        const { parameters } = body.data;
        const created = await createReport(
          client,
          {
            applicationId: report.applicationId,
            title: report.title,
            scope: parameters.scope,
            publish: parameters.publish,
          },
          parameters.format,
        );
        optionsRef.current.onCreated(created.report, created.etag);
      } catch (thrown) {
        optionsRef.current.onProblem(reportProblem(thrown));
      } finally {
        inFlight.current.delete(report.id);
        setBusy(new Set(inFlight.current));
      }
    },
    [client],
  );

  return { generateAgain, busy };
}
