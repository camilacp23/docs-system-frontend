// ReportsView: the reports page (S-33, S-33r) drawn from what it is given: header with the filter and "Generate report",
// the notice banner, and the cards, the skeleton, the empty state or the error with the pagination.
// It holds no state of its own and reads nothing: ReportsPage gives it the data and the handlers, and the development page
// (/dev/reports) gives it test data so the design can be photographed.
// Props: applicationName, reader (the Reader: no filter, no write action), rows (null until the first read), total, loading
// (a read is in flight), error (the failed read), showSkeleton / isSlow (Table 58), publishedOnly + counts (the filter and its
// numbers, null when unknown), page, pageSize, timeZone, timedOut / publishing / downloading / regenerating (ids), writeBlockReason
// (offline), notice (the banner: a 412 offers "Reload", the rest can be dismissed), the handlers, and children (the dialog).
// Layout (SDD 7.3.7): the cards are in one, two or three columns by the width of the page (container query). The title has no
// icon tile and a list of 12 or fewer has no pagination row, as in S-33.
import { FileText, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ApiError } from '../../api/ApiError';
import { getErrorMessage } from '../../api/messages';
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
} from '../../components/ui';

import { ReportCard } from './ReportCard';
import { PAGE_SIZE, PAGE_SIZES, type Report } from './reportModel';
import type { ReportProblem } from './reportProblem';
import {
  EMPTY_PUBLISHED_TEXT,
  EMPTY_PUBLISHED_TITLE,
  EMPTY_READER_TEXT,
  EMPTY_READER_TITLE,
  EMPTY_TITLE,
  emptyText,
  FILTER_ALL,
  FILTER_LABEL,
  FILTER_PUBLISHED,
  GENERATE_LABEL,
  LIST_LABEL,
  pageDescription,
  RELOAD_LABEL,
  REPORTS_TITLE,
  SHOW_ALL_LABEL,
} from './reportTexts';

export interface ReportsViewProps {
  applicationName: string;
  reader: boolean;
  rows: Report[] | null;
  total: number;
  loading: boolean;
  error: ApiError | null;
  showSkeleton: boolean;
  isSlow: boolean;
  publishedOnly: boolean;
  counts: { all: number | null; published: number | null } | null;
  page: number;
  pageSize: number;
  timeZone: string;
  timedOut: ReadonlySet<number>;
  publishing: ReadonlySet<number>;
  downloading: ReadonlySet<number>;
  regenerating: ReadonlySet<number>;
  writeBlockReason: string | null;
  notice: ReportProblem | null;
  onPublishedOnlyChange: (on: boolean) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onGenerate: () => void;
  onDownload: (report: Report) => void;
  onPublishedChange: (report: Report, next: boolean) => void;
  onGenerateAgain: (report: Report) => void;
  onCheckAgain: (id: number) => void;
  onRetry: () => void;
  onReloadNotice: () => void;
  onDismissNotice: () => void;
  children?: ReactNode;
}

const GRID = 'grid grid-cols-1 gap-4 @min-[700px]:grid-cols-2 @min-[1000px]:grid-cols-3';

const withCount = (label: string, count: number | null | undefined) =>
  typeof count === 'number' ? `${label} · ${count}` : label;

export function ReportsView(props: ReportsViewProps) {
  const { reader, rows, error, applicationName } = props;

  let body: ReactNode;
  if (error !== null && rows === null) {
    body = (
      <ErrorState
        variant="server-error"
        requestId={error.requestId ?? undefined}
        onAction={props.onRetry}
      />
    );
  } else if (rows === null) {
    body = props.showSkeleton ? (
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
        ) : props.publishedOnly ? (
          <EmptyState
            icon={<FileText />}
            title={EMPTY_PUBLISHED_TITLE}
            description={EMPTY_PUBLISHED_TEXT}
            action={
              <Button
                onClick={() => {
                  props.onPublishedOnlyChange(false);
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
            description={emptyText(applicationName)}
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
              canWrite={!reader}
              timeZone={props.timeZone}
              timedOut={props.timedOut.has(report.id)}
              publishing={props.publishing.has(report.id)}
              downloading={props.downloading.has(report.id)}
              regenerating={props.regenerating.has(report.id)}
              writeBlockReason={props.writeBlockReason}
              onDownload={() => {
                props.onDownload(report);
              }}
              onPublishedChange={(next) => {
                props.onPublishedChange(report, next);
              }}
              onGenerateAgain={() => {
                props.onGenerateAgain(report);
              }}
              onCheckAgain={() => {
                props.onCheckAgain(report.id);
              }}
            />
          ))}
        </ul>
        {/* As in the frames, a list that fits in one page of the smallest size has no pagination row. */}
        {props.total > PAGE_SIZE && (
          <Pagination
            page={props.page}
            pageSize={props.pageSize}
            total={props.total}
            pageSizes={PAGE_SIZES}
            onPageChange={props.onPageChange}
            onPageSizeChange={props.onPageSizeChange}
            disabled={props.loading}
          />
        )}
      </>
    );
  }

  const filterOptions = [
    { value: 'all', label: withCount(FILTER_ALL, props.counts?.all) },
    { value: 'published', label: withCount(FILTER_PUBLISHED, props.counts?.published) },
  ];

  return (
    <div className="@container flex flex-col gap-4">
      <PageHeader
        title={REPORTS_TITLE}
        description={pageDescription(applicationName, reader)}
        actions={
          reader ? undefined : (
            <>
              <SegmentedControl
                name="report-filter"
                label={FILTER_LABEL}
                options={filterOptions}
                value={props.publishedOnly ? 'published' : 'all'}
                onChange={(value) => {
                  props.onPublishedOnlyChange(value === 'published');
                }}
              />
              <Button
                variant="primary"
                disabled={props.writeBlockReason !== null}
                title={props.writeBlockReason ?? undefined}
                iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
                onClick={props.onGenerate}
              >
                {GENERATE_LABEL}
              </Button>
            </>
          )
        }
      />
      {props.notice !== null && (
        <Banner
          tone={props.notice.kind === 'conflict' ? 'warning' : 'danger'}
          actions={
            props.notice.kind === 'conflict' ? (
              <Button size="sm" onClick={props.onReloadNotice}>
                {RELOAD_LABEL}
              </Button>
            ) : undefined
          }
          onDismiss={props.notice.kind === 'message' ? props.onDismissNotice : undefined}
        >
          {props.notice.text}
        </Banner>
      )}
      {error !== null && rows !== null && (
        <Banner tone="danger">{getErrorMessage(error) ?? ''}</Banner>
      )}
      {props.isSlow && rows === null && (
        <p role="status" className="text-small text-ink-500">
          {SLOW_LOADING_MESSAGE}
        </p>
      )}
      {body}
      {props.children}
    </div>
  );
}
