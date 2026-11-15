// AuditUserFilter: the "User" filter of the audit log (S-32, S-32d).
// Props: value (user id as text, '' = anyone), onChange(value), invalid, describedBy (id of its error text).
// Administrator: a SearchPicker over GET /users that searches on the SERVER while the user types (`q`, after the
// same short pause as the other search boxes); inactive users are listed too, their history stays. A user id
// that came from the URL and is not in the results is read with GET /users/{id} and shown by name, or as
// "User #id" when it cannot be read.
// Developer: AuditOwnActionsFilter, the fixed "Only my actions" (S-32d). The Developer cannot call GET /users.
import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { ICON_STROKE_WIDTH, SearchPicker, TextField } from '../../components/ui';
import type { SearchPickerOption } from '../../components/ui';
import { SEARCH_DEBOUNCE_MS } from '../../hooks/useSearchDraft';

export const OWN_ACTIONS_REASON = 'Developers can only see their own actions.';

interface AuditUserFilterProps {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}

const USER_CHOICES = 20;
/** Value of the "Anyone" option; the picker's own value stays '' then, so its input is empty and shows the placeholder. */
const ANYONE = 'anyone';

export function AuditUserFilter({ value, onChange, invalid, describedBy }: AuditUserFilterProps) {
  const client = useApi();
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typed.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [typed]);

  const results = useApiResource(`audit-users:${search}`, async (signal) => {
    const query = { pageSize: USER_CHOICES, sort: 'name', ...(search !== '' && { q: search }) };
    const { body } = await client.get('/users', { query, signal });
    return { body: body.data, etag: null };
  });
  const users = results.data ?? [];
  const chosen = users.find((user) => String(user.id) === value);

  const needsLookup = value !== '' && chosen === undefined;
  const lookup = useApiResource(
    `audit-user:${value}`,
    async (signal) => {
      const { body } = await client.get('/users/{id}', { path: { id: Number(value) }, signal });
      return { body: body.data, etag: null };
    },
    needsLookup,
  );
  const lookedUp = lookup.data !== null && String(lookup.data.id) === value ? lookup.data : null;
  const chosenName = chosen?.name ?? lookedUp?.name ?? `User #${value}`;

  const options: SearchPickerOption[] = [];
  if (typed === '') options.push({ value: ANYONE, label: 'Anyone' });
  for (const user of users)
    options.push({ value: String(user.id), label: user.name, detail: user.email });
  if (typed === '' && value !== '' && chosen === undefined) {
    options.push({ value, label: chosenName });
  }

  return (
    <SearchPicker
      aria-label="User"
      aria-describedby={describedBy}
      placeholder="Anyone"
      options={options}
      value={value}
      onChange={(next) => {
        onChange(next === ANYONE ? '' : next);
      }}
      onQueryChange={setTyped}
      filterOptions={false}
      loading={results.loading}
      invalid={invalid}
    />
  );
}

/** The user filter of a Developer: fixed on themselves, disabled, with the reason (S-32d "Only my actions"). */
export function AuditOwnActionsFilter({ reasonId }: { reasonId: string }) {
  return (
    <>
      <TextField
        aria-label="User"
        aria-describedby={reasonId}
        icon={<Lock size={14} strokeWidth={ICON_STROKE_WIDTH} />}
        value="Only my actions"
        title={OWN_ACTIONS_REASON}
        disabled
        readOnly
      />
      <span id={reasonId} className="sr-only">
        {OWN_ACTIONS_REASON}
      </span>
    </>
  );
}
