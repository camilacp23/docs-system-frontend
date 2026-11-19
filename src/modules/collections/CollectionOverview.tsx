// CollectionOverview: the Overview tab of the collection detail (S-15a), three cards across the page:
//   Details: a row of four facts (linked to a screen (`documented`, FR-19), the collections it is derived from (links),
//   environments, last update) and, under it, the description and the notes of each environment side by side ("No known
//   differences." when it has none);
//   Creation condition: the formula, in IBM Plex Mono;
//   Used by screens (UsedByScreensCard): the screens that use the collection with the access mode of each use (D-103); it
//   reads its own data, so if that read fails only the card shows an error.
// Props: collection.
import { Code, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { cx, ICON_STROKE_WIDTH, Tag, ToneCard } from '../../components/ui';
import { formatTimestamp } from '../variables/variableLabels';

import type { Collection } from './collectionTypes';
import { UsedByScreensCard } from './UsedByScreensCard';

const NO_DIFFERENCES_TEXT = 'No known differences.';
const NO_DESCRIPTION_TEXT = 'No description.';
const NO_CONDITION_TEXT = 'No creation condition.';
/** Description and the notes of each environment on one row (the description a little wider), by number of environments. */
const NOTES_COLUMNS = [
  'lg:grid-cols-1',
  'lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]',
  'lg:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))]',
] as const;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-micro font-bold tracking-wider text-collection-ink uppercase">{label}</dt>
      <dd className="text-body-lg text-ink-900">{children}</dd>
    </div>
  );
}

export function CollectionOverview({ collection }: { collection: Collection }) {
  const condition = collection.creationCondition ?? '';
  const description = collection.description ?? '';
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ToneCard
        title="Details"
        tone="collection"
        description="Description, links and notes per environment"
        icon={<Info size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        flush
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 lg:grid-cols-4">
          <Fact label="Linked to screens">
            {collection.documented ? 'Yes' : <Tag tone="warning">Not linked</Tag>}
          </Fact>
          <Fact label="Derived from">
            {collection.derivedFrom.length === 0 ? (
              <span className="text-ink-500">None</span>
            ) : (
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {collection.derivedFrom.map((source) => (
                  <Link
                    key={source.id}
                    to={`/collections/${source.id}`}
                    className="rounded-chip font-mono text-label text-identifier hover:underline"
                  >
                    {source.name}
                  </Link>
                ))}
              </span>
            )}
          </Fact>
          <Fact label="Environments">
            <span className="inline-flex flex-wrap gap-1">
              {collection.environments.map((environment) => (
                <Tag key={environment} tone={environment === 'PROD' ? 'success' : 'neutral'}>
                  {environment}
                </Tag>
              ))}
            </span>
          </Fact>
          <Fact label="Updated">{formatTimestamp(collection.updatedAt)}</Fact>
        </dl>
        <dl
          className={cx(
            'grid grid-cols-1 gap-x-6 gap-y-4 border-t border-divider bg-collection-soft/30 px-5 py-4',
            NOTES_COLUMNS[Math.min(collection.environmentDetails.length, 2)],
          )}
        >
          <Fact label="Description">{description === '' ? NO_DESCRIPTION_TEXT : description}</Fact>
          {collection.environmentDetails.map((detail) => (
            <div key={detail.environment} className="flex min-w-0 flex-col gap-1">
              <dt>
                <Tag tone={detail.environment === 'PROD' ? 'success' : 'neutral'}>
                  {detail.environment}
                </Tag>
              </dt>
              <dd className="text-body-lg text-ink-900">
                {detail.notes === null || detail.notes === '' ? NO_DIFFERENCES_TEXT : detail.notes}
              </dd>
            </div>
          ))}
        </dl>
      </ToneCard>

      <ToneCard
        title="Creation condition"
        tone="teal"
        description="The formula that creates the collection"
        icon={<Code size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      >
        <div>
          {condition === '' ? (
            <p className="text-body-lg text-ink-500">{NO_CONDITION_TEXT}</p>
          ) : (
            <pre className="font-mono text-label break-words whitespace-pre-wrap text-ink-900">
              {condition}
            </pre>
          )}
        </div>
      </ToneCard>

      <UsedByScreensCard collectionId={collection.id} />
    </div>
  );
}
