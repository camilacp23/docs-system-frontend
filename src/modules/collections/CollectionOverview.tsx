// CollectionOverview: the Overview tab of the collection detail (S-15a): the "Creation condition" card (the formula,
// in IBM Plex Mono) and the "Details" card: description, whether the collection is linked to a screen
// (`documented`, FR-19), the collections it is derived from (links) and, for each environment, its notes
// ("No known differences." when it has none).
// Below the condition, the "Used by screens" card (UsedByScreensCard) lists the screens that use the collection with
// the access mode of each use (D-103); it reads its own data, so if that read fails only the card shows an error.
// Props: collection.
import { Code, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ICON_STROKE_WIDTH, SectionCard, Tag } from '../../components/ui';

import type { Collection } from './collectionTypes';
import { UsedByScreensCard } from './UsedByScreensCard';

const NO_DIFFERENCES_TEXT = 'No known differences.';
const NO_DESCRIPTION_TEXT = 'No description.';
const NO_CONDITION_TEXT = 'No creation condition.';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-divider px-4 py-2.5 first:border-t-0">
      <dt className="text-small text-ink-500">{label}</dt>
      <dd className="text-body-lg text-ink-900">{children}</dd>
    </div>
  );
}

export function CollectionOverview({ collection }: { collection: Collection }) {
  const condition = collection.creationCondition ?? '';
  const description = collection.description ?? '';
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start gap-4">
      <div className="flex min-w-0 flex-col gap-4">
        <SectionCard
          title="Creation condition"
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
        </SectionCard>
        <UsedByScreensCard collectionId={collection.id} />
      </div>

      <SectionCard
        title="Details"
        description="Description, links and notes per environment"
        icon={<Info size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        tone="neutral"
        flush
      >
        <dl>
          <Row label="Description">{description === '' ? NO_DESCRIPTION_TEXT : description}</Row>
          <Row label="Linked to screens">
            {collection.documented ? 'Yes' : <Tag tone="warning">Not linked</Tag>}
          </Row>
          <Row label="Derived from">
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
          </Row>
          {collection.environmentDetails.map((detail) => (
            <div
              key={detail.environment}
              className="flex flex-col gap-1 border-t border-divider px-4 py-2.5"
            >
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
      </SectionCard>
    </div>
  );
}
