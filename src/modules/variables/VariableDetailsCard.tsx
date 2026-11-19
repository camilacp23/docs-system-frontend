// VariableDetailsCard: the "Details" card of the variable detail (S-11), across the page: a row of five facts (data type,
// scope, origin screen, environments, last update) and, under it, the description and the notes of each environment side by side ("No known
// differences." when it has none).
// Props: variable. The origin screen links to its page and is in IBM Plex Mono; a variable without origin shows the
// "Untraced" tag.
import { CircleAlert, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { cx, ICON_STROKE_WIDTH, Tag, ToneCard } from '../../components/ui';

import { DATA_TYPE_LABEL, formatTimestamp, SCOPE_FUNCTION, SCOPE_LABEL } from './variableLabels';
import type { Variable } from './variableTypes';

const NO_DIFFERENCES_TEXT = 'No known differences.';
const NO_DESCRIPTION_TEXT = 'No description.';
/** Description and the notes of each environment on one row (the description a little wider), by number of environments. */
const NOTES_COLUMNS = [
  'lg:grid-cols-1',
  'lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]',
  'lg:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))]',
] as const;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-micro font-bold tracking-wider text-variable-ink uppercase">{label}</dt>
      <dd className="text-body-lg text-ink-900">{children}</dd>
    </div>
  );
}

export function VariableDetailsCard({ variable }: { variable: Variable }) {
  const origin = variable.originScreen;
  return (
    <ToneCard
      title="Details"
      tone="variable"
      description="Type, scope, origin and notes per environment"
      icon={<Info size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      flush
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 lg:grid-cols-5">
        <Fact label="Data type">{DATA_TYPE_LABEL[variable.dataType]}</Fact>
        <Fact label="Scope">
          {SCOPE_LABEL[variable.scope]} ({SCOPE_FUNCTION[variable.scope]})
        </Fact>
        <Fact label="Origin screen">
          {origin === null ? (
            <Tag tone="warning" icon={<CircleAlert size={14} strokeWidth={ICON_STROKE_WIDTH} />}>
              Untraced
            </Tag>
          ) : (
            <Link
              to={`/screens/${origin.id}`}
              className="rounded-chip font-mono text-label text-identifier hover:underline"
            >
              {origin.name}
            </Link>
          )}
          {origin !== null && variable.originUsedIn !== null && (
            <span className="mt-0.5 block font-mono text-small text-ink-700">
              Used in {variable.originUsedIn}
            </span>
          )}
        </Fact>
        <Fact label="Environments">
          <span className="inline-flex flex-wrap gap-1">
            {variable.environments.map((environment) => (
              <Tag key={environment} tone={environment === 'PROD' ? 'success' : 'neutral'}>
                {environment}
              </Tag>
            ))}
          </span>
        </Fact>
        <Fact label="Updated">{formatTimestamp(variable.updatedAt)}</Fact>
      </dl>
      <dl
        className={cx(
          'grid grid-cols-1 gap-x-6 gap-y-4 border-t border-divider bg-variable-soft/30 px-5 py-4',
          NOTES_COLUMNS[Math.min(variable.environmentDetails.length, 2)],
        )}
      >
        <Fact label="Description">
          {variable.description === null || variable.description === ''
            ? NO_DESCRIPTION_TEXT
            : variable.description}
        </Fact>
        {variable.environmentDetails.map((detail) => (
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
  );
}
