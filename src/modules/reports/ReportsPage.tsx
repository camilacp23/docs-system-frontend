// ReportsPage: /reports (the view is ReportsView), "Reports" (S-33 for the Administrator and the Developer, S-33r for the Reader; FR-22, NFR-12).
// The saved reports of the selected application as cards, newest first as the API orders them, 12 per page. The
// Administrator and the Developer can filter ("All · N" / "Published · M", D-136), publish and unpublish a READY report
// (If-Match, D-138), generate again a FAILED one (D-55) and download; the Reader gets only the published reports
// (the API decides), no filter, no switch and no write action. Anyone downloads a READY report with the session token.
// PENDING reports are followed by polling every 3 s (useReportPolling) while the page is open; when one becomes READY a toast
// offers "Download". What a poll or a PUT brings replaces the row without reading the list again (`patches`), and a new
// read of the list starts from the server's copy. A failed call shows a banner; a 412 is the S-44 pattern ("Reload", D-137).
// An archived application does not block anything here: generating and publishing stay allowed (D-47, D-121); only being
// offline disables the writes.
// "Generate report" opens the dialog of S-34 (GenerateReportModal, the same one the dashboard uses); after the 202 the page
// goes back to All, page 1 and reads the list, so the new PENDING report is on screen and the polling follows it (D-141).
import { useEffect, useRef, useState } from 'react';

import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { useApplication } from '../../application/useApplication';
import { useDelayedLoading, useToast } from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';
import { useCurrentUser } from '../../session/useCurrentUser';
import { browserTimeZone } from '../audit/auditDates';

import { GenerateReportModal } from './GenerateReportModal';
import { etagOf, isPending, type Report } from './reportModel';
import type { ReportProblem } from './reportProblem';
import { DOWNLOAD_LABEL, READY_TOAST_SUFFIX, REGENERATING_TOAST_SUFFIX } from './reportTexts';
import { ReportsView } from './ReportsView';
import { useGenerateAgain } from './useGenerateAgain';
import { useReportCounts } from './useReportCounts';
import { useReportDownload } from './useReportDownload';
import { useReportListParams } from './useReportListParams';
import { useReportPolling } from './useReportPolling';
import { useReportPublication } from './useReportPublication';

interface Patch {
  report: Report;
  etag: string | null;
}

interface ListRead {
  rows: Report[];
  total: number;
}

