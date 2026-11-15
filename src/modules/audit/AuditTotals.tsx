// AuditTotals: the "This period" panel of the audit log (S-32): the number of records and how many were created,
// updated, deleted or were events, with the SAME filters as the timeline (except the action, which is what the figures
// split by). Each figure is the `total` of GET /audit-log with pageSize=1 (and `action` for the four of the actions).
// Props: base (the query of the timeline without page, pageSize and action), enabled (false while the range is
// upside down: nothing is asked), action (the action filter in use), onPickAction(action | '') (choosing a figure
// filters the timeline by that action; choosing the active one clears it).
// Every figure has its own state (a skeleton while it loads, "—" if it failed); when any failed the panel says so
// with the catalog text and "Try again", and the timeline is not affected. It follows the filters: the reads are
// keyed by them, so changing a filter reads them again.
import { CircleAlert } from 'lucide-react';

import type { ApiResource } from '../../api/useApiResource';
import { getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { Button, Skeleton, cx } from '../../components/ui';

import { ACTIONS, ACTION_LABEL } from './auditLabels';
import type { AuditAction, AuditQuery } from './auditLabels';

interface AuditTotalsProps {
  base: Omit<AuditQuery, 'page' | 'pageSize' | 'action'>;
  enabled: boolean;
  action: AuditAction | '';
  onPickAction: (action: AuditAction | '') => void;
}

/** The dot of each action, the colors of its icon in the timeline. */
const DOT: Record<AuditAction, string> = {
  CREATE: 'bg-success',
  UPDATE: 'bg-accent',
  DELETE: 'bg-danger',
  EVENT: 'bg-ink-500',
};

function useTotal(
  base: AuditTotalsProps['base'],
  action: AuditAction | null,
  enabled: boolean,
): ApiResource<number> {
  const client = useApi();
  const query: AuditQuery = {
    ...base,
    page: 1,
    pageSize: 1,
    ...(action !== null && { action }),
  };
  return useApiResource(
    `audit-total:${JSON.stringify(query)}`,
    async (signal) => {
      const { body } = await client.get('/audit-log', {
        query,
        signal,
      });
      return { body: body.total, etag: null };
    },
    enabled,
  );
}

function Figure({ total, enabled }: { total: ApiResource<number>; enabled: boolean }) {
  if (!enabled || total.status === 'error') return <span aria-label="Unavailable">—</span>;
  if (total.status === 'loading') return <Skeleton className="h-4 w-6" />;
  return <span className="font-semibold text-ink-900">{total.data}</span>;
}

export function AuditTotals({ base, enabled, action, onPickAction }: AuditTotalsProps) {
  const all = useTotal(base, null, enabled);
  const created = useTotal(base, 'CREATE', enabled);
  const updated = useTotal(base, 'UPDATE', enabled);
  const deleted = useTotal(base, 'DELETE', enabled);
  const events = useTotal(base, 'EVENT', enabled);
  const byAction: Record<AuditAction, ApiResource<number>> = {
    CREATE: created,
    UPDATE: updated,
    DELETE: deleted,
    EVENT: events,
  };

  const failed = [all, ...ACTIONS.map((name) => byAction[name])].filter(
    (resource) => resource.status === 'error',
  );
  const firstError = failed[0]?.error ?? null;

  return (
    <aside
      aria-label="This period"
      className="rounded-card border border-border-subtle bg-surface p-5 shadow-card"
    >
      <h2 className="text-card-title font-extrabold text-ink-900">This period</h2>
      <ul className="mt-3">
        <li className="flex items-center justify-between border-b border-divider py-2 text-body-lg text-ink-900">
          <span>Records</span>
          <Figure total={all} enabled={enabled} />
        </li>
        {ACTIONS.map((name) => (
          <li key={name} className="border-b border-divider last:border-b-0">
            <button
              type="button"
              aria-pressed={action === name}
              onClick={() => {
                onPickAction(action === name ? '' : name);
              }}
              className={cx(
                'flex w-full items-center justify-between rounded-chip px-1 py-2 text-left text-body-lg hover:bg-control-hover',
                action === name && 'bg-accent-soft',
              )}
            >
              <span className="flex items-center gap-2 text-ink-700">
                <span aria-hidden="true" className={cx('size-2 rounded-pill', DOT[name])} />
                {ACTION_LABEL[name]}
              </span>
              <Figure total={byAction[name]} enabled={enabled} />
            </button>
          </li>
        ))}
      </ul>
      {failed.length > 0 && firstError !== null ? (
        <div role="alert" className="mt-3 flex flex-col items-start gap-2 text-small text-danger">
          <p className="flex items-start gap-1">
            <CircleAlert aria-hidden="true" size={14} className="mt-px shrink-0" />
            <span>Couldn&apos;t load the totals. {getThrownMessage(firstError)}</span>
          </p>
          <Button
            size="sm"
            onClick={() => {
              for (const resource of failed) resource.reload();
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-small text-ink-500">
          Totals follow the filters above. Choose one to filter the timeline.
        </p>
      )}
    </aside>
  );
}
