// Highlighted: a text with every appearance of the search text marked. Props: text, query (the trimmed text of the
// search; empty or null draws the text as it is).
// It is built with React elements: the text is a child of the element, so React escapes it and nothing in it is ever
// read as HTML or Markdown. The matches are the ones of searchNormalize (the rules of the API). A match is a <mark>
// with the existing tokens warning-bg (background) and ink-900 (text): 15.9:1 contrast, over the 4.5:1 of WCAG AA.
import { splitByMatches } from './searchNormalize';

interface HighlightedProps {
  text: string;
  query: string | null;
}

export function Highlighted({ text, query }: HighlightedProps) {
  if (query === null || query.trim() === '') return <>{text}</>;
  return (
    <>
      {splitByMatches(text, query).map((segment, index) =>
        segment.matched ? (
          <mark key={index} className="rounded-sm bg-warning-bg text-ink-900">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