export function ReportsPage() {
  const client = useApi();
  const toast = useToast();
  const me = useCurrentUser();
  const { currentApplication, currentApplicationId } = useApplication();
  const offline = useOfflineBlock();
  const canWrite = me !== null && me.role !== 'READER';
  const { params, setPublishedOnly, setPage, setPageSize, reset } = useReportListParams(canWrite);
  const timeZone = browserTimeZone();

  const query = {
    applicationId: currentApplicationId ?? 0,
    page: params.page,
    pageSize: params.pageSize,
    ...(params.publishedOnly && { published: true }),
  };
  const list = useApiResource<ListRead>(
    `reports:${JSON.stringify(query)}`,
    async (signal) => {
      const { body } = await client.get('/reports', { query, signal });
      return { body: { rows: body.data, total: body.total }, etag: null };
    },
    currentApplicationId !== null,
  );
  const counts = useReportCounts(currentApplicationId, canWrite);
  const { showSkeleton, isSlow } = useDelayedLoading(list.loading && list.data === null);

  // What a poll, a PUT or a new report brought, by id. It belongs to the copy of the list it was made on: a new read of the
  // list replaces it.
  const [patchState, setPatchState] = useState<{
    base: ListRead | null;
    map: Record<number, Patch>;
  }>({
    base: null,
    map: {},
  });
  const baseRef = useRef<ListRead | null>(null);
  useEffect(() => {
    baseRef.current = list.data;
  });
  const patches = patchState.base === list.data ? patchState.map : {};
  const rows = (list.data?.rows ?? []).map((row) => patches[row.id]?.report ?? row);
  const rowsRef = useRef<Report[]>(rows);
  useEffect(() => {
    rowsRef.current = rows;
  });

  const patch = (report: Report, etag: string | null) => {
    setPatchState((current) => ({
      base: baseRef.current,
      map: {
        ...(current.base === baseRef.current ? current.map : {}),
        [report.id]: { report, etag },
      },
    }));
  };
  const etagFor = (report: Report) => patches[report.id]?.etag ?? etagOf(report);

  const [notice, setNotice] = useState<ReportProblem | null>(null);
  const [generating, setGenerating] = useState(false);
  const readAgain = () => {
    list.reload();
    counts.reload();
  };
  const onProblem = (problem: ReportProblem) => {
    setNotice(problem);
    if (problem.reload) readAgain();
  };

  const { download, downloading } = useReportDownload({ onProblem });
  const { setPublished, changing } = useReportPublication({
    etagFor,
    onChanged: (report, etag) => {
      patch(report, etag);
      counts.reload();
    },
    onProblem,
  });

  /** A report was requested (the dialog or "Generate again"): All, page 1, and the new PENDING report appears (D-141). */
  const afterCreated = () => {
    setNotice(null);
    reset();
    readAgain();
  };
  const { generateAgain, busy: regenerating } = useGenerateAgain({
    onCreated: (report) => {
      afterCreated();
      toast.show({
        message: (
          <>
            <strong>{report.title}</strong>
            {REGENERATING_TOAST_SUFFIX}
          </>
        ),
      });
    },
    onProblem,
  });

  const pendingIds = rows.filter(isPending).map((row) => row.id);
  const { timedOut, checkAgain } = useReportPolling({
    ids: pendingIds,
    onUpdate: (report, etag) => {
      const before = rowsRef.current.find((row) => row.id === report.id);
      // Still the same report (same status and same updatedAt): nothing to draw again.
      if (before?.status === report.status && before.updatedAt === report.updatedAt) return;
      patch(report, etag);
      if (before?.status === 'PENDING' && report.status !== 'PENDING') counts.reload();
      if (before?.status === 'PENDING' && report.status === 'READY') {
        toast.show({
          message: (
            <>
              <strong>{report.title}</strong>
              {READY_TOAST_SUFFIX}
            </>
          ),
          action: {
            label: DOWNLOAD_LABEL,
            onClick: () => {
              void download(report);
            },
          },
        });
      }
    },
    onGone: () => {
      readAgain();
    },
  });

  if (currentApplication === null) return null;

  return (
    <ReportsView
      applicationName={currentApplication.name}
      reader={!canWrite}
      rows={list.data === null ? null : rows}
      total={list.data?.total ?? 0}
      loading={list.loading}
      error={list.error}
      showSkeleton={showSkeleton}
      isSlow={isSlow}
      publishedOnly={params.publishedOnly}
      counts={counts.data}
      page={params.page}
      pageSize={params.pageSize}
      timeZone={timeZone}
      timedOut={timedOut}
      publishing={changing}
      downloading={downloading}
      regenerating={regenerating}
      writeBlockReason={offline.reason}
      notice={notice}
      onPublishedOnlyChange={setPublishedOnly}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      onGenerate={() => {
        setGenerating(true);
      }}
      onDownload={(report) => {
        void download(report);
      }}
      onPublishedChange={(report, next) => {
        void setPublished(report, next);
      }}
      onGenerateAgain={(report) => {
        void generateAgain(report);
      }}
      onCheckAgain={checkAgain}
      onRetry={list.reload}
      onReloadNotice={() => {
        setNotice(null);
        readAgain();
      }}
      onDismissNotice={() => {
        setNotice(null);
      }}
    >
      {generating && (
        <GenerateReportModal
          applicationId={currentApplication.id}
          applicationName={currentApplication.name}
          onClose={() => {
            setGenerating(false);
          }}
          onCreated={() => {
            setGenerating(false);
            afterCreated();
          }}
        />
      )}
    </ReportsView>
  );
}
