// useReportDownload: downloads the file of a READY report with the session token (GET /reports/{id}/file).
// useReportDownload({ onProblem }) -> { download(report), downloading: ReadonlySet<number> }
//   A plain link could not carry the access token (it lives only in memory), so the file is read with the API client
//   (token, single refresh on a 401) as a Blob and handed to the browser through an object URL on a temporary link.
//   The name is the one of Content-Disposition (D-120), else the report's `fileName`. The object URL is revoked right
//   after the browser took the click (REVOKE_DELAY_MS), so the bytes do not stay in memory.
//   A failure goes to onProblem(problem): 409 REPORT_NOT_READY and 404 with their catalog texts (see reportProblem).
//   One download per report at a time: `downloading` holds the ids in flight.
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApi } from '../../api/useApi';

import { downloadName, type Report } from './reportModel';
import { reportProblem, type ReportProblem } from './reportProblem';

export const REVOKE_DELAY_MS = 1000;

export function useReportDownload({ onProblem }: { onProblem: (problem: ReportProblem) => void }) {
  const client = useApi();
  const [downloading, setDownloading] = useState<ReadonlySet<number>>(new Set());
  const inFlight = useRef(new Set<number>());
  const problemRef = useRef(onProblem);
  useEffect(() => {
    problemRef.current = onProblem;
  });

  const download = useCallback(
    async (report: Pick<Report, 'id' | 'format' | 'fileName'>) => {
      if (inFlight.current.has(report.id)) return;
      inFlight.current.add(report.id);
      setDownloading(new Set(inFlight.current));
      try {
        const file = await client.download('/reports/{id}/file', { path: { id: report.id } });
        const url = URL.createObjectURL(file.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadName(file.contentDisposition, report.fileName, report.format);
        link.hidden = true;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, REVOKE_DELAY_MS);
      } catch (thrown) {
        problemRef.current(reportProblem(thrown));
      } finally {
        inFlight.current.delete(report.id);
        setDownloading(new Set(inFlight.current));
      }
    },
    [client],
  );

  return { download, downloading };
}
