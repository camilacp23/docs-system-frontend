// reviewModel: the pure rules of the review queue (S-36), apart from the components so they can be tested.
// REVIEW_PAGE_SIZE      screens per page of the queue (20; "Load more" reads the next page)
// relativeTime(iso, now) "2 days ago", "3 hours ago", "just now": how long ago an instant was, in English, rounded down
// reviewSummary(screen)  what the panel "What to check" says about a screen, computed from its detail:
//   template   { done, total, complete } how many of the seven fields have content (D-81)
//   links      "3 variables · 1 collection · 3 components" (distinct variables and collections; "Nothing is linked yet.")
//   todo       "3 Subtasks pending in Jira" / "No pending Subtasks"
//   miro       "Linked" / "Not linked"
//   fields     the seven template fields with whether each has content
// nextSelection(ids, removed) the id to select after `removed` leaves the queue: the one that took its place, else the
//                       one before it, else null
import type { Screen } from '../screens/screenTypes';
import { hasContent, TEMPLATE_FIELDS } from '../screens/templateFields';

export const REVIEW_PAGE_SIZE = 20;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

export function relativeTime(iso: string, now: number = Date.now()): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return iso;
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return formatter.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return formatter.format(-Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < 60 * DAY) return formatter.format(-Math.floor(elapsed / DAY), 'day');
  return formatter.format(-Math.floor(elapsed / (30 * DAY)), 'month');
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export interface ReviewSummary {
  template: { done: number; total: number; complete: boolean };
  links: string;
  todo: string;
  miro: string;
  fields: ReadonlyArray<{ key: string; label: string; done: boolean }>;
}

export function reviewSummary(screen: Screen): ReviewSummary {
  const fields = TEMPLATE_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    done: hasContent(screen.template[field.key]),
  }));
  const done = fields.filter((field) => field.done).length;
  const variables = new Set(screen.variableLinks.map((link) => link.variable.id)).size;
  const collections = new Set(screen.collectionLinks.map((link) => link.collection.id)).size;
  const components = screen.components.length;
  const parts = [
    variables > 0 ? plural(variables, 'variable') : null,
    collections > 0 ? plural(collections, 'collection') : null,
    components > 0 ? plural(components, 'component') : null,
  ].filter((part): part is string => part !== null);
  return {
    template: { done, total: fields.length, complete: done === fields.length },
    links: parts.length === 0 ? 'Nothing is linked yet.' : parts.join(' · '),
    todo:
      screen.pendingSubtasks > 0
        ? `${plural(screen.pendingSubtasks, 'Subtask')} pending in Jira`
        : 'No pending Subtasks',
    miro: screen.miroLink === null ? 'Not linked' : 'Linked',
    fields,
  };
}

export function nextSelection(ids: readonly number[], removed: number): number | null {
  const index = ids.indexOf(removed);
  if (index === -1) return ids[0] ?? null;
  return ids[index + 1] ?? ids[index - 1] ?? null;
}
