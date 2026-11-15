// DashboardView: the indicator dashboard (FR-19, S-31) of the selected application, drawn from the two reads it is given.
// Props: firstName, hour (local hour, for the greeting), applicationName, indicators and top (DashboardSource of the
// two reads: each has its own status, so one can fail while the other stays on screen), refreshing, onRefresh,
// timeZone, canCreateScreen (the action of the empty state: not for the Reader, not for an archived application).
// It holds no state of its own and reads nothing: DashboardPage gives it the data, and the development page
// (/dev/dashboard) gives it test data so the design can be photographed.
// Layout (SDD 7.3.7): it answers to the width of its container: from 900 px the blocks are in two columns as in the
// frame S-31, and the row of figures is one row from 940 px (see KpiCards).
import { ChartPie, Database, History, ListTodo, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

import {
  Banner,
  Button,
  cx,
  ButtonLink,
  EmptyState,
  ICON_STROKE_WIDTH,
  PageHeader,
  SectionCard,
  Skeleton,
} from '../../components/ui';
import { clockOf } from '../audit/auditDates';

import { BlockError, BlockLoading } from './BlockStates';
import {
  AUDIT_HREF,
  firstName,
  greeting,
  isEmptyApplication,
  screensText,
  statusRows,
  syncedText,
} from './dashboardModel';
import {
  ACTIVITY_FAILED_LEAD,
  ACTIVITY_TITLE,
  AUDIT_LINK_TEXT,
  EMPTY_ACTION,
  EMPTY_TITLE,
  emptyText,
  INDICATORS_FAILED_LEAD,
  JIRA_NOTICE_LEAD,
  jiraNoticeText,
  NEW_SCREEN_HREF,
  PENDING_FAILED_LEAD,
  PENDING_SUBTITLE,
  PENDING_TITLE,
  REFRESH_LABEL,
  STATUS_FAILED_LEAD,
  STATUS_TITLE,
} from './dashboardTexts';
import { KpiCards } from './KpiCards';
import { PendingBars } from './PendingBars';
import { RecentActivity } from './RecentActivity';
import { StatusChart } from './StatusChart';
import type { DashboardSource, IndicatorsRead, TopRead } from './useDashboardData';

const CARD_ICON = { size: 16, strokeWidth: ICON_STROKE_WIDTH } as const;
// The skeleton of the row of figures has the same grid as the row (see KpiCards).
const KPI_GRID =
  'grid grid-cols-6 gap-3.5 @min-[940px]:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,1fr))]';
/** From 900 px of container the blocks are in two columns as in S-31; narrower, the status card goes across the page. */
const BLOCKS_GRID =
  'grid grid-cols-2 gap-3.5 @min-[900px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]';

export interface DashboardViewProps {
  name: string;
  hour: number;
  applicationName: string;
  indicators: DashboardSource<IndicatorsRead>;
  top: DashboardSource<TopRead>;
  refreshing: boolean;
  onRefresh: () => void;
  timeZone: string;
  canCreateScreen: boolean;
  /** The role of an Administrator or a Developer: they get the recent activity; the Reader never does (D-34). */
  withActivity: boolean;
}

export function DashboardView({
  name,
  hour,
  applicationName,
  indicators,
  top,
  refreshing,
  onRefresh,
  timeZone,
  canCreateScreen,
  withActivity,
}: DashboardViewProps) {
  const read = indicators.data;
  const loadingIndicators = indicators.status === 'loading';
  const failedIndicators = indicators.status === 'error';
  // The key is absent for a Reader: then there is no card at all. While nothing is read, the role decides.
  const showActivity =
    withActivity && (read === null || read.indicators.recentActivity !== undefined);
  const heading = firstName(name) === '' ? greeting(hour) : `${greeting(hour)}, ${firstName(name)}`;

  // The wrapper is the container the layout answers to (@container): the width of the page, not of the window.
  return (
    <div className="@container flex flex-col gap-4">
      <PageHeader
        title={heading}
        description={`Documentation health of ${applicationName}`}
        actions={
          <>
            {read && (
              <time dateTime={read.readAt} className="text-small font-bold text-ink-500">
                Updated {clockOf(read.readAt, timeZone)}
              </time>
            )}
            <Button
              size="sm"
              iconLeft={<RefreshCw size={16} strokeWidth={ICON_STROKE_WIDTH} />}
              loading={refreshing}
              onClick={onRefresh}
            >
              {REFRESH_LABEL}
            </Button>
          </>
        }
      />

      {failedIndicators ? (
        <BlockError
          lead={INDICATORS_FAILED_LEAD}
          error={indicators.error}
          onRetry={indicators.reload}
        />
      ) : read ? (
        <>
          <KpiCards indicators={read.indicators} timeZone={timeZone} />
          {/* Only what depends on Jira changes, and it is never a global alarm (NFR-14). */}
          {!read.indicators.jira.jiraAvailable && (
            <Banner tone="warning" lead={JIRA_NOTICE_LEAD}>
              {jiraNoticeText(syncedText(read.indicators.jira.lastSyncedAt, timeZone))}
            </Banner>
          )}
        </>
      ) : (
        <BlockLoading loading={loadingIndicators} className="min-h-43.5">
          <div className={KPI_GRID}>
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton
                key={index}
                className={cx(
                  'h-43.5 w-full',
                  index < 3 ? 'col-span-2' : 'col-span-3',
                  '@min-[940px]:col-span-1',
                )}
              />
            ))}
          </div>
        </BlockLoading>
      )}

      <div className={BLOCKS_GRID}>
        <SectionCard
          title={STATUS_TITLE}
          icon={<ChartPie {...CARD_ICON} />}
          description={
            read
              ? `${screensText(read.indicators.documentation.totalScreens)} · App (OnStart) included`
              : undefined
          }
          className="col-span-2 @min-[900px]:col-span-1 @min-[900px]:row-span-2"
        >
          {failedIndicators ? (
            <BlockError
              lead={STATUS_FAILED_LEAD}
              error={indicators.error}
              onRetry={indicators.reload}
            />
          ) : read ? (
            isEmptyApplication(read.indicators) ? (
              <EmptyState
                icon={<Database strokeWidth={ICON_STROKE_WIDTH} />}
                title={EMPTY_TITLE}
                description={emptyText(applicationName)}
                action={
                  canCreateScreen ? (
                    <ButtonLink to={NEW_SCREEN_HREF} variant="primary">
                      {EMPTY_ACTION}
                    </ButtonLink>
                  ) : undefined
                }
              />
            ) : (
              <StatusChart
                rows={statusRows(read.indicators)}
                total={read.indicators.documentation.totalScreens}
              />
            )
          ) : (
            <BlockLoading loading={loadingIndicators} className="min-h-60">
              <Skeleton className="h-55 w-full" />
            </BlockLoading>
          )}
        </SectionCard>

        <SectionCard
          title={PENDING_TITLE}
          icon={<ListTodo {...CARD_ICON} />}
          description={PENDING_SUBTITLE}
        >
          {top.status === 'error' ? (
            <BlockError lead={PENDING_FAILED_LEAD} error={top.error} onRetry={top.reload} />
          ) : top.data ? (
            <PendingBars rows={top.data.screens} />
          ) : (
            <BlockLoading loading={top.status === 'loading'} className="min-h-30">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </BlockLoading>
          )}
        </SectionCard>

        {/* The key is absent for a Reader: then there is no card at all, and no link to the audit log. */}
        {showActivity && (
          <SectionCard
            title={ACTIVITY_TITLE}
            icon={<History {...CARD_ICON} />}
            actions={
              <Link
                to={AUDIT_HREF}
                className="rounded-chip text-[12.5px]/5 font-bold text-primary hover:underline"
              >
                {AUDIT_LINK_TEXT}
              </Link>
            }
          >
            {failedIndicators ? (
              <BlockError
                lead={ACTIVITY_FAILED_LEAD}
                error={indicators.error}
                onRetry={indicators.reload}
              />
            ) : read?.indicators.recentActivity ? (
              <RecentActivity entries={read.indicators.recentActivity} timeZone={timeZone} />
            ) : (
              <BlockLoading loading={loadingIndicators} className="min-h-40">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </BlockLoading>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
