// AuditLogPage: /audit, "Audit log" (S-32, S-32d, S-32f; FR-20, FR-21, NFR-20). The Administrator sees every
// record; the Developer only their own actions (the API enforces it, NFR-03); the Reader gets S-41b from the route
// guard. Read-only: the page writes nothing.
// A timeline grouped by local day (AuditTimeline) with the filter bar above it (AuditFilters), the "This period"
// totals at the side (AuditTotals) and the pagination under the timeline. Every filter, the page and its size live in
// the URL (useAuditListParams). Without dates the page applies Last 7 days and writes it to the URL. The days are the
// browser's: "from" is the start of its day and "to" the end of its day, sent as ISO instants (auditDates).
// An upside-down range is marked on "To" and nothing is asked; the API's 400 (`required` on the element type, `range`
// on "to", `format`) is marked on the field it names. A Developer who opens a link to another user's actions gets
// 403 OWN_ACTIONS: a message and "Show my actions". An empty page is S-40b with "Clear filters", a failed read is the
// server error state inside the card (the totals and the rest of the page are not affected, S-41c).
// While an application filter is on, the records of rows deleted in cascade (no application, D-108) are not
// listed: the foot of the card says so and points to "All applications".
import { History } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';

import { getFieldErrors, getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { useApplication } from '../../application/useApplication';
import { HOME_PATH, ROLE_LABEL } from '../../app/router/routes';
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHeader,
  Pagination,
  SLOW_LOADING_MESSAGE,
  useDelayedLoading,
} from '../../components/ui';
import { useCurrentUser } from '../../session/useCurrentUser';

import { AuditFilters, type AuditControl } from './AuditFilters';
import { AuditTimeline } from './AuditTimeline';
import { AuditTotals } from './AuditTotals';
import {
  browserTimeZone,
  presetOf,
  presetRange,
  rangeError,
  todayIn,
  zonedDay,
} from './auditDates';
import type { AuditEntry, AuditQuery } from './auditLabels';
import { useAuditListParams } from './useAuditListParams';

export const OWN_ACTIONS_TEXT = 'You can only see your own actions.';
export const CASCADE_NOTE =
  'Rows removed together with their element carry no application. Choose "All applications" to find them.';

/** The control of the filter bar that each field of the API's 400 belongs to. */
const CONTROL_OF_FIELD: Record<string, AuditControl> = {
  entityType: 'type',
  entityId: 'entityId',
  actorUserId: 'actor',
  action: 'action',
  from: 'date',
  to: 'date',
};

const FIELD_LABELS: Record<string, string> = {
  entityType: 'Element type',
  entityId: 'Element id',
  actorUserId: 'User',
  action: 'Action',
  from: 'From',
  to: 'To',
};

function isOwnActions(error: { code: string; details?: Record<string, unknown> | null } | null) {
  return error?.code === 'FORBIDDEN' && error.details?.reason === 'OWN_ACTIONS';
}

