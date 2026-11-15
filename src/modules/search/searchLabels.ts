// searchLabels: the words of the advanced search (frames S-29, S-29b, S-29c).
//   TYPE_LABEL / TYPE_PLURAL   the name of each element type ("Screen") and the name of its chip ("Screens").
//   TYPE_ICON                  the key of ElementTypeIcon of each type.
//   MATCHED_IN_LABEL           the name of each place the text can be found ("Creation condition"); the line reads
//                              "Matched in <label>". `template` is the only name of the seven template fields the
//                              API gives, so the field is not named.
//   MATCHED_IN_MONO            the places whose text is a Power Apps identifier or formula (IBM Plex Mono, Table 54).
//   NOTE_ENVIRONMENT / NOTE_STATUS / NOTE_SCOPE   what each filter applies to, under the filter (D-48): the other
//                              types stay in the results.
import type { ElementType } from '../../components/ui';
import { countText } from '../variables/variableLabels';

import type { SearchTextError } from './searchQuery';
import type { SearchPage } from './useSearchResults';
import type { SearchElementType } from './searchTypes';

export const TYPE_LABEL: Record<SearchElementType, string> = {
  SCREEN: 'Screen',
  VARIABLE: 'Variable',
  COLLECTION: 'Collection',
  COMPONENT: 'Component',
};

export const TYPE_PLURAL: Record<SearchElementType, string> = {
  SCREEN: 'Screens',
  VARIABLE: 'Variables',
  COLLECTION: 'Collections',
  COMPONENT: 'Components',
};

export const TYPE_ICON: Record<SearchElementType, ElementType> = {
  SCREEN: 'screen',
  VARIABLE: 'variable',
  COLLECTION: 'collection',
  COMPONENT: 'component',
};

export const MATCHED_IN_LABEL: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  template: 'Template',
  creationCondition: 'Creation condition',
  fieldName: 'Field name',
  onSelect: 'OnSelect',
  type: 'Control type',
  usedIn: 'Used in',
};

export const MATCHED_IN_MONO: readonly string[] = [
  'creationCondition',
  'fieldName',
  'onSelect',
  'usedIn',
];

export const NOTE_ENVIRONMENT =
  'Applies to variables and collections; other types stay in the results.';
export const NOTE_STATUS = 'Applies to screens; other types stay in the results.';
export const NOTE_SCOPE = 'Applies to variables; other types stay in the results.';

/** "Matched in Name"; an unknown place (a newer API) is shown as the API names it. */
export function matchedInText(matchedIn: string): string {
  return `Matched in ${MATCHED_IN_LABEL[matchedIn] ?? matchedIn}`;
}

/** The error under the text field (S-29c), by what is wrong with the trimmed text. */
export const SEARCH_TEXT_ERROR: Record<SearchTextError, string> = {
  tooShort: 'Type at least 2 characters, or search with filters only.',
  tooLong: 'Use 100 characters or fewer.',
};

/** "4 results for “client”", or "4 results" when the search has no text. */
export function resultsHeading(page: SearchPage): string {
  const count = countText(page.total, 'result');
  return page.text === '' ? count : `${count} for “${page.text}”`;
}
