// ReportsPreview: development page /dev/reports. It draws the reports page (ReportsView) and the generate dialog
// (GenerateReportModal) over the sample data of the frames S-33, S-33r, S-34, P-05 and P-06 inside the static shell of the
// frames, with no session and no API (a small fake client answers the screen search and the 202), so the design can be looked
// at and photographed in every state.
// Query: role=admin (default, S-33) | reader (S-33r); toast=ready (the toast of S-33, "<report> is ready." with Download) |
// published (P-06: the third card is published and the toast says so); dialog=1 (the dialog open over the list, S-34);
// banner=conflict (the 412 banner) | banner=error.
// The list works: the switches publish and unpublish, "Generate report" opens the dialog and its 202 puts the new report first,
// PENDING (P-05). Like /dev/ui and /dev/dashboard it only exists in development (see devRoutes.ts).
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import type { ApiClient } from '../api/client';
import { ApiContext } from '../api/useApi';
import { useToast } from '../components/ui';
import { GenerateReportModal } from '../modules/reports/GenerateReportModal';
import type { Report } from '../modules/reports/reportModel';
import type { ReportProblem } from '../modules/reports/reportProblem';
import { ReportsView } from '../modules/reports/ReportsView';

import { MockShell } from './MockShell';

const NO_IDS: ReadonlySet<number> = new Set();
const NO_OP = () => undefined;
const ZONE = 'America/Costa_Rica';

function sample(id: number, overrides: Partial<Report>): Report {
  return {
    id,
    applicationId: 1,
    title: 'Report',
    format: 'PDF',
    status: 'READY',
    isPublished: false,
    fileName: 'report-2026-10-05.pdf',
    fileSize: 412 * 1024,
    errorMessage: null,
    generatedBy: { id: 1, name: 'Camila Castillo' },
    createdAt: '2026-10-05T14:00:00.000Z',
    updatedAt: '2026-10-05T15:01:00.000Z',
    completedAt: '2026-10-05T15:01:00.000Z',
    publishedAt: null,
    ...overrides,
  };
}

/** The five reports of the frames, newest first. */
function frameReports(): Report[] {
  return [
    sample(5, {
      title: 'Screens in review — weekly',
      status: 'PENDING',
      fileName: null,
      fileSize: null,
      completedAt: null,
    }),
    sample(4, {
      title: 'SAR documentation status',
      isPublished: true,
      publishedAt: '2026-10-05T15:01:00.000Z',
    }),
    sample(3, {
      title: 'Variables and collections',
      format: 'XLSX',
      generatedBy: { id: 2, name: 'Sample Developer A' },
      fileSize: 96 * 1024,
      completedAt: '2026-10-04T22:11:00.000Z',
    }),
    sample(2, {
      title: 'Full export with dependencies',
      format: 'XLSX',
      status: 'FAILED',
      generatedBy: { id: 3, name: 'Sample Developer B' },
      fileName: null,
      fileSize: null,
      completedAt: null,
      errorMessage: 'The report took too long to generate. Try again with a smaller selection.',
    }),
    sample(1, {
      title: 'Collections and fields',
      format: 'XLSX',
      generatedBy: { id: 2, name: 'Sample Developer A' },
      isPublished: true,
      publishedAt: '2026-10-02T20:20:00.000Z',
      fileSize: 58 * 1024,
      completedAt: '2026-10-02T20:20:00.000Z',
    }),
  ];
}

const SCREENS = ['App (OnStart)', 'Inicio', 'Detalle', 'Busqueda', 'Reportes'].map(
  (name, index) => ({
    id: 10 + index,
    applicationId: 1,
    name,
    isAppContext: index === 0,
    documentationStatus: 'DRAFT',
    author: { id: 1, name: 'Camila Castillo' },
    pendingSubtasks: 0,
    commentCount: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  }),
);

