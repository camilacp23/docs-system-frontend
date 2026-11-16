// useReportPublication: publishes or unpublishes a READY report (PUT /reports/{id}/publication, FR-22, D-121).
// useReportPublication({ etagFor, onChanged, onProblem }) -> { setPublished(report, next), changing: ReadonlySet<number> }
//   If-Match: `etagFor(report)` (the page gives the tag of the latest answer it holds, else the one built from `updatedAt`,
//   D-138). The switch shows what the server holds: nothing changes on screen until the 200 arrives (`onChanged` gets the
//   report and its new ETag), and after a failure the page reads the list again (see reportProblem).
//   Success: a toast (P-06 for publishing). 412 is the S-44 pattern (a banner with "Reload"); 409 REPORT_NOT_READY and 404
//   have their catalog texts. Publishing is allowed in an archived application (D-47, D-121): nothing here reads
//   the archived state.
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApi } from '../../api/useApi';
import { useToast } from '../../components/ui';

import type { Report } from './reportModel';
import { reportProblem, type ReportProblem } from './reportProblem';
import { PUBLISHED_TOAST, UNPUBLISHED_TOAST } from './reportTexts';

export interface ReportPublicationOptions {
  etagFor: (report: Report) => string;
  onChanged: (report: Report, etag: string | null) => void;
  onProblem: (problem: ReportProblem) => void;
}

export function useReportPublication(options: ReportPublicationOptions) {
  const client = useApi();
  const toast = useToast();
  const [changing, setChanging] = useState<ReadonlySet<number>>(new Set());
  const inFlight = useRef(new Set<number>());
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const setPublished = useCallback(
    async (report: Report, next: boolean) => {
      if (inFlight.current.has(report.id)) return;
      inFlight.current.add(report.id);
      setChanging(new Set(inFlight.current));
      try {
        const answer = await client.put('/reports/{id}/publication', {
          path: { id: report.id },
          ifMatch: optionsRef.current.etagFor(report),
          body: { isPublished: next },
        });
        optionsRef.current.onChanged(answer.body.data, answer.etag);
        toast.show({ message: next ? PUBLISHED_TOAST : UNPUBLISHED_TOAST });
      } catch (thrown) {
        optionsRef.current.onProblem(reportProblem(thrown));
      } finally {
        inFlight.current.delete(report.id);
        setChanging(new Set(inFlight.current));
      }
    },
    [client, toast],
  );

  return { setPublished, changing };
}
