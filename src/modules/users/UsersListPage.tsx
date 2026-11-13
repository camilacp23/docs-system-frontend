// UsersListPage: /admin/users, "Users & roles" (S-02, S-02b, S-02c, S-02d). Administrator only: the route guard shows
// S-41b to the other roles, and the API answers 403 whatever the client does (NFR-03).
// Page header with the count and "New user", the filter bar, the table and the pagination. Search, role, status,
// sort and page live in the URL (useUserListParams); the screen opens on the active users. The reserved account never
// arrives from the API and is not filtered here. Loading shows a skeleton only after 300 ms (Table 58); an empty list
// offers "Clear filters" when filters are set; a failure shows the server error state with a retry. The creation
// modal is part of the URL (?new=1), so it can be linked and the back button closes it.
import { Plus, UserPlus, Users, X } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import {
  Button,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHeader,
  Pagination,
  SLOW_LOADING_MESSAGE,
  useDelayedLoading,
} from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';
import { useCurrentUser } from '../../session/useCurrentUser';

import { CreateUserModal } from './CreateUserModal';
import type { User } from './userLabels';
import { UserFilters } from './UserFilters';
import { UserTable } from './UserTable';
import { useUserListParams, type StatusFilter } from './useUserListParams';

const COUNT_NOUN: Record<StatusFilter, string> = {
  ACTIVE: 'active user',
  INACTIVE: 'inactive user',
  ALL: 'user',
};

/** "5 active users", "1 inactive user", "12 users". */
function countText(total: number, status: StatusFilter): string {
  const noun = COUNT_NOUN[status];
  return `${total} ${noun}${total === 1 ? '' : 's'}`;
}

export function UsersListPage() {
  const client = useApi();
  const me = useCurrentUser();
  const { blocked, reason } = useOfflineBlock();
  const [search, setSearch] = useSearchParams();
  const creating = search.get('new') === '1';
  const setCreating = (open: boolean) => {
    setSearch((current) => {
      const next = new URLSearchParams(current);
      if (open) next.set('new', '1');
      else next.delete('new');
      return next;
    });
  };
  const { params, setParams, clearFilters, hasFilters } = useUserListParams();

  const query = {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    ...(params.q !== '' && { q: params.q }),
    ...(params.role !== '' && { role: params.role }),
    ...(params.status !== 'ALL' && { status: params.status }),
  };

  const list = useApiResource<{ rows: User[]; total: number }>(
    `users:${JSON.stringify(query)}`,
    async (signal) => {
      const { body } = await client.get('/users', { query, signal });
      return { body: { rows: body.data, total: body.total }, etag: null };
    },
  );
  const { showSkeleton, isSlow } = useDelayedLoading(list.loading);

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

  return (
    <>
      <PageHeader
        icon={<Users size={20} strokeWidth={ICON_STROKE_WIDTH} />}
        title="Users & roles"
        description={list.status === 'ready' ? countText(total, params.status) : undefined}
        actions={
          <Button
            variant="primary"
            disabled={blocked}
            title={reason ?? undefined}
            iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            onClick={() => {
              setCreating(true);
            }}
          >
            New user
          </Button>
        }
      />

      <section
        aria-label="User list"
        className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card"
      >
        <UserFilters params={params} setParams={setParams} />
        {list.status === 'error' ? (
          <ErrorState
            variant="server-error"
            requestId={list.error?.requestId ?? undefined}
            className="py-14"
            onAction={list.reload}
          />
        ) : list.status === 'ready' && total === 0 ? (
          <EmptyState
            icon={<UserPlus />}
            title="No results"
            description="No users match these filters."
            action={
              hasFilters ? (
                <Button
                  variant="primary"
                  iconLeft={<X aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />}
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <UserTable
              rows={rows}
              sort={params.sort}
              onSort={(sort) => {
                setParams({ sort });
              }}
              loading={list.loading}
              showSkeleton={showSkeleton}
              currentUserId={me?.id ?? null}
            />
            {isSlow && (
              <p className="px-4 py-3 text-small text-ink-500" role="status">
                {SLOW_LOADING_MESSAGE}
              </p>
            )}
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
          </>
        )}
      </section>

      {creating && (
        <CreateUserModal
          onClose={() => {
            setCreating(false);
          }}
          onCreated={list.reload}
        />
      )}
    </>
  );
}
