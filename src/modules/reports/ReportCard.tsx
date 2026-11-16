// ReportCard: one saved report of the list (S-33, S-33r, P-05, P-06).
// Props: report (a list row), canWrite (Administrator or Developer: the switch and "Generate again"; the Reader sees the
// published date instead), timeZone, timedOut (the polling reached its cap), publishing / downloading / regenerating
// (a call on this report is in flight), writeBlockReason (why a write is off now: offline; an archived application is NOT a
// reason, D-47 and D-121), onDownload, onPublishedChange(next), onGenerateAgain, onCheckAgain.
// Body by status: PENDING "Building in the background" with a bar (or, after the cap, "Still generating..." and "Check
// again"); READY "Completed Oct 5 · 09:01 · 412 KB"; FAILED the `errorMessage` of the API as it comes (one of four fixed texts).
// Footer: the "Published" switch (off with its reason while PENDING or FAILED) and "Download", or "Generate again" when
// FAILED. A hidden polite status line announces each state to assistive technology.
import { Download, RotateCw } from 'lucide-react';

import { Button, ICON_STROKE_WIDTH, Switch, Tag, type TagTone } from '../../components/ui';

import { completedText, publishedDay, type Report } from './reportModel';
import {
  BUILDING_TEXT,
  CHECK_AGAIN_LABEL,
  DOWNLOAD_LABEL,
  FORMAT_LABEL,
  FORMAT_TILE,
  GENERATE_AGAIN_LABEL,
  NOT_PUBLISHED_LABEL,
  PUBLISH_DISABLED_FAILED,
  PUBLISH_DISABLED_PENDING,
  PUBLISHED_LABEL,
  STATUS_LABEL,
  STILL_GENERATING_TEXT,
} from './reportTexts';

export interface ReportCardProps {
  report: Report;
  canWrite: boolean;
  timeZone: string;
  timedOut: boolean;
  publishing: boolean;
  downloading: boolean;
  regenerating: boolean;
  writeBlockReason: string | null;
  onDownload: () => void;
  onPublishedChange: (next: boolean) => void;
  onGenerateAgain: () => void;
  onCheckAgain: () => void;
}

const STATUS_TONE: Record<Report['status'], TagTone> = {
  PENDING: 'info',
  READY: 'success',
  FAILED: 'danger',
};

const FORMAT_TILE_CLASS: Record<Report['format'], string> = {
  PDF: 'bg-danger-bg text-danger',
  XLSX: 'bg-success-bg text-success-ink',
};

function Dot() {
  return <span className="size-1.5 rounded-pill bg-current" />;
}

export function ReportCard({
  report,
  canWrite,
  timeZone,
  timedOut,
  publishing,
  downloading,
  regenerating,
  writeBlockReason,
  onDownload,
  onPublishedChange,
  onGenerateAgain,
  onCheckAgain,
}: ReportCardProps) {
  const { status } = report;
  const publishedOn = publishedDay(report, timeZone);
  const announcement =
    status === 'FAILED'
      ? `${report.title}: ${STATUS_LABEL.FAILED}. ${report.errorMessage ?? ''}`
      : `${report.title}: ${STATUS_LABEL[status]}.`;

  const switchReason =
    status === 'PENDING'
      ? PUBLISH_DISABLED_PENDING
      : status === 'FAILED'
        ? PUBLISH_DISABLED_FAILED
        : (writeBlockReason ?? undefined);
  const switchOff = status !== 'READY' || writeBlockReason !== null;

  return (
    <li className="flex flex-col rounded-card border border-border-subtle bg-surface shadow-card">
      <div className="flex gap-3 p-4">
        <div
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-control font-mono text-micro font-bold ${FORMAT_TILE_CLASS[report.format]}`}
        >
          {FORMAT_TILE[report.format]}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-body font-bold [overflow-wrap:anywhere] text-ink-900">
              {report.title}
            </h3>
            {canWrite || status !== 'READY' ? (
              <Tag tone={STATUS_TONE[status]} icon={<Dot />}>
                {STATUS_LABEL[status]}
              </Tag>
            ) : (
              <Tag tone="success" icon={<Dot />}>
                {PUBLISHED_LABEL}
              </Tag>
            )}
          </div>
          <p className="text-small text-ink-500">
            <span className="sr-only">{FORMAT_LABEL[report.format]} report by </span>
            {report.generatedBy.name}
          </p>

          {status === 'PENDING' && !timedOut && (
            <div className="mt-1 flex flex-col gap-1.5">
              <div aria-hidden="true" className="h-1 overflow-hidden rounded-pill bg-disabled-bg">
                <div className="h-full w-1/3 rounded-pill bg-accent" />
              </div>
              <p className="text-small text-ink-500">{BUILDING_TEXT}</p>
            </div>
          )}
          {status === 'PENDING' && timedOut && (
            <div className="mt-1 flex flex-col items-start gap-1.5">
              <p className="text-small text-ink-700">{STILL_GENERATING_TEXT}</p>
              <Button size="sm" variant="ghost" onClick={onCheckAgain}>
                {CHECK_AGAIN_LABEL}
              </Button>
            </div>
          )}
          {status === 'READY' && (
            <p className="text-small text-ink-500">{completedText(report, timeZone)}</p>
          )}
          {status === 'FAILED' && report.errorMessage !== null && (
            <p className="text-small text-danger">{report.errorMessage}</p>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-divider px-4 py-3">
        {canWrite ? (
          <Switch
            checked={report.isPublished}
            label={report.isPublished ? PUBLISHED_LABEL : NOT_PUBLISHED_LABEL}
            disabled={switchOff}
            disabledReason={switchReason}
            loading={publishing}
            onChange={onPublishedChange}
          />
        ) : (
          <p className="text-small text-ink-500">
            {publishedOn !== null ? `${PUBLISHED_LABEL} ${publishedOn}` : ''}
          </p>
        )}
        {status === 'FAILED' ? (
          canWrite && (
            <Button
              size="sm"
              loading={regenerating}
              disabled={writeBlockReason !== null}
              title={writeBlockReason ?? undefined}
              iconLeft={<RotateCw aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
              onClick={onGenerateAgain}
            >
              {GENERATE_AGAIN_LABEL}
            </Button>
          )
        ) : (
          <Button
            size="sm"
            loading={downloading}
            disabled={status !== 'READY'}
            iconLeft={<Download aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            aria-label={`${DOWNLOAD_LABEL} ${report.title}`}
            onClick={onDownload}
          >
            {DOWNLOAD_LABEL}
          </Button>
        )}
      </div>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </li>
  );
}
