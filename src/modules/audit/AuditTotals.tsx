// AuditTotals: the "This period" widgets of the audit log (S-32): under the hero, four tiles like the ones of Variables, Created
// (green), Updated (blue), Deleted (red) and Events (violet), each named "<action> · filter" because pressing it filters the
// timeline (as in Variables), with its icon, its figure and a thin bar with its share of the
// period, and, on the right of a small header, the number of records of the period. They have the SAME filters as the timeline
// (except the action, which is what the figures split by). Each figure is the `total` of GET /audit-log with pageSize=1 (and
// `action` for the four of the actions).
// Props: base (the query of the timeline without page, pageSize and action), enabled (false while the range is upside down:
// nothing is asked), action (the action filter in use), onPickAction(action | '') (choosing a tile filters the timeline by that
// action, with a ring and a check while it is on; choosing the active one clears it).
// Every figure has its own state (a dash that says "Unavailable" while it loads or if it failed); when any failed the panel says
// so with the catalog text and "Try again", and the timeline is not affected. It follows the filters: the reads are keyed by
// them, so changing a filter reads them again.
import { CircleAlert } from 'lucide-react';

import type { ApiResource } from '../../api/useApiResource';
import { getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { Button, Skeleton, StatTile } from '../../components/ui';
import type { StatTone } from '../../components/ui';

import { AuditActionIcon } from './AuditActionIcon';
import { ACTIONS, ACTION_LABEL } from './auditLabels';
import type { AuditAction, AuditQuery } from './auditLabels';

interface AuditTotalsProps {
  base: Omit<AuditQuery, 'page' | 'pageSize' | 'action'>;
  enabled: boolean;
  action: AuditAction | '';
  onPickAction: (action: AuditAction | '') => void;
}

/** The color of the tile of each action (the same as its icon in the timeline). */
const TONE: Record<AuditAction, StatTone> = {
  CREATE: 'success',
  UPDATE: 'collection',
  DELETE: 'danger',
  EVENT: 'jira',
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

function RecordsFigure({ total, enabled }: { total: ApiResource<number>; enabled: boolean }) {
  if (!enabled || total.status === 'error') return <span aria-label="Unavailable">—</span>;
  if (total.status === 'loading') return <Skeleton className="h-4 w-8" />;
  return <span className="font-extrabold text-audit-ink">{total.data}</span>;
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
  const sum = all.data ?? 0;

  return (
    <aside aria-label="This period" className="@container flex shrink-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-micro font-bold tracking-wider text-audit-ink uppercase">
          This period
        </h2>
        <ul>
          <li className="flex items-center gap-2 rounded-pill border border-audit-border bg-audit-soft px-3 py-1 text-label font-semibold text-ink-700">
            <span>Records</span>
            <RecordsFigure total={all} enabled={enabled} />
          </li>
        </ul>
      </div>
      <ul className="grid grid-cols-2 gap-3 @min-[900px]:grid-cols-4">
        {ACTIONS.map((name) => {
          const resource = byAction[name];
          const value = resource.data ?? null;
          const known = enabled && resource.status === 'ready' && value !== null;
          return (
            <li key={name}>
              <StatTile
                tone={TONE[name]}
                icon={<AuditActionIcon action={name} size={17} />}
                label={`${ACTION_LABEL[name]} · filter`}
                value={known ? value : null}
                unavailableLabel={
                  !enabled || resource.status === 'error' ? 'Unavailable' : undefined
                }
                share={known && sum > 0 ? Math.round((value / sum) * 100) : 0}
                pressed={action === name}
                onPress={() => {
                  onPickAction(action === name ? '' : name);
                }}
              />
            </li>
          );
        })}
      </ul>
      {failed.length > 0 && firstError !== null && (
        <div role="alert" className="flex flex-col items-start gap-2 text-small text-danger">
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
      )}
    </aside>
  );
}
