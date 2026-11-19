// SearchForm: the form of the advanced search (S-29): the text box, and below it whatever the page puts inside (the type
// chips and the filters), so every control of the search is in one landmark (role search), on one card.
// Props: params, setParams (writes the URL), children.
// The text: what the user types is searched after a pause of 300 ms (useSearchDraft), and Enter searches at once; there is no
// "Search" button. The URL always holds the trimmed text. The error of the field comes from the text the URL holds
// (2 to 100 characters once trimmed): while it shows, nothing is asked of the API.
import { Search } from 'lucide-react';
import { useCallback, useId } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { FormField, ICON_STROKE_WIDTH, TextField } from '../../components/ui';
import { useSearchDraft } from '../../hooks/useSearchDraft';

import { SEARCH_TEXT_ERROR } from './searchLabels';
import { validateSearchText } from './searchQuery';
import type { SearchListParams } from './useSearchListParams';

interface SearchFormProps {
  params: SearchListParams;
  setParams: (patch: Partial<SearchListParams>, options?: { replace?: boolean }) => void;
  children: ReactNode;
}

export function SearchForm({ params, setParams, children }: SearchFormProps) {
  const inputId = useId();
  const [text, setText] = useSearchDraft(
    params.q,
    useCallback(
      (q: string) => {
        setParams({ q }, { replace: true });
      },
      [setParams],
    ),
  );
  const textError = validateSearchText(params.q);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setParams({ q: text.trim() }, { replace: true });
  };

  return (
    <form
      role="search"
      aria-label="Advanced search"
      onSubmit={submit}
      className="shrink-0 overflow-hidden rounded-modal border border-find-border bg-surface shadow-card"
    >
      <div className="px-5 py-4">
        <FormField
          label={<span className="sr-only">Search text</span>}
          htmlFor={inputId}
          error={textError !== null ? SEARCH_TEXT_ERROR[textError] : undefined}
          className="min-w-0"
        >
          {(control) => (
            <TextField
              {...control}
              type="search"
              large
              icon={<Search size={18} strokeWidth={ICON_STROKE_WIDTH} />}
              placeholder="Search screens, variables, collections and components…"
              autoComplete="off"
              spellCheck={false}
              className="rounded-pill"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
          )}
        </FormField>
      </div>
      {children}
    </form>
  );
}
