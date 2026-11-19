// UserFilters: the filter strip of the user list (S-02, S-02c). One centered row of pills on a soft plum band, like the lists of
// Variables: the search by name or email (the URL changes after the user stops typing, useSearchDraft; there is no global
// search for people, so this one stays) and two pill selects, the role and the status. A select that is not on its default
// turns plum, so the active filters can be seen at a glance; the status is "Active" by default.
// Props: params (current filters), setParams (writes the URL). Every control has an accessible name.
import { Search, ShieldCheck, UserCheck } from 'lucide-react';
import { useCallback } from 'react';

import { FilterSelect, ICON_STROKE_WIDTH, cx } from '../../components/ui';
import { useSearchDraft } from '../../hooks/useSearchDraft';

import { ROLES, ROLE_LABEL, type UserRole } from './userLabels';
import type { StatusFilter, UserListParams } from './useUserListParams';

interface UserFiltersProps {
  params: UserListParams;
  setParams: (patch: Partial<UserListParams>, options?: { replace?: boolean }) => void;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ALL', label: 'All' },
];

const ICON = { size: 15, strokeWidth: ICON_STROKE_WIDTH } as const;

export function UserFilters({ params, setParams }: UserFiltersProps) {
  const [text, setText] = useSearchDraft(
    params.q,
    useCallback(
      (q: string) => {
        setParams({ q }, { replace: true });
      },
      [setParams],
    ),
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 border-b border-people-border/60 bg-people-soft/40 px-5 py-3">
      <label
        className={cx(
          'flex h-9 min-w-64 flex-1 items-center gap-2 rounded-pill border bg-surface pr-3.5 pl-3.5 text-ink-700 shadow-button transition-colors duration-150 motion-reduce:transition-none',
          text !== ''
            ? 'border-people bg-people-soft text-people-ink'
            : 'border-border-subtle focus-within:border-people focus-within:bg-people-soft hover:border-people-border hover:bg-people-soft',
        )}
      >
        <Search aria-hidden="true" {...ICON} className="shrink-0" />
        <input
          type="search"
          aria-label="Search by name or email"
          placeholder="Search by name or email…"
          maxLength={100}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          className="min-w-0 flex-1 bg-transparent text-label font-semibold outline-none placeholder:font-medium placeholder:text-ink-500"
        />
      </label>
      <FilterSelect
        tone="people"
        label="Role"
        icon={<ShieldCheck {...ICON} />}
        value={params.role}
        onChange={(next) => {
          setParams({ role: next as UserRole | '' });
        }}
        selectClassName="max-w-40"
      >
        <option value="">All</option>
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABEL[role]}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        tone="people"
        label="Status"
        icon={<UserCheck {...ICON} />}
        value={params.status}
        neutralValue="ACTIVE"
        onChange={(next) => {
          setParams({ status: next as StatusFilter });
        }}
        selectClassName="max-w-40"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>
    </div>
  );
}
