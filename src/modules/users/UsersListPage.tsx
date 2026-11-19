// UsersListPage: /admin/users, "Users & roles" (S-02, S-02b, S-02c, S-02d). Administrator only: the route guard shows
// S-41b to the other roles, and the API answers 403 whatever the client does (NFR-03).
// The hero of the redesigned pages in plum with the count and "New" (named "New user"), one "List" card with the filter strip,
// the table and the pagination. Search, role, status,
// sort and page live in the URL (useUserListParams); the screen opens on the active users. The reserved account never
// arrives from the API and is not filtered here. Loading shows a skeleton only after 300 ms (Table 58); an empty list
// offers "Clear filters" when filters are set; a failure shows the server error state with a retry. The creation
// modal is part of the URL (?new=1), so it can be linked and the back button closes it.
// The row menu has Edit, Change role and Deactivate (Reactivate for an inactive user, with no confirmation, as
// Unarchive has none: it reads the user and sends every field back with If-Match). Deactivating yourself is shown
// disabled with the reason (the API answers 422 CANNOT_DEACTIVATE_SELF anyway). Every write is disabled with the
// reason while offline.
import { ListFilter, Lock, LockOpen, Pencil, Plus, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { isApiError } from '../../api/ApiError';
import { getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import {
  ActionMenu,
  Button,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHero,
  Pagination,
  SLOW_LOADING_MESSAGE,
  ToneCard,
  useDelayedLoading,
  useToast,
} from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';
import { useCurrentUser } from '../../session/useCurrentUser';

import { ChangeRoleModal } from './ChangeRoleModal';
import { CreateUserModal } from './CreateUserModal';
import { DeactivateUserModal } from './DeactivateUserModal';
import { EditUserModal } from './EditUserModal';
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

const ACTION_ICON = { size: 16, strokeWidth: ICON_STROKE_WIDTH } as const;
const SELF_DEACTIVATE_REASON = "You can't deactivate your own account.";

export function UsersListPage() {
  const client = useApi();
  const me = useCurrentUser();
  const toast = useToast();
  const { blocked, reason } = useOfflineBlock();
  const [editing, setEditing] = useState<User | null>(null);
  const [changingRole, setChangingRole] = useState<User | null>(null);
  const [deactivating, setDeactivating] = useState<User | null>(null);
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

  const reactivate = async (target: User) => {
    try {
      const current = await client.get('/users/{id}', { path: { id: target.id } });
      const { name, email } = current.body.data;
      const { body } = await client.put('/users/{id}', {
        path: { id: target.id },
        ifMatch: current.etag ?? undefined,
        body: { name, email, status: 'ACTIVE' },
      });
      toast.show({ message: `${body.data.name} reactivated.` });
    } catch (thrown) {
      toast.show({ tone: 'warning', message: getThrownMessage(thrown, { element: 'user' }) });
      if (!isApiError(thrown)) return;
    }
    list.reload();
  };

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

  return (
    <>
      <PageHero
        tone="people"
        icon={<Users size={20} strokeWidth={ICON_STROKE_WIDTH} />}
        title="Users & roles"
        description={
          list.status === 'ready'
            ? countText(total, params.status)
            : 'Who can sign in, with which role.'
        }
        actions={
          <Button
            size="sm"
            variant="primary"
            disabled={blocked}
            title={reason ?? undefined}
            aria-label="New user"
            iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            onClick={() => {
              setCreating(true);
            }}
          >
            New
          </Button>
        }
      />

      <ToneCard
        title="List"
        tone="people"
        icon={<ListFilter size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        description="Search, filter and sort the users"
        actions={
          hasFilters && total > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              iconLeft={<X aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />}
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : undefined
        }
        flush
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
          <div className="border-t border-border-subtle">
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
          </div>
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
              renderActions={(row) => (
                <ActionMenu
                  label={`Actions for ${row.name}`}
                  buttonLabel="Actions"
                  items={[
                    {
                      key: 'edit',
                      label: 'Edit',
                      icon: <Pencil {...ACTION_ICON} />,
                      disabled: blocked,
                      reason: reason ?? undefined,
                      onSelect: () => {
                        setEditing(row);
                      },
                    },
                    {
                      key: 'role',
                      label: 'Change role',
                      icon: <Users {...ACTION_ICON} />,
                      disabled: blocked,
                      reason: reason ?? undefined,
                      onSelect: () => {
                        setChangingRole(row);
                      },
                    },
                    row.status === 'ACTIVE'
                      ? {
                          key: 'status',
                          label: 'Deactivate',
                          icon: <Lock {...ACTION_ICON} />,
                          danger: true,
                          disabled: blocked || row.id === me?.id,
                          reason:
                            row.id === me?.id ? SELF_DEACTIVATE_REASON : (reason ?? undefined),
                          onSelect: () => {
                            setDeactivating(row);
                          },
                        }
                      : {
                          key: 'status',
                          label: 'Reactivate',
                          icon: <LockOpen {...ACTION_ICON} />,
                          disabled: blocked,
                          reason: reason ?? undefined,
                          onSelect: () => {
                            void reactivate(row);
                          },
                        },
                  ]}
                />
              )}
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
      </ToneCard>

      {editing !== null && (
        <EditUserModal
          userId={editing.id}
          onClose={() => {
            setEditing(null);
          }}
          onSaved={list.reload}
        />
      )}
      {changingRole !== null && (
        <ChangeRoleModal
          user={changingRole}
          onClose={() => {
            setChangingRole(null);
          }}
          onChanged={list.reload}
        />
      )}
      {deactivating !== null && (
        <DeactivateUserModal
          user={deactivating}
          onClose={() => {
            setDeactivating(null);
          }}
          onDone={list.reload}
        />
      )}
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