export function ReportsPreview() {
  const [params] = useSearchParams();
  const toast = useToast();
  const reader = params.get('role') === 'reader';
  const [reports, setReports] = useState<Report[]>(() => {
    const start = frameReports();
    // P-06: the third card has just been published.
    return params.get('toast') === 'published'
      ? start.map((report) =>
          report.id === 3
            ? { ...report, isPublished: true, publishedAt: '2026-10-05T16:00:00.000Z' }
            : report,
        )
      : start;
  });
  const [generating, setGenerating] = useState(params.get('dialog') === '1');
  const nextId = useRef(100);
  const toastShown = useRef(false);

  const client = {
    get: (_path: string, options?: { query?: { q?: string } }) => {
      const q = options?.query?.q?.toLowerCase() ?? '';
      const found = SCREENS.filter((screen) => screen.name.toLowerCase().includes(q));
      return Promise.resolve({
        body: { data: found, page: 1, pageSize: 20, total: found.length },
        status: 200,
        etag: null,
        location: null,
      });
    },
    post: (path: string, options?: { body?: { title: string } }) => {
      const id = nextId.current++;
      const created = sample(id, {
        title: options?.body?.title ?? 'New report',
        format: path.endsWith('pdf') ? 'PDF' : 'XLSX',
        status: 'PENDING',
        fileName: null,
        fileSize: null,
        completedAt: null,
      });
      return Promise.resolve({ body: { data: created }, status: 202, etag: null, location: null });
    },
  } as unknown as ApiClient;

  // The toasts of the frames, kept on screen so they can be photographed.
  useEffect(() => {
    // The development server runs every effect twice: the toast is shown once.
    if (toastShown.current) return;
    toastShown.current = true;
    const kind = params.get('toast');
    if (kind === 'ready') {
      toast.show({
        message: (
          <>
            <strong>SAR documentation status</strong> is ready.
          </>
        ),
        action: { label: 'Download' },
        duration: null,
      });
    }
    if (kind === 'published') {
      toast.show({ message: 'Published. Readers can now see this report.', duration: null });
    }
    // Once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const banner = params.get('banner');
  const notice: ReportProblem | null =
    banner === 'conflict'
      ? {
          kind: 'conflict',
          text: 'Someone else saved changes to this report after you opened it. Reload to see their version.',
          reload: true,
        }
      : banner === 'error'
        ? {
            kind: 'message',
            text: 'Only ready reports can be published or downloaded.',
            reload: true,
          }
        : null;

  const shown = reader ? reports.filter((report) => report.isPublished) : reports;
  const published = reports.filter((report) => report.isPublished).length;

  return (
    <MockShell
      activeLabel="Reports"
      pageName="Reports"
      role={reader ? 'READER' : 'ADMINISTRATOR'}
      user={
        reader
          ? { name: 'Sample Reader', roleLabel: 'Reader' }
          : { name: 'Camila Castillo', roleLabel: 'Administrator' }
      }
    >
      <ApiContext value={client}>
        <ReportsView
          applicationName="SAR"
          reader={reader}
          rows={shown}
          total={shown.length}
          loading={false}
          error={null}
          showSkeleton={false}
          isSlow={false}
          publishedOnly={false}
          counts={{ all: reports.length, published }}
          page={1}
          pageSize={12}
          timeZone={ZONE}
          timedOut={NO_IDS}
          publishing={NO_IDS}
          downloading={NO_IDS}
          regenerating={NO_IDS}
          writeBlockReason={null}
          notice={notice}
          onPublishedOnlyChange={NO_OP}
          onPageChange={NO_OP}
          onPageSizeChange={NO_OP}
          onGenerate={() => {
            setGenerating(true);
          }}
          onDownload={NO_OP}
          onPublishedChange={(report, next) => {
            setReports((current) =>
              current.map((item) =>
                item.id === report.id
                  ? {
                      ...item,
                      isPublished: next,
                      publishedAt: next ? '2026-10-05T16:00:00.000Z' : null,
                    }
                  : item,
              ),
            );
          }}
          onGenerateAgain={NO_OP}
          onCheckAgain={NO_OP}
          onRetry={NO_OP}
          onReloadNotice={NO_OP}
          onDismissNotice={NO_OP}
        >
          {generating && (
            <GenerateReportModal
              applicationId={1}
              applicationName="SAR"
              onClose={() => {
                setGenerating(false);
              }}
              onCreated={(report) => {
                setGenerating(false);
                setReports((current) => [report, ...current]);
              }}
            />
          )}
        </ReportsView>
      </ApiContext>
    </MockShell>
  );
}
