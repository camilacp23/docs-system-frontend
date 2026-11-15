// UserFilters: the filter bar of the user list (S-02, S-02c): search by name or email (the URL changes after the
// user stops typing, useSearchDraft), the role and the status ("Status: Active" by default).
// Props: params (current filters), setParams (writes the URL). Every control has an accessible name.
import { Search } from 'lucide-react';
import { useCallback } from 'react';

import { ICON_STROKE_WIDTH, Select, TextField } from '../../components/ui';
import { useSearchDraft } from '../../hooks/useSearchDraft';

import { ROLES, ROLE_LABEL, type UserRole } from './userLabels';
import type { StatusFilter, UserListParams } from './useUserListParams';

interface UserFiltersProps {
  params: UserListParams;
  setParams: (patch: Partial<UserListParams>, options?: { replace?: boolean }) => void;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'ACTIVE', label: 'Status: Active' },
  { value: 'INACTIVE', label: 'Status: Inactive' },
  { value: 'ALL', label: 'Status: All' },
];

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
    <div className="flex flex-wrap items-center gap-3 border-b border-divider bg-search-bg/60 p-4">
      <div className="min-w-64 flex-1">
        <TextField
          type="search"
          icon={<Search size={16} strokeWidth={ICON_STROKE_WIDTH} />}
          aria-label="Search by name or email"
          placeholder="Search by name or email…"
          maxLength={100}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      </div>
      <Select
        aria-label="Role"
        className="w-40"
        value={params.role}
        onChange={(event) => {
          setParams({ role: event.target.value as UserRole | '' });
        }}
      >
        <option value="">Role</option>
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABEL[role]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Status"
        className="w-44"
        value={params.status}
        onChange={(event) => {
          setParams({ status: event.target.value as StatusFilter });
        }}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