export function AuditLogPage() {
  const client = useApi();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const { currentApplication, currentApplicationId } = useApplication();
  const { params, setParams, clearFilters, hasFilters } = useAuditListParams();
  const isDeveloper = me?.role === 'DEVELOPER';

  const timeZone = useMemo(() => browserTimeZone(), []);
  const today = useMemo(() => todayIn(timeZone), [timeZone]);

  const hasRange = params.from !== '' || params.to !== '';
  const range = hasRange ? { from: params.from, to: params.to } : presetRange('last7', today);
  useEffect(() => {
    // Last 7 days is the default and the URL says so, so the view can be shared as it is.
    if (!hasRange) setParams({ from: range.from, to: range.to }, { replace: true });
  }, [hasRange, range.from, range.to, setParams]);

  const orderError = rangeError(range.from, range.to);
  const applicationId = params.application === 'all' ? null : currentApplicationId;
  // Nothing is asked until the application is known: a first read without it would list every application.
  const canAsk = orderError === null && (params.application === 'all' || applicationId !== null);

  // What the timeline and the totals share; the totals add their own page size and action.
  const base: Omit<AuditQuery, 'page' | 'pageSize' | 'action'> = {
    ...(applicationId !== null && { applicationId }),
    ...(params.type !== '' && { entityType: params.type }),
    ...(params.entityId !== '' && { entityId: params.entityId }),
    ...(params.actor !== '' && { actorUserId: Number(params.actor) }),
    ...(range.from !== '' && { from: zonedDay(range.from, 'start', timeZone) }),
    ...(range.to !== '' && { to: zonedDay(range.to, 'end', timeZone) }),
  };
  const query: AuditQuery = {
    ...base,
    ...(params.action !== '' && { action: params.action }),
    page: params.page,
    pageSize: params.pageSize,
  };

  const list = useApiResource<{ rows: AuditEntry[]; total: number }>(
    `audit:${JSON.stringify(query)}`,
    async (signal) => {
      const { body } = await client.get('/audit-log', { query, signal });
      return { body: { rows: body.data, total: body.total }, etag: null };
    },
    canAsk,
  );
  const { showSkeleton, isSlow } = useDelayedLoading(list.loading && orderError === null);

  const error = list.error;
  const fieldErrors: Partial<Record<AuditControl, string>> = {};
  if (error?.code === 'VALIDATION_ERROR') {
    for (const fieldError of getFieldErrors(error, FIELD_LABELS)) {
      const control = CONTROL_OF_FIELD[fieldError.field];
      if (control !== undefined) fieldErrors[control] ??= fieldError.message;
    }
  }
  if (orderError !== null) fieldErrors.date = orderError;

  const forbidden = error?.code === 'FORBIDDEN';
  const ownActions = isOwnActions(error);
  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const rangeIsDefault = presetOf(range.from, range.to, today) === 'last7';
  const canClear = hasFilters || !rangeIsDefault;

  const applicationName =
    params.application === 'all' ? 'all applications' : (currentApplication?.name ?? null);
  const description = isDeveloper
    ? `Your actions in ${applicationName ?? 'this application'}, read-only. Developers see only their own actions. Click an event to see what changed.`
    : `Every change recorded in ${applicationName ?? 'this application'}, read-only. Click an event to see what changed.`;

  let content;
  if (orderError !== null) {
    content = null;
  } else if (ownActions) {
    content = (
      <div className="p-5">
        <Banner
          tone="warning"
          actions={
            <Button
              size="sm"
              onClick={() => {
                setParams({ actor: '' });
              }}
            >
              Show my actions
            </Button>
          }
        >
          {OWN_ACTIONS_TEXT}
        </Banner>
      </div>
    );
  } else if (forbidden) {
    content = (
      <ErrorState
        variant="no-access"
        roleName={me ? ROLE_LABEL[me.role] : 'current'}
        className="py-14"
        onAction={() => void navigate(HOME_PATH)}
      />
    );
  } else if (error?.code === 'VALIDATION_ERROR') {
    content = (
      <div className="p-5">
        <Banner tone="danger">{getThrownMessage(error)}</Banner>
      </div>
    );
  } else if (list.status === 'error') {
    content = (
      <ErrorState
        variant="server-error"
        requestId={error?.requestId ?? undefined}
        className="py-14"
        onAction={list.reload}
      />
    );
  } else if (list.status === 'ready' && total === 0) {
    content = (
      <EmptyState
        icon={<History strokeWidth={ICON_STROKE_WIDTH} />}
        title="No results"
        description="No records match these filters."
        action={
          canClear ? (
            <Button variant="primary" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    content = (
      <>
        <AuditTimeline
          entries={rows}
          timeZone={timeZone}
          today={today}
          ownView={isDeveloper}
          loading={list.loading}
          showSkeleton={showSkeleton}
        />
        {isSlow && (
          <p className="px-5 py-3 text-small text-ink-500" role="status">
            {SLOW_LOADING_MESSAGE}
          </p>
        )}
      </>
    );
  }

  const showPagination = list.status === 'ready' && total > 0 && !forbidden;

  return (
    <>
      <PageHeader
        icon={<History size={20} strokeWidth={ICON_STROKE_WIDTH} />}
        title="Audit log"
        description={description}
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section
          aria-label="Audit records"
          className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card"
        >
          <AuditFilters
            params={params}
            setParams={setParams}
            range={range}
            today={today}
            applicationName={currentApplication?.name ?? null}
            isDeveloper={isDeveloper}
            errors={fieldErrors}
          />
          {content}
          {showPagination && (
            <Pagination
              page={params.page}
              pageSize={params.pageSize}
              total={total}
              disabled={list.loading}
              onPageChange={(page) => {
                setParams({ page });
              }}
              onPageSizeChange={(pageSize) => {
                setParams({ pageSize });
              }}
            />
          )}
          {applicationId !== null && list.status !== 'error' && (
            <p className="border-t border-divider px-5 py-3 text-small text-ink-500">
              {CASCADE_NOTE}
            </p>
          )}
        </section>
        {!forbidden && (
          <AuditTotals
            base={base}
            enabled={canAsk}
            action={params.action}
            onPickAction={(action) => {
              setParams({ action });
            }}
          />
        )}
      </div>
    </>
  );
}
