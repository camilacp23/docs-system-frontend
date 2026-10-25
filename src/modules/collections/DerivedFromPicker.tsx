// DerivedFromPicker: the "Derived from" selection of the collection edit page (S-16, D-74): the collections of the
// application this one is built from, chosen with checkboxes (several allowed). Props: options (the collections of
// the application, { id, name }), selfId (this collection: it is left out, a collection cannot derive from itself),
// value (the selected ids), onChange(ids), error, disabled, loading (the options are being read).
// The page adds the collections the saved version already derives from to the options, so each selected one can be
// unchecked. A filter box narrows long lists; it never changes the selection.
import { Search } from 'lucide-react';
import { useId, useState } from 'react';

import { Checkbox, ICON_STROKE_WIDTH, TextField } from '../../components/ui';

import { MAX_DERIVED_FROM } from './collectionForm';

export interface CollectionOption {
  id: number;
  name: string;
}

interface DerivedFromPickerProps {
  options: readonly CollectionOption[];
  selfId: number;
  value: readonly number[];
  onChange: (next: number[]) => void;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
}

export function DerivedFromPicker({
  options,
  selfId,
  value,
  onChange,
  error,
  disabled = false,
  loading = false,
}: DerivedFromPickerProps) {
  const errorId = useId();
  const [filter, setFilter] = useState('');
  const candidates = options.filter((option) => option.id !== selfId);
  const shown = candidates.filter((option) =>
    option.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  const toggle = (id: number, checked: boolean) => {
    onChange(checked ? [...value, id] : value.filter((candidate) => candidate !== id));
  };

  return (
    <section aria-label="Derived from" className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-label font-medium text-ink-700">Derived from</h3>
          <span className="text-small text-ink-500">
            Collections this one is built from ({value.length} of at most {MAX_DERIVED_FROM})
          </span>
        </div>
        {candidates.length > 6 && (
          <div className="relative w-56">
            <Search
              aria-hidden="true"
              size={16}
              strokeWidth={ICON_STROKE_WIDTH}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-500"
            />
            <TextField
              type="search"
              aria-label="Filter collections"
              placeholder="Filter collections…"
              className="pl-9"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
              }}
            />
          </div>
        )}
      </div>
      {candidates.length === 0 ? (
        <p className="rounded-control border border-dashed border-border-subtle px-3 py-4 text-body text-ink-500">
          {loading ? 'Loading collections…' : 'There are no other collections in this application.'}
        </p>
      ) : (
        <ul className="grid max-h-64 grid-cols-3 gap-x-4 gap-y-2 overflow-y-auto rounded-control border border-border-subtle p-3">
          {shown.map((option, index) => (
            <li key={option.id}>
              <Checkbox
                label={<span className="font-mono text-label">{option.name}</span>}
                checked={value.includes(option.id)}
                disabled={disabled}
                // The error is linked to the first checkbox, where the focus goes after a failed save.
                invalid={Boolean(error) && index === 0}
                aria-describedby={error && index === 0 ? errorId : undefined}
                onChange={(event) => {
                  toggle(option.id, event.target.checked);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
