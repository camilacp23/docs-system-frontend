// ReportsPage: /reports, "Reports" (S-33 for the Administrator and the Developer, S-33r for the Reader; FR-22, NFR-12).
// The saved reports of the selected application as cards, newest first as the API orders them, 12 per page. The
// Administrator and the Developer can filter ("All · N" / "Published · M", D-136), publish and unpublish a READY report
// (If-Match, D-138), generate again a FAILED one (D-55) and download; the Reader gets only the published reports
// (the API decides), no filter, no switch and no write action. Anyone downloads a READY report with the session token.
// PENDING reports are followed by polling every 3 s (useReportPolling) while the page is open; when one becomes READY a toast
// offers "Download". What a poll or a PUT brings replaces the row without reading the list again (`patches`), and a new
// read of the list starts from the server's copy. A failed call shows a banner; a 412 is the S-44 pattern ("Reload", D-137).
// An archived application does not block anything here: generating and publishing stay allowed (D-47, D-121); only being
// offline disables the writes.
// The generate dialog (S-34) is part of the next change: `afterCreated` is what it calls with the new PENDING report.
import { FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { useApplication } from '../../application/useApplication';
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHeader,
  Pagination,
  SegmentedControl,
  Skeleton,
  SLOW_LOADING_MESSAGE,
  useDelayedLoading,
  useToast,
} from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';
import { useCurrentUser } from '../../session/useCurrentUser';
import { browserTimeZone } from '../audit/auditDates';

import { ReportCard } from './ReportCard';
import { etagOf, isPending, PAGE_SIZES, type Report } from './reportModel';
import type { ReportProblem } from './reportProblem';
import {
  DOWNLOAD_LABEL,
  EMPTY_PUBLISHED_TEXT,
  EMPTY_PUBLISHED_TITLE,
  EMPTY_READER_TEXT,
  EMPTY_READER_TITLE,
  EMPTY_TITLE,
  emptyText,
  FILTER_ALL,
  FILTER_LABEL,
  FILTER_PUBLISHED,
  LIST_LABEL,
  pageDescription,
  READY_TOAST_SUFFIX,
  REGENERATING_TOAST_SUFFIX,
  RELOAD_LABEL,
  REPORTS_TITLE,
  SHOW_ALL_LABEL,
} from './reportTexts';
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

const ICON = { size: 20, strokeWidth: ICON_STROKE_WIDTH } as const;
const GRID = 'grid grid-cols-1 gap-4 @min-[700px]:grid-cols-2 @min-[1000px]:grid-cols-3';

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
  const reader = !canWrite;
  const total = list.data?.total ?? 0;
  const withCount = (label: string, count: number | null | undefined) =>
    typeof count === 'number' ? `${label} · ${count}` : label;
  const filterOptions = [
    { value: 'all', label: withCount(FILTER_ALL, counts.data?.all) },
    { value: 'published', label: withCount(FILTER_PUBLISHED, counts.data?.published) },
  ];

  let body;
  if (list.status === 'error' && list.data === null) {
    body = (
      <ErrorState
        variant="server-error"
        requestId={list.error?.requestId ?? undefined}
        onAction={list.reload}
      />
    );
  } else if (list.data === null) {
    body = showSkeleton ? (
      <ul aria-hidden="true" className={GRID}>
        {[0, 1, 2].map((key) => (
          <li
            key={key}
            className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface p-4"
          >
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-8 w-full" />
          </li>
        ))}
      </ul>
    ) : null;
  } else if (rows.length === 0) {
    body = (
      <div className="rounded-card border border-border-subtle bg-surface shadow-card">
        {reader ? (
          <EmptyState
            icon={<FileText />}
            title={EMPTY_READER_TITLE}
            description={EMPTY_READER_TEXT}
          />
        ) : params.publishedOnly ? (
          <EmptyState
            icon={<FileText />}
            title={EMPTY_PUBLISHED_TITLE}
            description={EMPTY_PUBLISHED_TEXT}
            action={
              <Button
                onClick={() => {
                  setPublishedOnly(false);
                }}
              >
                {SHOW_ALL_LABEL}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<FileText />}
            title={EMPTY_TITLE}
            description={emptyText(currentApplication.name)}
          />
        )}
      </div>
    );
  } else {
    body = (
      <>
        <ul aria-label={LIST_LABEL} className={GRID}>
          {rows.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              canWrite={canWrite}
              timeZone={timeZone}
              timedOut={timedOut.has(report.id)}
              publishing={changing.has(report.id)}
              downloading={downloading.has(report.id)}
              regenerating={regenerating.has(report.id)}
              writeBlockReason={offline.reason}
              onDownload={() => {
                void download(report);
              }}
              onPublishedChange={(next) => {
                void setPublished(report, next);
              }}
              onGenerateAgain={() => {
                void generateAgain(report);
              }}
              onCheckAgain={() => {
                checkAgain(report.id);
              }}
            />
          ))}
        </ul>
        <Pagination
          page={params.page}
          pageSize={params.pageSize}
          total={total}
          pageSizes={PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          disabled={list.loading}
        />
      </>
    );
  }

  return (
    <div className="@container flex flex-col gap-4">
      <PageHeader
        icon={<FileText {...ICON} />}
        title={REPORTS_TITLE}
        description={pageDescription(currentApplication.name, reader)}
        actions={
          canWrite ? (
            <SegmentedControl
              name="report-filter"
              label={FILTER_LABEL}
              options={filterOptions}
              value={params.publishedOnly ? 'published' : 'all'}
              onChange={(value) => {
                setPublishedOnly(value === 'published');
              }}
            />
          ) : undefined
        }
      />
      {notice !== null && (
        <Banner
          tone={notice.kind === 'conflict' ? 'warning' : 'danger'}
          actions={
            notice.kind === 'conflict' ? (
              <Button
                size="sm"
                onClick={() => {
                  setNotice(null);
                  readAgain();
                }}
              >
                {RELOAD_LABEL}
              </Button>
            ) : undefined
          }
          onDismiss={
            notice.kind === 'message'
              ? () => {
                  setNotice(null);
                }
              : undefined
          }
        >
          {notice.text}
        </Banner>
      )}
      {list.error !== null && list.data !== null && (
        <Banner tone="danger">{getErrorMessage(list.error) ?? ''}</Banner>
      )}
      {isSlow && list.data === null && (
        <p role="status" className="text-small text-ink-500">
          {SLOW_LOADING_MESSAGE}
        </p>
      )}
      {body}
    </div>
  );
}
