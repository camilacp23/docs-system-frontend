// SearchResultItem: one result of the advanced search (S-29). Props: result (a SearchResult of any type), text (the
// trimmed text the page on screen was asked with; empty without text).
// Shows the icon and the name of the type (a tag), the name (the link to the element, with the matches marked
// whenever it contains the text, whatever matchedIn says), the line "Matched in <place>" (only with text: matchedIn
// is null without it) followed by " · in <screen>" for a component, and the snippet with the matches marked. At the
// right: the documentation status of a screen, or the environments a variable or collection is in.
// The link leads where elementHref says (a component opens the Components & navigation tab of its screen); the whole
// row is the click target of that link.
import { Link } from 'react-router';

import { cx, ElementTypeIcon, StatusTag, Tag } from '../../components/ui';
import { elementHref } from '../dependency-map/nodeLinks';
import { toTagStatus } from '../screens/screenLabels';

import { Highlighted } from './Highlighted';
import { MATCHED_IN_MONO, matchedInText, TYPE_ICON, TYPE_LABEL } from './searchLabels';
import { SEARCH_ENVIRONMENTS, type SearchResult } from './searchTypes';

/** The tile and the hover wash of each type: the color of its module. */
const TYPE_TILE: Record<SearchResult['type'], { tile: string; row: string }> = {
  SCREEN: { tile: 'bg-screen-soft text-screen-ink', row: 'hover:bg-screen-soft/40' },
  VARIABLE: { tile: 'bg-variable-soft text-variable-ink', row: 'hover:bg-variable-soft/40' },
  COLLECTION: {
    tile: 'bg-collection-soft text-collection-ink',
    row: 'hover:bg-collection-soft/40',
  },
  COMPONENT: { tile: 'bg-empty-icon-bg text-primary', row: 'hover:bg-empty-icon-bg/40' },
};

interface SearchResultItemProps {
  result: SearchResult;
  text: string;
}

function hrefOf(result: SearchResult): string {
  return result.type === 'COMPONENT'
    ? elementHref({ type: 'COMPONENT', screenId: result.screen.id })
    : elementHref({ type: result.type, id: result.id });
}

export function SearchResultItem({ result, text }: SearchResultItemProps) {
  const matchedIn = result.matchedIn;
  const screenName = result.type === 'COMPONENT' ? result.screen.name : null;
  const where = [
    matchedIn !== null ? matchedInText(matchedIn) : null,
    screenName !== null ? `in ${screenName}` : null,
  ].filter((part) => part !== null);

  return (
    <li
      className={cx(
        'relative flex items-start gap-4 border-b border-divider px-5 py-3.5 transition-colors duration-150 last:border-b-0 motion-reduce:transition-none',
        TYPE_TILE[result.type].row,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'flex size-10 shrink-0 items-center justify-center rounded-control',
          TYPE_TILE[result.type].tile,
        )}
      >
        <ElementTypeIcon type={TYPE_ICON[result.type]} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={hrefOf(result)}
            className="rounded-chip font-mono text-body-lg font-semibold text-ink-900 after:absolute after:inset-0 hover:underline"
          >
            <Highlighted text={result.name} query={text} />
          </Link>
          <Tag>{TYPE_LABEL[result.type]}</Tag>
        </div>
        {where.length > 0 && <p className="mt-0.5 text-small text-ink-500">{where.join(' · ')}</p>}
        {result.snippet !== null && (
          <p
            className={
              matchedIn !== null && MATCHED_IN_MONO.includes(matchedIn)
                ? 'mt-0.5 font-mono text-label break-words text-ink-700'
                : 'mt-0.5 text-body break-words text-ink-700'
            }
          >
            <Highlighted text={result.snippet} query={text} />
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {result.type === 'SCREEN' && <StatusTag status={toTagStatus(result.documentationStatus)} />}
        {(result.type === 'VARIABLE' || result.type === 'COLLECTION') &&
          SEARCH_ENVIRONMENTS.filter((environment) =>
            result.environments.includes(environment),
          ).map((environment) => (
            <Tag key={environment} tone={environment === 'PROD' ? 'success' : 'neutral'}>
              {environment}
            </Tag>
          ))}
      </div>
    </li>
  );
}
